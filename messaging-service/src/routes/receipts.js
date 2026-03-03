/**
 * T-070 US-070-02: Read Receipts API
 * PUT /api/v1/messages/:id/read - Mark message as read
 * PUT /api/v1/conversations/:id/read - Batch read up to sequence ID
 */
const express = require('express');
const db = require('../db/pool');
const { publishEvent, CHANNELS } = require('../services/redis');

const router = express.Router();

const STATE_ORDER = { sent: 0, delivered: 1, read: 2 };

// PUT /api/v1/messages/:id/read
router.put('/messages/:id/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id;

    // Verify message exists and user has access
    const msgCheck = await db.query(
      `SELECT m.id, m.conversation_id, m.sender_id, m.sequence_id
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = $1 AND (c.advisor_id = $2 OR c.client_id = $2)`,
      [messageId, userId]
    );
    if (msgCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = msgCheck.rows[0];

    // Only recipient can mark as read (not the sender)
    if (message.sender_id === userId) {
      return res.status(400).json({ error: 'Cannot mark own message as read' });
    }

    // One-way state transition: only upgrade
    const result = await db.query(
      `UPDATE message_receipts
       SET state = 'read', read_at = NOW(), delivered_at = COALESCE(delivered_at, NOW()), updated_at = NOW()
       WHERE message_id = $1 AND user_id = $2
         AND state != 'read'
       RETURNING *`,
      [messageId, userId]
    );

    if (result.rows.length === 0) {
      // Already read or no receipt
      return res.json({ status: 'already_read' });
    }

    // Publish receipt update via Redis
    await publishEvent(CHANNELS.RECEIPT_UPDATE, {
      messageId,
      conversationId: message.conversation_id,
      userId,
      state: 'read',
      readAt: result.rows[0].read_at,
    });

    res.json({ receipt: result.rows[0] });
  } catch (err) {
    console.error('Error marking message read:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/conversations/:id/read - Batch read up to sequence ID
router.put('/conversations/:id/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { up_to_sequence_id } = req.body;

    if (!up_to_sequence_id) {
      return res.status(400).json({ error: 'up_to_sequence_id is required' });
    }

    // Verify conversation access
    const convCheck = await db.query(
      'SELECT id, advisor_id, client_id FROM conversations WHERE id = $1 AND (advisor_id = $2 OR client_id = $2)',
      [conversationId, userId]
    );
    if (convCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conv = convCheck.rows[0];

    // Batch update: mark all messages up to sequence_id as read (only messages from the other party)
    const result = await db.query(
      `UPDATE message_receipts mr
       SET state = 'read', read_at = NOW(), delivered_at = COALESCE(mr.delivered_at, NOW()), updated_at = NOW()
       FROM messages m
       WHERE mr.message_id = m.id
         AND m.conversation_id = $1
         AND m.sequence_id <= $2
         AND m.sender_id != $3
         AND mr.user_id = $3
         AND mr.state != 'read'
       RETURNING mr.*`,
      [conversationId, up_to_sequence_id, userId]
    );

    // Reset unread count
    const unreadCol = conv.advisor_id === userId ? 'unread_count_advisor' : 'unread_count_client';
    await db.query(
      `UPDATE conversations SET ${unreadCol} = 0 WHERE id = $1`,
      [conversationId]
    );

    // Publish batch receipt update
    await publishEvent(CHANNELS.RECEIPT_UPDATE, {
      conversationId,
      userId,
      state: 'read',
      batchCount: result.rows.length,
      upToSequenceId: up_to_sequence_id,
    });

    res.json({ updated_count: result.rows.length });
  } catch (err) {
    console.error('Error batch reading:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
