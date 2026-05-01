-- Next Trace Logistics Supabase PostgreSQL Schema

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  avatar TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS couriers (
  id BIGSERIAL PRIMARY KEY,
  courier_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  vehicle_type TEXT,
  license_plate TEXT,
  zone TEXT,
  status TEXT DEFAULT 'inactive',
  total_deliveries INT DEFAULT 0,
  rating DECIMAL(3,1) DEFAULT 5.0,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  customer_id TEXT UNIQUE NOT NULL,
  company_name TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  type TEXT DEFAULT 'individual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipments (
  id BIGSERIAL PRIMARY KEY,
  tracking_id TEXT UNIQUE NOT NULL,
  sender_name TEXT NOT NULL,
  sender_email TEXT,
  sender_phone TEXT,
  receiver_name TEXT NOT NULL,
  receiver_email TEXT,
  receiver_phone TEXT,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  origin_lat DECIMAL,
  origin_lng DECIMAL,
  dest_lat DECIMAL,
  dest_lng DECIMAL,
  current_lat DECIMAL,
  current_lng DECIMAL,
  status TEXT DEFAULT 'pending',
  courier_id TEXT,
  customer_id TEXT,
  weight TEXT,
  dimensions TEXT,
  cargo_type TEXT DEFAULT 'General',
  progress DECIMAL DEFAULT 0,
  is_paused BOOLEAN DEFAULT FALSE,
  description TEXT,
  declared_value TEXT,
  insurance BOOLEAN DEFAULT FALSE,
  estimated_delivery TEXT,
  actual_delivery TEXT,
  special_instructions TEXT,
  route_data JSONB,
  transport_modes JSONB,
  route_distance DECIMAL,
  route_duration DECIMAL,
  route_summary TEXT,
  departed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  total_paused_ms BIGINT DEFAULT 0,
  pause_category TEXT,
  pause_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tracking_history (
  id BIGSERIAL PRIMARY KEY,
  shipment_id BIGINT REFERENCES shipments(id) ON DELETE CASCADE,
  tracking_id TEXT NOT NULL,
  status TEXT NOT NULL,
  location TEXT,
  lat DECIMAL,
  lng DECIMAL,
  notes TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  sender_id TEXT,
  sender_name TEXT,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  weight TEXT,
  cargo_type TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  rating INT NOT NULL,
  text TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_drafts (
  id BIGSERIAL PRIMARY KEY,
  tracking_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tracking_subscribers (
  id BIGSERIAL PRIMARY KEY,
  tracking_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW()
);
