/**
 * T-070 US-070-01: WebSocket Real-Time Messaging Gateway
 * - JWT auth on handshake
 * - Message routing
 * - Typing indicators (debounced, 3s timeout)
 * - Server ACK for optimistic UI
 * - Redis pub/sub for cross-instance fan-out
 */
const { WebSocketServer } = require('ws');
const url = require('url');
const { authenticateWsToken } = require('../middleware/auth');
const { getSubscriber, CHANNELS } = require('../services/redis');
const db = require('../db/pool');

// Map: userId -> Set<ws>
const userConnections = new Map();
// Map: conversationId -> Map<userId, timeout>
const typingTimers = new Map();

// DEF-009: UUID format validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

// DEF-002: Max message content length
const MAX_CONTENT_LENGTH = 10000;

function setupWebSocketGateway(server) {
  const wss = new WebSocketServer({ server, path: '/ws/messaging' });

  wss.on('connection', (ws, req) => {
    // Extract token from query string
    const params = new url.URL(req.url, 'http://localhost').searchParams;
    const token = params.get('token');
    const user = authenticateWsToken(token);

    if (!user) {
      ws.close(4001, 'Authentication failed');
      return;
    }

    ws.userId = user.id;
    ws.isAlive = true;

    // Track connection
    if (!userConnections.has(user.id)) {
      userConnections.set(user.id, new Set());
    }
    userConnections.get(user.id).add(ws);

    // DEF-008: Accept last_sequence_id for offline message recovery
    const lastSequenceId = params.get('last_sequence_id');

    // Send connection ACK
    ws.send(JSON.stringify({ type: 'connected', userId: user.id }));

    // DEF-008: Replay missed messages on reconnect
    if (lastSequenceId && !isNaN(parseInt(lastSequenceId))) {
      replayMissedMessages(ws, user.id, parseInt(lastSequenceId)).catch(err => {
        console.error('Message replay error:', err);
      });
    }

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await handleMessage(ws, user, msg);
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      const conns = userConnections.get(user.id);
      if (conns) {
        conns.delete(ws);
        if (conns.size === 0) userConnections.delete(user.id);
      }
    });
  });

  // DEF-007: Heartbeat with server ping frames for client-side detection
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
      // Also send application-level ping for clients that can't handle WS ping frames
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeatInterval));

  // Subscribe to Redis for cross-instance fan-out
  setupRedisSubscription();

  return wss;
}

