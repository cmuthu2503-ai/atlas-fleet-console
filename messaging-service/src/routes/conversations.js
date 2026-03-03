/**
 * T-070 US-070-01: Conversations REST API
 * GET /api/v1/conversations - List conversations for current user
 * GET /api/v1/conversations/:id/messages - Paginated message history (50/page)
 * POST /api/v1/conversations/:id/messages - Send message
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const xss = require('xss');
const db = require('../db/pool');
const { publishEvent, CHANNELS } = require('../services/redis');
const { messageRateLimiter } = require('../middleware/rateLimiter');
const { userConnections } = require('../ws/gateway');

const router = express.Router();

// GET /api/v1/conversations
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT c.*,
        CASE WHEN c.advisor_id = $1 THEN c.unread_count_advisor
             ELSE c.unread_count_client END as unread_count
       FROM conversations c
       WHERE c.advisor_id = $1 OR c.client_id = $1
       ORDER BY c.last_message_at DESC NULLS LAST`,
      [userId]
    );
    res.json({ conversations: result.rows });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/conversations/:id/messages
router.get('/:id/messages', async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const before = req.query.before; // cursor: sequence_id
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    // Verify user belongs to conversation
    const convCheck = await db.query(
      'SELECT id FROM conversations WHERE id = $1 AND (advisor_id = $2 OR client_id = $2)',
      [conversationId, userId]
    );
    if (convCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    let query, params;
    if (before) {
      query = `SELECT m.*, 
        COALESCE(
          json_agg(json_build_object('id', a.id, 'filename', a.filename, 'content_type', a.content_type, 'size_bytes', a.size_bytes, 'scan_status', a.scan_status, 'thumbnail_s3_key', a.thumbnail_s3_key)) 
          FILTER (WHERE a.id IS NOT NULL), '[]'
        ) as attachments
        FROM messages m
        LEFT JOIN attachments a ON a.message_id = m.id
        WHERE m.conversation_id = $1 AND m.sequence_id < $2
        GROUP BY m.id
        ORDER BY m.sequence_id DESC LIMIT $3`;
      params = [conversationId, before, limit];
    } else {
      query = `SELECT m.*,
        COALESCE(
          json_agg(json_build_object('id', a.id, 'filename', a.filename, 'content_type', a.content_type, 'size_bytes', a.size_bytes, 'scan_status', a.scan_status, 'thumbnail_s3_key', a.thumbnail_s3_key))
          FILTER (WHERE a.id IS NOT NULL), '[]'
        ) as attachments
        FROM messages m
        LEFT JOIN attachments a ON a.message_id = m.id
        WHERE m.conversation_id = $1
        GROUP BY m.id
        ORDER BY m.sequence_id DESC LIMIT $2`;
      params = [conversationId, limit];
    }

    const result = await db.query(query, params);
    const messages = result.rows.reverse(); // Return in chronological order

    res.json({
      messages,
      pagination: {
        has_more: result.rows.length === limit,
        next_cursor: result.rows.length > 0 ? result.rows[result.rows.length - 1].sequence_id : null,
      },
    });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/conversations/:id/messages
router.post('/:id/messages', messageRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { content, metadata = {}, client_message_id } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // DEF-002: Max content length validation
    if (content.length > 10000) {
      return res.status(400).json({ error: 'Message content must not exceed 10,000 characters' });
    }

    const sanitizedContent = xss(content);

    // Verify user belongs to conversation
    const convCheck = await db.query(
      'SELECT id, advisor_id, client_id FROM conversations WHERE id = $1 AND (advisor_id = $2 OR client_id = $2)',
      [conversationId, userId]
    );
    if (convCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conv = convCheck.rows[0];
    const recipientId = conv.advisor_id === userId ? conv.client_id : conv.advisor_id;

    // Insert message
    const msgResult = await db.query(
      `INSERT INTO messages (conversation_id, sender_id, content, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [conversationId, userId, sanitizedContent, JSON.stringify(metadata)]
    );
    const message = msgResult.rows[0];

    // Create receipt for sender (sent)
    await db.query(
      `INSERT INTO message_receipts (message_id, user_id, state, sent_at)
       VALUES ($1, $2, 'sent', NOW())`,
      [message.id, userId]
    );

    // Create receipt for recipient (will transition to delivered/read)
    await db.query(
      `INSERT INTO message_receipts (message_id, user_id, state, sent_at)
       VALUES ($1, $2, 'sent', NOW())`,
      [message.id, recipientId]
    );

    // DEF-003: Mark as delivered if recipient is online (consistent with WS gateway)
    if (userConnections.has(recipientId)) {
      await db.query(
        `UPDATE message_receipts SET state = 'delivered', delivered_at = NOW(), updated_at = NOW()
         WHERE message_id = $1 AND user_id = $2`,
        [message.id, recipientId]
      );
    }

    // Update unread count
    const unreadCol = conv.advisor_id === recipientId ? 'unread_count_advisor' : 'unread_count_client';
    await db.query(
      `UPDATE conversations SET ${unreadCol} = ${unreadCol} + 1 WHERE id = $1`,
      [conversationId]
    );

    // Publish to Redis for WebSocket fan-out
    await publishEvent(CHANNELS.NEW_MESSAGE, {
      conversationId,
      message,
      recipientId,
      senderId: userId,
    });

    res.status(201).json({
      message,
      client_message_id, // Echo back for optimistic UI correlation
    });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DEF-001: Long-polling fallback endpoint for clients without WebSocket support
// GET /api/v1/conversations/poll?since_sequence_id=<id>&timeout=30
router.get('/poll', async (req, res) => {
  try {
    const userId = req.user.id;
    const sinceSequenceId = parseInt(req.query.since_sequence_id) || 0;
    const timeout = Math.min(parseInt(req.query.timeout) || 30, 60) * 1000; // max 60s

    const pollStart = Date.now();
    const pollInterval = 2000; // check every 2s

    const checkForMessages = async () => {
      const result = await db.query(
        `SELECT m.* FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE (c.advisor_id = $1 OR c.client_id = $1)
           AND m.sequence_id > $2
         ORDER BY m.sequence_id ASC
         LIMIT 100`,
        [userId, sinceSequenceId]
      );

      if (result.rows.length > 0) {
        return res.json({
          messages: result.rows,
          last_sequence_id: result.rows[result.rows.length - 1].sequence_id,
        });
      }

      if (Date.now() - pollStart >= timeout) {
        return res.json({ messages: [], last_sequence_id: sinceSequenceId });
      }

      setTimeout(checkForMessages, pollInterval);
    };

    await checkForMessages();
  } catch (err) {
    console.error('Error in long-polling:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
