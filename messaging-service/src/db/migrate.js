/**
 * T-070 US-070-04: Database Schema Migration
 * PostgreSQL tables: conversations, messages, message_receipts, attachments
 * Row-level security, append-only, JSONB metadata, proper indexes
 */
const { Pool } = require('pg');
const config = require('../config');

const MIGRATION_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CONVERSATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advisor_id UUID NOT NULL,
  client_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count_advisor INT NOT NULL DEFAULT 0,
  unread_count_client INT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  UNIQUE(advisor_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_advisor ON conversations(advisor_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_client ON conversations(client_id, last_message_at DESC);

-- ============================================================
-- MESSAGES TABLE (append-only for compliance)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  sequence_id BIGSERIAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  content_hash TEXT GENERATED ALWAYS AS (encode(digest(content, 'sha256'), 'hex')) STORED
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_seq ON messages(conversation_id, sequence_id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at DESC);

-- Prevent UPDATE and DELETE on messages (compliance: append-only)
CREATE OR REPLACE FUNCTION prevent_message_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Messages are immutable for compliance. Edit and delete operations are not permitted.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_message_update ON messages;
CREATE TRIGGER no_message_update
  BEFORE UPDATE OR DELETE ON messages
  FOR EACH ROW EXECUTE FUNCTION prevent_message_mutation();

-- ============================================================
-- MESSAGE_RECEIPTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS message_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id),
  user_id UUID NOT NULL,
  state VARCHAR(10) NOT NULL DEFAULT 'sent' CHECK (state IN ('sent', 'delivered', 'read')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_receipts_message ON message_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user ON message_receipts(user_id, updated_at DESC);

-- ============================================================
-- ATTACHMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id),
  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  s3_key TEXT NOT NULL,
  s3_bucket TEXT NOT NULL,
  encryption_key_id TEXT,
  scan_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'infected', 'error')),
  thumbnail_s3_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_scan ON attachments(scan_status) WHERE scan_status = 'pending';

-- ============================================================
-- ROW-LEVEL SECURITY (advisor-client isolation)
-- ============================================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own conversations
-- (applied when connecting as a non-superuser role)
DROP POLICY IF EXISTS conversations_isolation ON conversations;
CREATE POLICY conversations_isolation ON conversations
  USING (advisor_id = current_setting('app.current_user_id')::UUID
      OR client_id = current_setting('app.current_user_id')::UUID);

DROP POLICY IF EXISTS messages_isolation ON messages;
CREATE POLICY messages_isolation ON messages
  USING (conversation_id IN (
    SELECT id FROM conversations
    WHERE advisor_id = current_setting('app.current_user_id')::UUID
       OR client_id = current_setting('app.current_user_id')::UUID
  ));

DROP POLICY IF EXISTS receipts_isolation ON message_receipts;
CREATE POLICY receipts_isolation ON message_receipts
  USING (message_id IN (
    SELECT m.id FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE c.advisor_id = current_setting('app.current_user_id')::UUID
       OR c.client_id = current_setting('app.current_user_id')::UUID
  ));

DROP POLICY IF EXISTS attachments_isolation ON attachments;
CREATE POLICY attachments_isolation ON attachments
  USING (message_id IN (
    SELECT m.id FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE c.advisor_id = current_setting('app.current_user_id')::UUID
       OR c.client_id = current_setting('app.current_user_id')::UUID
  ));

-- ============================================================
-- HELPER: Update conversation on new message
-- ============================================================
CREATE OR REPLACE FUNCTION update_conversation_on_message() RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100)
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_conversation ON messages;
CREATE TRIGGER trg_update_conversation
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================
-- DEF-006: Protect last_message_preview from being nullified/deleted
-- Prevent setting last_message_preview to NULL or empty once set
-- ============================================================
CREATE OR REPLACE FUNCTION protect_message_preview() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.last_message_preview IS NOT NULL AND (NEW.last_message_preview IS NULL OR NEW.last_message_preview = '') THEN
    NEW.last_message_preview := OLD.last_message_preview;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_message_preview ON conversations;
CREATE TRIGGER trg_protect_message_preview
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION protect_message_preview();

-- ============================================================
-- DEF-005: Audit logs table for compliance
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
`;

async function migrate() {
  const pool = new Pool({ connectionString: config.database.url });
  try {
    console.log('Running T-070 database migration...');
    await pool.query(MIGRATION_SQL);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Export for testing
module.exports = { MIGRATION_SQL, migrate };

if (require.main === module) {
  migrate();
}
