/**
 * T-070 US-070-03: File Attachment API
 * POST /api/v1/messages/:id/attachments - Upload file
 * GET /api/v1/attachments/:id/download - Signed URL redirect
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/pool');
const { uploadFile, getSignedDownloadUrl } = require('../services/s3');
const { scanBuffer } = require('../services/virusScan');
const { uploadRateLimiter } = require('../middleware/rateLimiter');
const config = require('../config');

const router = express.Router();

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif',
  '.xlsx', '.xls', '.csv', '.docx', '.doc',
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif']);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILES_PER_MESSAGE = 5;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES_PER_MESSAGE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error(`File type ${ext} not allowed`));
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error(`MIME type ${file.mimetype} not allowed`));
    }
    cb(null, true);
  },
});

// POST /api/v1/messages/:id/attachments
router.post('/messages/:id/attachments', uploadRateLimiter, upload.array('files', MAX_FILES_PER_MESSAGE), async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Verify message exists and user is the sender
    const msgCheck = await db.query(
      `SELECT m.id, m.conversation_id FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = $1 AND m.sender_id = $2`,
      [messageId, userId]
    );
    if (msgCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }

    // Check existing attachment count
    const countCheck = await db.query(
      'SELECT COUNT(*) as cnt FROM attachments WHERE message_id = $1',
      [messageId]
    );
    const existingCount = parseInt(countCheck.rows[0].cnt);
    if (existingCount + req.files.length > MAX_FILES_PER_MESSAGE) {
      return res.status(400).json({
        error: `Maximum ${MAX_FILES_PER_MESSAGE} files per message. ${existingCount} already attached.`,
      });
    }

    const attachments = [];

    for (const file of req.files) {
      // Virus scan
      const scanResult = await scanBuffer(file.buffer);
      const scanStatus = scanResult.clean ? 'clean' : 'infected';

      if (!scanResult.clean) {
        attachments.push({
          filename: file.originalname,
          status: 'rejected',
          reason: 'Virus detected',
        });
        continue;
      }

      // Generate S3 key
      const ext = path.extname(file.originalname);
      const s3Key = `attachments/${messageId}/${uuidv4()}${ext}`;

      // Upload to S3 (AES-256 encryption at rest)
      await uploadFile(s3Key, file.buffer, file.mimetype);

      // Generate thumbnail for images
      let thumbnailKey = null;
      if (IMAGE_MIME_TYPES.has(file.mimetype)) {
        try {
          const sharp = require('sharp');
          const thumbBuffer = await sharp(file.buffer)
            .resize(200, 200, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toBuffer();
          thumbnailKey = `thumbnails/${messageId}/${uuidv4()}.jpg`;
          await uploadFile(thumbnailKey, thumbBuffer, 'image/jpeg');
        } catch (thumbErr) {
          console.error('Thumbnail generation failed:', thumbErr.message);
        }
      }

      // Insert attachment record
      const result = await db.query(
        `INSERT INTO attachments (message_id, filename, content_type, size_bytes, s3_key, s3_bucket, scan_status, thumbnail_s3_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [messageId, file.originalname, file.mimetype, file.size, s3Key, config.s3.bucket, scanStatus, thumbnailKey]
      );

      attachments.push(result.rows[0]);
    }

    res.status(201).json({ attachments });
  } catch (err) {
    if (err.message && err.message.includes('not allowed')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Error uploading attachment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/attachments/:id/download
router.get('/attachments/:id/download', async (req, res) => {
  try {
    const userId = req.user.id;
    const attachmentId = req.params.id;

    // Verify access
    const result = await db.query(
      `SELECT a.* FROM attachments a
       JOIN messages m ON m.id = a.message_id
       JOIN conversations c ON c.id = m.conversation_id
       WHERE a.id = $1 AND (c.advisor_id = $2 OR c.client_id = $2)`,
      [attachmentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = result.rows[0];

    if (attachment.scan_status !== 'clean') {
      return res.status(403).json({ error: 'File not available — scan pending or infected' });
    }

    // DEF-005: Audit log for download (compliance: PRD US-5 AC-4)
    await db.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata, created_at)
       VALUES ($1, 'download', 'attachment', $2, $3, NOW())`,
      [userId, attachmentId, JSON.stringify({
        filename: attachment.filename,
        content_type: attachment.content_type,
        size_bytes: attachment.size_bytes,
        s3_key: attachment.s3_key,
      })]
    );

    // Generate signed URL (1hr TTL)
    const signedUrl = await getSignedDownloadUrl(attachment.s3_key, 3600);

    res.redirect(302, signedUrl);
  } catch (err) {
    console.error('Error downloading attachment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
