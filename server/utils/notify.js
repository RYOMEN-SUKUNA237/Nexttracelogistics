/**
 * Admin bell notifications, filtered by the preferences saved in
 * Settings → Notifications (site_settings key `admin_notification_prefs`).
 */
const { pool } = require('../db');

const PREF_KEY = 'admin_notification_prefs';
const DEFAULT_PREFS = {
  courier_registered: true,
  customer_registered: true,
  shipment_status: true,
  shipment_paused: true,
  shipment_delivered: true,
};

let cache = null;
let cachedAt = 0;

async function ensureSettingsTable() {
  await pool.query('CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
}

async function getNotificationPrefs() {
  if (cache && Date.now() - cachedAt < 30000) return cache;
  try {
    await ensureSettingsTable();
    const { rows } = await pool.query('SELECT value FROM site_settings WHERE key = $1', [PREF_KEY]);
    const saved = rows[0] ? JSON.parse(rows[0].value) : {};
    cache = { ...DEFAULT_PREFS, ...saved };
  } catch (err) {
    console.error('Notification prefs load failed:', err.message);
    cache = { ...DEFAULT_PREFS };
  }
  cachedAt = Date.now();
  return cache;
}

async function saveNotificationPrefs(prefs) {
  const clean = {};
  for (const key of Object.keys(DEFAULT_PREFS)) {
    if (prefs[key] !== undefined) clean[key] = !!prefs[key];
  }
  const merged = { ...(await getNotificationPrefs()), ...clean };
  await ensureSettingsTable();
  await pool.query(
    `INSERT INTO site_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [PREF_KEY, JSON.stringify(merged)]
  );
  cache = merged;
  cachedAt = Date.now();
  return merged;
}

/** Insert a bell notification unless the admin switched this category off. */
async function notify(category, title, message, type = 'info', link = null) {
  const prefs = await getNotificationPrefs();
  if (category && prefs[category] === false) return;
  await pool.query('INSERT INTO notifications (title, message, type, link) VALUES ($1, $2, $3, $4)', [title, message, type, link]);
}

module.exports = { notify, getNotificationPrefs, saveNotificationPrefs, DEFAULT_PREFS };
