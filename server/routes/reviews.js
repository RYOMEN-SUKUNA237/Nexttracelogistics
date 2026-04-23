const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// ─── ENSURE TABLE EXISTS ─────────────────────────────────────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        email VARCHAR(200) NOT NULL,
        role VARCHAR(200) DEFAULT 'Verified Customer',
        avatar TEXT,
        text TEXT NOT NULL,
        rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
        status VARCHAR(20) DEFAULT 'pending',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        approved_at TIMESTAMP
      )
    `);
    console.log('✅ Reviews table ready');
  } catch (err) {
    console.error('❌ Reviews table creation error:', err.message);
  }
})();

// ─── PUBLIC: Submit a review (goes to pending) ───────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, email, role, text, rating } = req.body;

    if (!name || !email || !text) {
      return res.status(400).json({ error: 'Name, email, and review text are required.' });
    }

    if (text.length < 20) {
      return res.status(400).json({ error: 'Review must be at least 20 characters.' });
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    const ratingVal = Math.min(5, Math.max(1, parseInt(rating) || 5));
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0a192f&color=fff&size=100`;

    const result = await pool.query(
      `INSERT INTO reviews (name, email, role, avatar, text, rating, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id, name, created_at`,
      [name, email, role || 'Verified Customer', avatar, text, ratingVal]
    );

    res.status(201).json({
      message: 'Thank you! Your review has been submitted and is pending admin approval.',
      review: result.rows[0],
    });
  } catch (err) {
    console.error('Review submit error:', err.message);
    res.status(500).json({ error: 'Failed to submit review.' });
  }
});

// ─── PUBLIC: Get approved reviews only ───────────────────────────────
router.get('/approved', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, role, avatar, text, rating, created_at
       FROM reviews WHERE status = 'approved'
       ORDER BY approved_at DESC, created_at DESC`
    );
    res.json({ reviews: result.rows });
  } catch (err) {
    console.error('Fetch approved reviews error:', err.message);
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

// ─── ADMIN: Get all reviews (with status filter) ─────────────────────
router.get('/admin', authenticateToken, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = 'SELECT * FROM reviews';
    const params = [];
    const conditions = [];

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR text ILIKE $${params.length})`);
    }

    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    // Get counts
    const countResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) as total
      FROM reviews
    `);

    res.json({
      reviews: result.rows,
      counts: countResult.rows[0],
    });
  } catch (err) {
    console.error('Admin reviews list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

// ─── ADMIN: Approve a review ─────────────────────────────────────────
router.patch('/admin/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE reviews SET status = 'approved', approved_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Review not found.' });
    res.json({ message: 'Review approved and published.', review: result.rows[0] });
  } catch (err) {
    console.error('Approve review error:', err.message);
    res.status(500).json({ error: 'Failed to approve review.' });
  }
});

// ─── ADMIN: Reject a review ──────────────────────────────────────────
router.patch('/admin/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;
    const result = await pool.query(
      `UPDATE reviews SET status = 'rejected', admin_notes = $2 WHERE id = $1 RETURNING *`,
      [id, admin_notes || null]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Review not found.' });
    res.json({ message: 'Review rejected.', review: result.rows[0] });
  } catch (err) {
    console.error('Reject review error:', err.message);
    res.status(500).json({ error: 'Failed to reject review.' });
  }
});

// ─── ADMIN: Delete a review ──────────────────────────────────────────
router.delete('/admin/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM reviews WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Review not found.' });
    res.json({ message: 'Review deleted permanently.' });
  } catch (err) {
    console.error('Delete review error:', err.message);
    res.status(500).json({ error: 'Failed to delete review.' });
  }
});

module.exports = router;
