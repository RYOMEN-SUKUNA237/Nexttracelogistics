const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { notify } = require('../utils/notify');
const { generateCourierId } = require('../utils/generators');

const router = express.Router();

// GET /api/couriers — List all couriers
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    let query = 'SELECT * FROM couriers WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM couriers WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      query += ` AND status = $${params.length}`;
      countQuery += ` AND status = $${params.length}`;
    }

    if (search) {
      const s = `%${search}%`;
      params.push(s, s, s, s);
      const n = params.length;
      query += ` AND (name ILIKE $${n-3} OR courier_id ILIKE $${n-2} OR zone ILIKE $${n-1} OR email ILIKE $${n})`;
      countQuery += ` AND (name ILIKE $${n-3} OR courier_id ILIKE $${n-2} OR zone ILIKE $${n-1} OR email ILIKE $${n})`;
    }

    const { rows: countRows } = await pool.query(countQuery, params);
    const total = parseInt(countRows[0].total);

    query += ' ORDER BY created_at DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows: couriers } = await pool.query(query, params);

    res.json({
      couriers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('List couriers error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/couriers/:id — Get single courier
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM couriers WHERE id::text = $1 OR courier_id = $1', [req.params.id]);
    const courier = rows[0];
    if (!courier) return res.status(404).json({ error: 'Courier not found.' });

    // Get assigned shipments
    const { rows: shipments } = await pool.query('SELECT * FROM shipments WHERE courier_id = $1 ORDER BY created_at DESC LIMIT 20', [courier.courier_id]);

    res.json({ courier, shipments });
  } catch (err) {
    console.error('Get courier error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/couriers — Register new courier
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, email, phone, vehicle_type, license_plate, zone, emergency_contact, date_of_birth, national_id, notes } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'name, email, and phone are required.' });
    }

    const { rows: existing } = await pool.query('SELECT id FROM couriers WHERE email = $1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'A courier with this email already exists.' });
    }

    // Generate unique courier ID
    let courierId;
    let attempts = 0;
    do {
      courierId = generateCourierId();
      const { rows: dup } = await pool.query('SELECT id FROM couriers WHERE courier_id = $1', [courierId]);
      if (dup.length === 0) break;
      attempts++;
    } while (attempts < 10);

    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0a192f&color=fff&size=100`;

    const { rows: inserted } = await pool.query(`
      INSERT INTO couriers (courier_id, name, email, phone, vehicle_type, license_plate, zone, avatar, emergency_contact, date_of_birth, national_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *
    `, [
      courierId, name, email, phone,
      vehicle_type || 'van', license_plate || null, zone || null, avatar,
      emergency_contact || null, date_of_birth || null, national_id || null, notes || null
    ]);

    const courier = inserted[0];

    // Create notification
    await notify('courier_registered', 'New Courier Registered', `${name} (${courierId}) has been registered as a new courier.`, 'success', `/couriers/${courierId}`);

    res.status(201).json({ courier });
  } catch (err) {
    console.error('Register courier error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/couriers/:id — Update courier
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM couriers WHERE id::text = $1 OR courier_id = $1', [req.params.id]);
    const courier = rows[0];
    if (!courier) return res.status(404).json({ error: 'Courier not found.' });

    const required = ['name', 'email', 'phone'];
    const optional = ['license_plate', 'zone', 'emergency_contact', 'notes'];
    const updates = {};
    for (const key of required) {
      if (req.body[key] === undefined) continue;
      const v = String(req.body[key]).trim();
      if (!v) return res.status(400).json({ error: `${key} cannot be empty.` });
      updates[key] = v;
    }
    for (const key of optional) {
      if (req.body[key] === undefined) continue;
      updates[key] = req.body[key] === null ? null : String(req.body[key]).trim() || null;
    }
    if (req.body.vehicle_type !== undefined) {
      if (!['motorcycle', 'bicycle', 'car', 'van', 'truck'].includes(req.body.vehicle_type)) {
        return res.status(400).json({ error: 'Invalid vehicle type.' });
      }
      updates.vehicle_type = req.body.vehicle_type;
    }
    if (req.body.status !== undefined) {
      if (!['active', 'inactive', 'on-delivery', 'on-break'].includes(req.body.status)) {
        return res.status(400).json({ error: 'Invalid status.' });
      }
      updates.status = req.body.status;
    }
    if (updates.email && updates.email.toLowerCase() !== String(courier.email).toLowerCase()) {
      const { rows: dup } = await pool.query('SELECT id FROM couriers WHERE LOWER(email) = LOWER($1) AND id <> $2', [updates.email, courier.id]);
      if (dup.length) return res.status(409).json({ error: 'Another courier already uses this email.' });
    }
    if (updates.name && updates.name !== courier.name) {
      updates.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(updates.name)}&background=0a192f&color=fff&size=100`;
    }

    const keys = Object.keys(updates);
    if (keys.length > 0) {
      await pool.query(
        `UPDATE couriers SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1}`,
        [...keys.map((k) => updates[k]), courier.id]
      );
    }

    const { rows: updated } = await pool.query('SELECT * FROM couriers WHERE id = $1', [courier.id]);
    res.json({ courier: updated[0] });
  } catch (err) {
    console.error('Update courier error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/couriers/:id — Delete courier
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM couriers WHERE id::text = $1 OR courier_id = $1', [req.params.id]);
    const courier = rows[0];
    if (!courier) return res.status(404).json({ error: 'Courier not found.' });

    // Unassign from active shipments
    await pool.query("UPDATE shipments SET courier_id = NULL WHERE courier_id = $1 AND status NOT IN ('delivered', 'returned')", [courier.courier_id]);

    await pool.query('DELETE FROM couriers WHERE id = $1', [courier.id]);
    res.json({ message: 'Courier deleted successfully.' });
  } catch (err) {
    console.error('Delete courier error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/couriers/:id/status — Toggle courier status
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM couriers WHERE id::text = $1 OR courier_id = $1', [req.params.id]);
    const courier = rows[0];
    if (!courier) return res.status(404).json({ error: 'Courier not found.' });

    const { status } = req.body;
    if (!['active', 'inactive', 'on-delivery', 'on-break'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: active, inactive, on-delivery, on-break.' });
    }

    await pool.query('UPDATE couriers SET status = $1 WHERE id = $2', [status, courier.id]);
    const { rows: updated } = await pool.query('SELECT * FROM couriers WHERE id = $1', [courier.id]);
    res.json({ courier: updated[0] });
  } catch (err) {
    console.error('Toggle courier status error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
