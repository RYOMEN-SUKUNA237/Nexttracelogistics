const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

function sanitize(str, maxLen = 255) {
  if (typeof str !== 'string') return str;
  return str.trim().slice(0, maxLen);
}

// ─── PUBLIC: Submit a quote request ─────────────────────────────
router.post('/', async (req, res) => {
  try {
    const full_name = sanitize(req.body.full_name, 100);
    const company = sanitize(req.body.company, 100);
    const email = sanitize(req.body.email, 100);
    const phone = sanitize(req.body.phone, 30);
    const service_type = sanitize(req.body.service_type, 100);
    const details = sanitize(req.body.details, 2000);

    if (!full_name || !email || !service_type) {
      return res.status(400).json({ error: 'Full name, email, and service type are required.' });
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    const { rows } = await pool.query(`
      INSERT INTO quotes (full_name, company, email, phone, service_type, details)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [full_name, company || null, email, phone || null, service_type, details || null]);

    res.status(201).json({
      success: true,
      message: 'Your quote request has been submitted successfully. Our team will contact you shortly.',
      quote_id: rows[0].id,
    });
  } catch (err) {
    console.error('Error submitting quote:', err);
    res.status(500).json({ error: 'Failed to submit quote request.' });
  }
});

// ─── ADMIN: List all quotes ─────────────────────────────────────────
router.get('/admin', authMiddleware, async (req, res) => {
  try {
    const { status, service_type, search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = '1=1';
    const params = [];

    if (status) {
      params.push(status);
      where += ` AND q.status = $${params.length}`;
    }
    if (service_type) {
      params.push(service_type);
      where += ` AND q.service_type = $${params.length}`;
    }
    if (search) {
      const s = `%${search}%`;
      params.push(s, s, s);
      const n = params.length;
      where += ` AND (q.full_name ILIKE $${n-2} OR q.email ILIKE $${n-1} OR q.company ILIKE $${n})`;
    }

    const { rows: countRows } = await pool.query(`SELECT COUNT(*) as total FROM quotes q WHERE ${where}`, params);
    const total = parseInt(countRows[0].total);

    params.push(parseInt(limit), offset);
    const { rows: quotes } = await pool.query(`
      SELECT q.* FROM quotes q
      WHERE ${where}
      ORDER BY q.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({
      quotes,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Error listing quotes:', err);
    res.status(500).json({ error: 'Failed to fetch quotes.' });
  }
});

// ─── ADMIN: Get single quote ────────────────────────────────────────
router.get('/admin/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Quote not found.' });
    res.json({ quote: rows[0] });
  } catch (err) {
    console.error('Error fetching quote:', err);
    res.status(500).json({ error: 'Failed to fetch quote.' });
  }
});

// ─── ADMIN: Update quote status ─────────────────────────────────────
router.patch('/admin/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    const validStatuses = ['new', 'reviewing', 'quoted', 'accepted', 'rejected', 'closed'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const { rows: existing } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Quote not found.' });

    const setClauses = ['status = $1'];
    const params = [status];
    let idx = 2;

    if (admin_notes !== undefined) {
      setClauses.push(`admin_notes = $${idx++}`);
      params.push(admin_notes);
    }

    if (['quoted', 'accepted', 'rejected', 'closed'].includes(status)) {
      setClauses.push(`processed_by = $${idx++}`);
      params.push(req.user.full_name || req.user.username || req.user.email || 'admin');
      setClauses.push('processed_at = NOW()');
    }

    params.push(req.params.id);
    await pool.query(`UPDATE quotes SET ${setClauses.join(', ')} WHERE id = $${idx}`, params);

    const { rows: updated } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    res.json({ success: true, quote: updated[0] });
  } catch (err) {
    console.error('Error updating quote:', err);
    res.status(500).json({ error: 'Failed to update quote.' });
  }
});

// ─── ADMIN: Add notes to quote ──────────────────────────────────────
router.patch('/admin/:id/notes', authMiddleware, async (req, res) => {
  try {
    const { admin_notes } = req.body;
    if (admin_notes === undefined) {
      return res.status(400).json({ error: 'admin_notes is required.' });
    }

    const { rows: existing } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Quote not found.' });

    await pool.query('UPDATE quotes SET admin_notes = $1 WHERE id = $2', [admin_notes, req.params.id]);
    const { rows: updated } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    res.json({ success: true, quote: updated[0] });
  } catch (err) {
    console.error('Error updating quote notes:', err);
    res.status(500).json({ error: 'Failed to update quote notes.' });
  }
});

// ─── ADMIN: Delete quote ────────────────────────────────────────────
router.delete('/admin/:id', authMiddleware, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Quote not found.' });

    await pool.query('DELETE FROM quotes WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Quote deleted.' });
  } catch (err) {
    console.error('Error deleting quote:', err);
    res.status(500).json({ error: 'Failed to delete quote.' });
  }
});

// ─── ADMIN: Get quote stats ────────────────────────────────────────
router.get('/admin-stats', authMiddleware, async (req, res) => {
  try {
    const { rows: [stats] } = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) as reviewing_count,
        SUM(CASE WHEN status = 'quoted' THEN 1 ELSE 0 END) as quoted_count,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_count,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count
      FROM quotes
    `);

    // Convert string counts to numbers
    const numStats = {};
    for (const [k, v] of Object.entries(stats)) {
      numStats[k] = parseInt(v) || 0;
    }

    res.json({ stats: numStats });
  } catch (err) {
    console.error('Error fetching quote stats:', err);
    res.status(500).json({ error: 'Failed to fetch quote stats.' });
  }
});

module.exports = router;
