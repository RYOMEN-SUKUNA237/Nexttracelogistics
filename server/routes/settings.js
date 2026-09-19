const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getNotificationPrefs, saveNotificationPrefs } = require('../utils/notify');

const router = express.Router();

// Ensure the site_settings table exists (runs once on first request)
let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  tableReady = true;
}

// Default values
const DEFAULTS = {
  company_name:    'Next Trace Logistics',
  company_email:   'support@nexttracelogistics.com',
  company_phone:   '+1 (412) 227-3484',
  company_address: 'Wyoming',
  company_tax_id:  '',
  company_website: 'https://nexttracelogistics.com',
};

// GET /api/settings/company — public (used by email templates etc.)
router.get('/company', async (req, res) => {
  try {
    await ensureTable();
    const { rows } = await pool.query('SELECT key, value FROM site_settings');
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });
    // Merge with defaults so all keys are always present
    const result = {};
    Object.keys(DEFAULTS).forEach(k => {
      result[k] = map[k] !== undefined ? map[k] : DEFAULTS[k];
    });
    res.json(result);
  } catch (err) {
    console.error('GET /settings/company error:', err);
    res.status(500).json({ error: 'Failed to load company settings.' });
  }
});

// PUT /api/settings/company — admin only
router.put('/company', authMiddleware, async (req, res) => {
  try {
    await ensureTable();
    const allowed = Object.keys(DEFAULTS);
    const updates = {};
    allowed.forEach(k => {
      if (req.body[k] !== undefined) updates[k] = String(req.body[k]).trim().slice(0, 500);
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided.' });
    }

    // Upsert each key
    for (const [key, value] of Object.entries(updates)) {
      await pool.query(
        `INSERT INTO site_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      );
    }

    // Return the full updated settings
    const { rows } = await pool.query('SELECT key, value FROM site_settings');
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });
    const result = {};
    Object.keys(DEFAULTS).forEach(k => {
      result[k] = map[k] !== undefined ? map[k] : DEFAULTS[k];
    });

    res.json(result);
  } catch (err) {
    console.error('PUT /settings/company error:', err);
    res.status(500).json({ error: 'Failed to save company settings.' });
  }
});

// GET /api/settings/notifications — admin bell notification preferences
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    res.json({ prefs: await getNotificationPrefs() });
  } catch (err) {
    console.error('GET /settings/notifications error:', err);
    res.status(500).json({ error: 'Failed to load notification preferences.' });
  }
});

// PUT /api/settings/notifications
router.put('/notifications', authMiddleware, async (req, res) => {
  try {
    const prefs = req.body && typeof req.body === 'object' ? req.body : {};
    res.json({ prefs: await saveNotificationPrefs(prefs) });
  } catch (err) {
    console.error('PUT /settings/notifications error:', err);
    res.status(500).json({ error: 'Failed to save notification preferences.' });
  }
});

module.exports = router;
