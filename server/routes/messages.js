const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const crypto = require('crypto');
let notifyAdminsAboutSupport;
try {
  notifyAdminsAboutSupport = require('./emails').notifyAdminsAboutSupport;
} catch (e) {
  notifyAdminsAboutSupport = null;
}

const router = express.Router();

function sanitize(str, maxLen = 255) {
  if (typeof str !== 'string') return str;
  return str.trim().slice(0, maxLen);
}

// ─── PUBLIC ENDPOINTS (visitor-facing) ───────────────────────────────

// POST /api/messages/conversations — Start or resume a conversation
router.post('/conversations', async (req, res) => {
  try {
    const visitor_id = sanitize(req.body.visitor_id, 100);
    const visitor_name = sanitize(req.body.visitor_name, 100);
    const visitor_email = sanitize(req.body.visitor_email, 100);
    const subject = sanitize(req.body.subject, 200);

    if (!visitor_id) {
      return res.status(400).json({ error: 'visitor_id is required.' });
    }

    // Check if an open conversation already exists for this visitor
    const { rows: existing } = await pool.query(
      `SELECT * FROM conversations WHERE visitor_id = $1 AND status = 'open' ORDER BY last_message_at DESC LIMIT 1`, [visitor_id]
    );

    let conversation = existing[0];

    if (!conversation) {
      const { rows: inserted } = await pool.query(
        `INSERT INTO conversations (visitor_id, visitor_name, visitor_email, subject, status)
         VALUES ($1, $2, $3, $4, 'open') RETURNING *`,
        [visitor_id, visitor_name || 'Visitor', visitor_email || null, subject || null]
      );
      conversation = inserted[0];
    }

    // Get messages for this conversation
    const { rows: messages } = await pool.query(
      `SELECT * FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC`, [conversation.id]
    );

    res.json({ conversation, messages });
  } catch (err) {
    console.error('Create conversation error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/messages/send — Send a message (visitor)
router.post('/send', async (req, res) => {
  try {
    const conversation_id = req.body.conversation_id;
    const content = sanitize(req.body.content, 2000);
    const sender_name = sanitize(req.body.sender_name, 100);
    const sender_type = req.body.sender_type;

    if (!conversation_id || !content) {
      return res.status(400).json({ error: 'conversation_id and content are required.' });
    }

    const { rows: convRows } = await pool.query('SELECT * FROM conversations WHERE id = $1', [conversation_id]);
    const conversation = convRows[0];
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const type = sender_type || 'visitor';
    const name = sender_name || (type === 'admin' ? 'Support Agent' : conversation.visitor_name || 'Visitor');

    const { rows: inserted } = await pool.query(
      `INSERT INTO chat_messages (conversation_id, sender_type, sender_name, content, is_read)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [conversation_id, type, name, content.trim(), type === 'admin']
    );

    // Update conversation
    if (type === 'visitor') {
      await pool.query(
        `UPDATE conversations SET last_message_at = NOW(), unread_count = unread_count + 1 WHERE id = $1`, [conversation_id]
      );
    } else {
      await pool.query(
        `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`, [conversation_id]
      );
    }

    res.status(201).json({ message: inserted[0] });

    // Send email notification to all admins (fire-and-forget)
    if (type === 'visitor' && notifyAdminsAboutSupport) {
      notifyAdminsAboutSupport({
        visitorName: name,
        visitorEmail: conversation.visitor_email || null,
        messageContent: content.trim(),
        conversationId: conversation_id,
      }).catch(err => console.error('Admin notification error:', err.message));
    }
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/messages/conversations/:id/messages — Get messages for a conversation (public)
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const { rows: messages } = await pool.query(
      `SELECT * FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC`, [req.params.id]
    );
    res.json({ messages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── ADMIN ENDPOINTS (auth required) ─────────────────────────────────

// GET /api/messages/admin/conversations — List all conversations
router.get('/admin/conversations', authMiddleware, async (req, res) => {
  try {
    const { status, search } = req.query;
    let sql = `SELECT c.*, 
      (SELECT content FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT sender_type FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_sender_type,
      (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id) as message_count
      FROM conversations c WHERE 1=1`;
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND c.status = $${params.length}`;
    }
    if (search) {
      const s = `%${search}%`;
      params.push(s, s, s);
      const n = params.length;
      sql += ` AND (c.visitor_name ILIKE $${n-2} OR c.visitor_email ILIKE $${n-1} OR c.subject ILIKE $${n})`;
    }

    sql += ' ORDER BY c.last_message_at DESC';
    const { rows: conversations } = await pool.query(sql, params);

    // Unread total
    const { rows: [unreadRow] } = await pool.query(
      `SELECT COALESCE(SUM(unread_count), 0) as total FROM conversations WHERE status = 'open'`
    );

    res.json({ conversations, unread_total: parseInt(unreadRow.total) || 0 });
  } catch (err) {
    console.error('List conversations error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/messages/admin/conversations/:id — Get conversation with messages
router.get('/admin/conversations/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM conversations WHERE id = $1', [req.params.id]);
    const conversation = rows[0];
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });

    const { rows: messages } = await pool.query(
      `SELECT * FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC`, [req.params.id]
    );

    // Mark visitor messages as read, reset unread count
    await pool.query(
      `UPDATE chat_messages SET is_read = TRUE WHERE conversation_id = $1 AND sender_type = 'visitor' AND is_read = FALSE`, [req.params.id]
    );
    await pool.query(
      `UPDATE conversations SET unread_count = 0 WHERE id = $1`, [req.params.id]
    );

    res.json({ conversation, messages });
  } catch (err) {
    console.error('Get conversation error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/messages/admin/reply — Admin reply to a conversation
router.post('/admin/reply', authMiddleware, async (req, res) => {
  try {
    const { conversation_id, content } = req.body;

    if (!conversation_id || !content) {
      return res.status(400).json({ error: 'conversation_id and content are required.' });
    }

    const { rows: convRows } = await pool.query('SELECT * FROM conversations WHERE id = $1', [conversation_id]);
    if (!convRows[0]) return res.status(404).json({ error: 'Conversation not found.' });

    const adminName = req.user.full_name || 'Support Agent';

    const { rows: inserted } = await pool.query(
      `INSERT INTO chat_messages (conversation_id, sender_type, sender_name, content, is_read)
       VALUES ($1, 'admin', $2, $3, TRUE) RETURNING *`,
      [conversation_id, adminName, content.trim()]
    );

    await pool.query(
      `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`, [conversation_id]
    );

    res.status(201).json({ message: inserted[0] });
  } catch (err) {
    console.error('Admin reply error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/messages/admin/conversations/:id/close — Close a conversation
router.patch('/admin/conversations/:id/close', authMiddleware, async (req, res) => {
  try {
    await pool.query(`UPDATE conversations SET status = 'closed' WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Conversation closed.' });
  } catch (err) {
    console.error('Close conversation error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/messages/admin/conversations/:id/reopen — Reopen a conversation
router.patch('/admin/conversations/:id/reopen', authMiddleware, async (req, res) => {
  try {
    await pool.query(`UPDATE conversations SET status = 'open' WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Conversation reopened.' });
  } catch (err) {
    console.error('Reopen conversation error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