async function handleMessage(ws, user, msg) {
  switch (msg.type) {
    case 'send_message': {
      // Send message via WebSocket (alternative to REST)
      const { conversationId, content, clientMessageId, metadata = {} } = msg;
      if (!conversationId || !content) {
        ws.send(JSON.stringify({ type: 'error', error: 'conversationId and content required' }));
        return;
      }

      // DEF-009: UUID format validation
      if (!isValidUUID(conversationId)) {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid conversationId format' }));
        return;
      }

      // DEF-002: Max content length validation
      if (typeof content !== 'string' || content.length > MAX_CONTENT_LENGTH) {
        ws.send(JSON.stringify({ type: 'error', error: `Message content must not exceed ${MAX_CONTENT_LENGTH} characters` }));
        return;
      }

      try {
        const xss = require('xss');
        const sanitizedContent = xss(content);

        // Verify access
        const convCheck = await db.query(
          'SELECT id, advisor_id, client_id FROM conversations WHERE id = $1 AND (advisor_id = $2 OR client_id = $2)',
          [conversationId, user.id]
        );
        if (convCheck.rows.length === 0) {
          ws.send(JSON.stringify({ type: 'error', error: 'Conversation not found' }));
          return;
        }

        const conv = convCheck.rows[0];
        const recipientId = conv.advisor_id === user.id ? conv.client_id : conv.advisor_id;

        // Insert
        const result = await db.query(
          `INSERT INTO messages (conversation_id, sender_id, content, metadata)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [conversationId, user.id, sanitizedContent, JSON.stringify(metadata)]
        );
        const message = result.rows[0];

        // Create receipts
        await db.query(
          `INSERT INTO message_receipts (message_id, user_id, state, sent_at) VALUES ($1, $2, 'sent', NOW())`,
          [message.id, user.id]
        );
        await db.query(
          `INSERT INTO message_receipts (message_id, user_id, state, sent_at) VALUES ($1, $2, 'sent', NOW())`,
          [message.id, recipientId]
        );

        // ACK to sender (optimistic UI confirmation)
        ws.send(JSON.stringify({
          type: 'message_ack',
          clientMessageId,
          message,
        }));

        // Deliver to recipient
        sendToUser(recipientId, {
          type: 'new_message',
          message,
          conversationId,
        });

        // Mark as delivered if recipient is online
        if (userConnections.has(recipientId)) {
          await db.query(
            `UPDATE message_receipts SET state = 'delivered', delivered_at = NOW(), updated_at = NOW()
             WHERE message_id = $1 AND user_id = $2`,
            [message.id, recipientId]
          );
          sendToUser(user.id, {
            type: 'receipt_update',
            messageId: message.id,
            state: 'delivered',
            deliveredAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('WS send_message error:', err);
        ws.send(JSON.stringify({ type: 'error', error: 'Failed to send message' }));
      }
      break;
    }

    case 'typing': {
      const { conversationId } = msg;
      if (!conversationId) return;
      // DEF-009: UUID format validation
      if (!isValidUUID(conversationId)) {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid conversationId format' }));
        return;
      }

      // Debounce: clear existing timer, set new 3s timeout
      const key = `${conversationId}:${user.id}`;
      if (!typingTimers.has(conversationId)) typingTimers.set(conversationId, new Map());
      const timers = typingTimers.get(conversationId);

      if (timers.has(user.id)) clearTimeout(timers.get(user.id));

      // Notify other participants
      try {
        const convCheck = await db.query(
          'SELECT advisor_id, client_id FROM conversations WHERE id = $1',
          [conversationId]
        );
        if (convCheck.rows.length > 0) {
          const conv = convCheck.rows[0];
          const recipientId = conv.advisor_id === user.id ? conv.client_id : conv.advisor_id;
          sendToUser(recipientId, {
            type: 'typing',
            conversationId,
            userId: user.id,
          });
        }
      } catch (err) {
        console.error('Typing indicator error:', err);
      }

      // Auto-clear typing after 3s
      timers.set(user.id, setTimeout(() => {
        timers.delete(user.id);
      }, 3000));
      break;
    }

    case 'mark_read': {
      const { messageId, conversationId, upToSequenceId } = msg;

      // DEF-009: UUID format validation
      if (conversationId && !isValidUUID(conversationId)) {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid conversationId format' }));
        return;
      }
      if (messageId && !isValidUUID(messageId)) {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid messageId format' }));
        return;
      }

      try {
        if (upToSequenceId && conversationId) {
          // Batch read
          await db.query(
            `UPDATE message_receipts mr
             SET state = 'read', read_at = NOW(), delivered_at = COALESCE(mr.delivered_at, NOW()), updated_at = NOW()
             FROM messages m
             WHERE mr.message_id = m.id AND m.conversation_id = $1
               AND m.sequence_id <= $2 AND m.sender_id != $3
               AND mr.user_id = $3 AND mr.state != 'read'`,
            [conversationId, upToSequenceId, user.id]
          );
        } else if (messageId) {
          await db.query(
            `UPDATE message_receipts
             SET state = 'read', read_at = NOW(), delivered_at = COALESCE(delivered_at, NOW()), updated_at = NOW()
             WHERE message_id = $1 AND user_id = $2 AND state != 'read'`,
            [messageId, user.id]
          );
        }

        // Notify sender
        if (conversationId) {
          const conv = await db.query('SELECT advisor_id, client_id FROM conversations WHERE id = $1', [conversationId]);
          if (conv.rows.length > 0) {
            const c = conv.rows[0];
            const senderId = c.advisor_id === user.id ? c.client_id : c.advisor_id;
            sendToUser(senderId, {
              type: 'receipt_update',
              conversationId,
              state: 'read',
              readBy: user.id,
              upToSequenceId,
              messageId,
            });
          }
        }
      } catch (err) {
        console.error('mark_read error:', err);
      }
      break;
    }

    // DEF-007: Handle client pong responses
    case 'pong':
      // Client responded to our ping — no action needed, ws.isAlive handled by WS-level pong
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${msg.type}` }));
  }
}

// DEF-008: Replay missed messages for offline recovery
async function replayMissedMessages(ws, userId, lastSequenceId) {
  const MAX_REPLAY = 200; // Cap replay to avoid overwhelming the client
  const result = await db.query(
    `SELECT m.* FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE (c.advisor_id = $1 OR c.client_id = $1)
       AND m.sequence_id > $2
     ORDER BY m.sequence_id ASC
     LIMIT $3`,
    [userId, lastSequenceId, MAX_REPLAY]
  );

  if (result.rows.length > 0) {
    ws.send(JSON.stringify({
      type: 'message_replay',
      messages: result.rows,
      count: result.rows.length,
      has_more: result.rows.length === MAX_REPLAY,
    }));
  }
}

function sendToUser(userId, data) {
  const conns = userConnections.get(userId);
  if (!conns) return;
  const payload = JSON.stringify(data);
  for (const ws of conns) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

function setupRedisSubscription() {
  try {
    const sub = getSubscriber();
    sub.subscribe(CHANNELS.NEW_MESSAGE, CHANNELS.RECEIPT_UPDATE, CHANNELS.TYPING);
    sub.on('message', (channel, data) => {
      try {
        const parsed = JSON.parse(data);
        if (channel === CHANNELS.NEW_MESSAGE && parsed.recipientId) {
          sendToUser(parsed.recipientId, { type: 'new_message', message: parsed.message, conversationId: parsed.conversationId });
        }
        if (channel === CHANNELS.RECEIPT_UPDATE && parsed.conversationId) {
          // Broadcast to conversation participants (handled by individual connections)
        }
      } catch (err) {
        console.error('Redis message parse error:', err);
      }
    });
  } catch (err) {
    console.warn('Redis subscription failed (non-fatal):', err.message);
  }
}

module.exports = { setupWebSocketGateway, userConnections, sendToUser };
