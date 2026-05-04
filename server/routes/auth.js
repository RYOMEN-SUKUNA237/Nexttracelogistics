const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, supabase } = require('../db');
const { authMiddleware, generateToken } = require('../middleware/auth');

const router = express.Router();

// Password strength validator
function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 128) return 'Password must be under 128 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
  return null;
}

// Input sanitizer — trim + limit length
function sanitize(str, maxLen = 255) {
  if (typeof str !== 'string') return str;
  return str.trim().slice(0, maxLen);
}

// POST /api/auth/register — admin-only (must be logged in as admin to create new users)
router.post('/register', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can register new users.' });
    }

    const username = sanitize(req.body.username, 50);
    const email = sanitize(req.body.email, 100);
    const password = req.body.password;
    const full_name = sanitize(req.body.full_name, 100);
    const phone = sanitize(req.body.phone, 30);

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'username, email, password, and full_name are required.' });
    }

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const { rows: existing } = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists.' });
    }

    const hash = await bcrypt.hash(password, 12);

    const { rows: inserted } = await pool.query(
      'INSERT INTO users (username, email, password, full_name, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, full_name, role, created_at',
      [username, email, hash, full_name, phone || null]
    );

    const user = inserted[0];
    const token = generateToken(user);

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const username = sanitize(req.body.username, 100);
    const password = req.body.password;

    if (!username || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Authenticate via Supabase Auth only
    const { data, error } = await supabase.auth.signInWithPassword({
      email: username,
      password: password,
    });

    if (error || !data?.user || !data?.session) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Supabase Auth succeeded
    res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || 'Admin',
        role: 'admin'
      },
      token: data.session.access_token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // Supabase Auth user — fetch live metadata from Supabase
    if (!req.user.username && req.user.email) {
      const { data, error } = await supabase.auth.admin.getUserById(req.user.id);
      const supaUser = data?.user;
      return res.json({
        user: {
          id: req.user.id,
          email: req.user.email,
          full_name: supaUser?.user_metadata?.full_name || supaUser?.email?.split('@')[0] || 'Admin',
          phone: supaUser?.user_metadata?.phone || null,
          role: 'admin',
          created_at: supaUser?.created_at || new Date().toISOString()
        }
      });
    }

    // Legacy JWT user
    const { rows } = await pool.query('SELECT id, username, email, full_name, role, phone, avatar, created_at FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/auth/me
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { full_name, email, phone, avatar } = req.body;

    // Supabase Auth user — update metadata via Supabase Admin API
    if (!req.user.username && req.user.email) {
      const updateData = {};
      if (email) updateData.email = email;
      updateData.data = {
        full_name: full_name || req.user.full_name || 'Admin',
        phone: phone || null,
      };

      const { data, error } = await supabase.auth.admin.updateUserById(req.user.id, updateData);
      if (error) return res.status(500).json({ error: 'Failed to update profile: ' + error.message });

      return res.json({
        user: {
          id: req.user.id,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name || 'Admin',
          phone: data.user.user_metadata?.phone || null,
          role: 'admin',
          created_at: data.user.created_at,
        }
      });
    }

    // Legacy JWT user
    await pool.query(
      'UPDATE users SET full_name = COALESCE($1, full_name), email = COALESCE($2, email), phone = COALESCE($3, phone), avatar = COALESCE($4, avatar) WHERE id = $5',
      [full_name || null, email || null, phone || null, avatar || null, req.user.id]
    );
    const { rows } = await pool.query('SELECT id, username, email, full_name, role, phone, avatar, created_at FROM users WHERE id = $1', [req.user.id]);
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/auth/password
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    // Verify current password via Supabase Auth
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: req.user.email,
      password: current_password,
    });

    if (signInError) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    // Update password via Supabase Admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(req.user.id, {
      password: new_password,
    });

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update password. ' + updateError.message });
    }

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
