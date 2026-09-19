const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { notify } = require('../utils/notify');
const { generateCustomerId } = require('../utils/generators');

const router = express.Router();

// GET /api/customers — List all customers
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, search, type, page = 1, limit = 50 } = req.query;
    let query = 'SELECT * FROM customers WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM customers WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      query += ` AND status = $${params.length}`;
      countQuery += ` AND status = $${params.length}`;
    }

    if (type && type !== 'all') {
      params.push(type);
      query += ` AND type = $${params.length}`;
      countQuery += ` AND type = $${params.length}`;
    }

    if (search) {
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
      const n = params.length;
      query += ` AND (contact_name ILIKE $${n-4} OR company_name ILIKE $${n-3} OR customer_id ILIKE $${n-2} OR email ILIKE $${n-1} OR phone ILIKE $${n})`;
      countQuery += ` AND (contact_name ILIKE $${n-4} OR company_name ILIKE $${n-3} OR customer_id ILIKE $${n-2} OR email ILIKE $${n-1} OR phone ILIKE $${n})`;
    }

    const { rows: countRows } = await pool.query(countQuery, params);
    const total = parseInt(countRows[0].total);

    query += ' ORDER BY created_at DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows: customers } = await pool.query(query, params);

    res.json({
      customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('List customers error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/customers/:id — Get single customer
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM customers WHERE id::text = $1 OR customer_id = $1', [req.params.id]);
    const customer = rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    // Get customer shipments
    const { rows: shipments } = await pool.query('SELECT * FROM shipments WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20', [customer.customer_id]);

    res.json({ customer, shipments });
  } catch (err) {
    console.error('Get customer error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/customers — Register new customer
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { contact_name, company_name, email, phone, address, city, state, country, postal_code, type, notes } = req.body;

    if (!contact_name || !email || !phone) {
      return res.status(400).json({ error: 'contact_name, email, and phone are required.' });
    }

    const { rows: existing } = await pool.query('SELECT id FROM customers WHERE email = $1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'A customer with this email already exists.' });
    }

    // Generate unique customer ID
    let customerId;
    let attempts = 0;
    do {
      customerId = generateCustomerId();
      const { rows: dup } = await pool.query('SELECT id FROM customers WHERE customer_id = $1', [customerId]);
      if (dup.length === 0) break;
      attempts++;
    } while (attempts < 10);

    const { rows: inserted } = await pool.query(`
      INSERT INTO customers (customer_id, contact_name, company_name, email, phone, address, city, state, country, postal_code, type, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *
    `, [
      customerId, contact_name, company_name || null, email, phone,
      address || null, city || null, state || null, country || 'US',
      postal_code || null, type || 'individual', notes || null
    ]);

    const customer = inserted[0];

    await notify('customer_registered', 'New Customer Registered', `${contact_name} (${customerId}) has been registered.`, 'info');

    res.status(201).json({ customer });
  } catch (err) {
    console.error('Register customer error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/customers/:id — Update customer
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM customers WHERE id::text = $1 OR customer_id = $1', [req.params.id]);
    const customer = rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    const required = ['contact_name', 'email', 'phone', 'country'];
    const optional = ['company_name', 'address', 'city', 'state', 'postal_code', 'notes'];
    const updates = {};
    for (const key of required) {
      if (req.body[key] === undefined) continue;
      const v = String(req.body[key]).trim();
      if (!v) return res.status(400).json({ error: `${key.replace('_', ' ')} cannot be empty.` });
      updates[key] = v;
    }
    for (const key of optional) {
      if (req.body[key] === undefined) continue;
      updates[key] = req.body[key] === null ? null : String(req.body[key]).trim() || null;
    }
    if (req.body.type !== undefined) {
      if (!['individual', 'business'].includes(req.body.type)) return res.status(400).json({ error: 'Invalid customer type.' });
      updates.type = req.body.type;
    }
    if (req.body.status !== undefined) {
      if (!['active', 'inactive'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status.' });
      updates.status = req.body.status;
    }
    if (updates.email && updates.email.toLowerCase() !== String(customer.email).toLowerCase()) {
      const { rows: dup } = await pool.query('SELECT id FROM customers WHERE LOWER(email) = LOWER($1) AND id <> $2', [updates.email, customer.id]);
      if (dup.length) return res.status(409).json({ error: 'Another customer already uses this email.' });
    }

    const keys = Object.keys(updates);
    if (keys.length > 0) {
      await pool.query(
        `UPDATE customers SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1}`,
        [...keys.map((k) => updates[k]), customer.id]
      );
    }

    const { rows: updated } = await pool.query('SELECT * FROM customers WHERE id = $1', [customer.id]);
    res.json({ customer: updated[0] });
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/customers/:id — Delete customer
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM customers WHERE id::text = $1 OR customer_id = $1', [req.params.id]);
    const customer = rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    await pool.query('DELETE FROM customers WHERE id = $1', [customer.id]);
    res.json({ message: 'Customer deleted successfully.' });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
