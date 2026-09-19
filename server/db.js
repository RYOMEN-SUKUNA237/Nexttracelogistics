const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires SSL; the local test database (local-dev/) does not support it.
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => console.log(`✅ Connected to PostgreSQL (${process.env.DATABASE_SSL === 'false' ? 'local' : 'Supabase'})`))
  .catch(err => console.error('❌ PostgreSQL connection error:', err.message));

module.exports = { pool, supabase };
