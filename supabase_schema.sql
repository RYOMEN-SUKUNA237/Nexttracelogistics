-- ============================================================
-- NEXT TRACE LOGISTICS — COMPLETE SUPABASE POSTGRESQL SCHEMA
-- Run this in the Supabase SQL Editor for project fdtchmevoksettmzbkwx
-- ============================================================

-- ─── EXTENSIONS ────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── AUTO-UPDATE TIMESTAMP FUNCTION ───────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- USERS (admin accounts — legacy; main auth is Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          BIGSERIAL PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  role        TEXT DEFAULT 'admin',
  avatar      TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COURIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS couriers (
  id                BIGSERIAL PRIMARY KEY,
  courier_id        TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  email             TEXT UNIQUE NOT NULL,
  phone             TEXT,
  vehicle_type      TEXT DEFAULT 'van',
  license_plate     TEXT,
  zone              TEXT,
  status            TEXT DEFAULT 'inactive',
  total_deliveries  INT DEFAULT 0,
  rating            DECIMAL(3,1) DEFAULT 5.0,
  avatar            TEXT,
  emergency_contact TEXT,
  date_of_birth     TEXT,
  national_id       TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER couriers_updated_at
  BEFORE UPDATE ON couriers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id            BIGSERIAL PRIMARY KEY,
  customer_id   TEXT UNIQUE NOT NULL,
  company_name  TEXT,
  contact_name  TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  country       TEXT DEFAULT 'US',
  postal_code   TEXT,
  type          TEXT DEFAULT 'individual',
  status        TEXT DEFAULT 'active',
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SHIPMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS shipments (
  id                  BIGSERIAL PRIMARY KEY,
  tracking_id         TEXT UNIQUE NOT NULL,
  sender_name         TEXT NOT NULL,
  sender_email        TEXT,
  sender_phone        TEXT,
  receiver_name       TEXT NOT NULL,
  receiver_email      TEXT,
  receiver_phone      TEXT,
  origin              TEXT NOT NULL,
  destination         TEXT NOT NULL,
  origin_lat          DECIMAL,
  origin_lng          DECIMAL,
  dest_lat            DECIMAL,
  dest_lng            DECIMAL,
  current_lat         DECIMAL,
  current_lng         DECIMAL,
  status              TEXT DEFAULT 'pending',
  courier_id          TEXT,
  customer_id         TEXT,
  weight              TEXT,
  dimensions          TEXT,
  cargo_type          TEXT DEFAULT 'General',
  progress            DECIMAL DEFAULT 0,
  is_paused           BOOLEAN DEFAULT FALSE,
  description         TEXT,
  declared_value      TEXT,
  insurance           BOOLEAN DEFAULT FALSE,
  estimated_delivery  TEXT,
  actual_delivery     TEXT,
  special_instructions TEXT,
  route_data          JSONB,
  transport_modes     JSONB,
  route_distance      DECIMAL,
  route_duration      DECIMAL,
  route_summary       TEXT,
  departed_at         TIMESTAMPTZ,
  paused_at           TIMESTAMPTZ,
  total_paused_ms     BIGINT DEFAULT 0,
  pause_category      TEXT,
  pause_reason        TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRACKING HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS tracking_history (
  id          BIGSERIAL PRIMARY KEY,
  shipment_id BIGINT REFERENCES shipments(id) ON DELETE CASCADE,
  tracking_id TEXT NOT NULL,
  status      TEXT NOT NULL,
  location    TEXT,
  lat         DECIMAL,
  lng         DECIMAL,
  notes       TEXT,
  updated_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_history_tracking_id ON tracking_history(tracking_id);
CREATE INDEX IF NOT EXISTS idx_tracking_history_shipment_id ON tracking_history(shipment_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         BIGSERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT DEFAULT 'info',
  link       TEXT,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONVERSATIONS (live chat)
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id               BIGSERIAL PRIMARY KEY,
  visitor_id       TEXT NOT NULL,
  visitor_name     TEXT DEFAULT 'Visitor',
  visitor_email    TEXT,
  subject          TEXT,
  status           TEXT DEFAULT 'open',
  unread_count     INT DEFAULT 0,
  last_message_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_visitor_id ON conversations(visitor_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

-- ============================================================
-- CHAT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_type     TEXT NOT NULL,  -- 'visitor' | 'admin'
  sender_name     TEXT,
  content         TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);

-- ============================================================
-- QUOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
  id            BIGSERIAL PRIMARY KEY,
  full_name     TEXT NOT NULL,
  company       TEXT,
  email         TEXT NOT NULL,
  phone         TEXT,
  service_type  TEXT NOT NULL,
  details       TEXT,
  status        TEXT DEFAULT 'new',
  admin_notes   TEXT,
  processed_by  TEXT,
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_email ON quotes(email);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT DEFAULT 'Verified Customer',
  avatar      TEXT,
  text        TEXT NOT NULL,
  rating      INT DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  status      TEXT DEFAULT 'pending',
  admin_notes TEXT,
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);

-- ============================================================
-- EMAIL DRAFTS
-- ============================================================
CREATE TABLE IF NOT EXISTS email_drafts (
  id                       BIGSERIAL PRIMARY KEY,
  type                     TEXT NOT NULL DEFAULT 'tracking_update',
  recipient_email          TEXT NOT NULL,
  recipient_name           TEXT,
  subject                  TEXT NOT NULL,
  html_body                TEXT NOT NULL,
  text_body                TEXT,
  status                   TEXT DEFAULT 'draft',
  related_tracking_id      TEXT,
  related_conversation_id  BIGINT,
  metadata                 JSONB DEFAULT '{}',
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  sent_at                  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_tracking_id ON email_drafts(related_tracking_id);

-- ============================================================
-- TRACKING SUBSCRIBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS tracking_subscribers (
  id            BIGSERIAL PRIMARY KEY,
  tracking_id   TEXT NOT NULL,
  email         TEXT NOT NULL,
  name          TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tracking_id, email)
);

CREATE INDEX IF NOT EXISTS idx_tracking_subscribers_tracking_id ON tracking_subscribers(tracking_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Service role bypasses these
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (used by backend server)
CREATE POLICY "service_role_full_access_users" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_couriers" ON couriers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_customers" ON customers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_shipments" ON shipments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_tracking_history" ON tracking_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_notifications" ON notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_conversations" ON conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_chat_messages" ON chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_quotes" ON quotes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_reviews" ON reviews FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_email_drafts" ON email_drafts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_tracking_subscribers" ON tracking_subscribers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow anon to read approved reviews and submit quotes/reviews
CREATE POLICY "anon_read_approved_reviews" ON reviews FOR SELECT TO anon USING (status = 'approved');
CREATE POLICY "anon_insert_reviews" ON reviews FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_quotes" ON quotes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_read_shipments_tracking" ON shipments FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_tracking_history" ON tracking_history FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_conversations" ON conversations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_conversations" ON conversations FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_chat_messages" ON chat_messages FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_chat_messages" ON chat_messages FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_tracking_subscribers" ON tracking_subscribers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_tracking_subscribers" ON tracking_subscribers FOR UPDATE TO anon USING (true);
