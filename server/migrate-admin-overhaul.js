/**
 * One-off migration for the admin simulation overhaul.
 * The shipments API also applies these on first use, so running this script
 * is optional — it simply lets you upgrade the database ahead of deployment.
 *
 *   node migrate-admin-overhaul.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('./db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS multi_modal_segments JSONB;
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS multi_modal_stops JSONB;
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS pet_details JSONB;
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS status_before_pause TEXT;
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS timeline_events JSONB;
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS eta_overridden BOOLEAN DEFAULT FALSE;
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS route_mode TEXT;
      CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    console.log('✅ Admin overhaul columns are in place.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
