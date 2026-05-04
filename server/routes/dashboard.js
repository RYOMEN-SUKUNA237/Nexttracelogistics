const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/stats — Overview statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { rows: [stats] } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM couriers) as "totalCouriers",
        (SELECT COUNT(*) FROM couriers WHERE status IN ('active', 'on-delivery')) as "activeCouriers",
        (SELECT COUNT(*) FROM shipments) as "totalShipments",
        (SELECT COUNT(*) FROM shipments WHERE status IN ('in-transit', 'out-for-delivery')) as "inTransit",
        (SELECT COUNT(*) FROM shipments WHERE status = 'delivered') as delivered,
        (SELECT COUNT(*) FROM shipments WHERE status = 'pending') as pending,
        (SELECT COUNT(*) FROM shipments WHERE is_paused = TRUE) as paused,
        (SELECT COUNT(*) FROM shipments WHERE status = 'returned') as returned,
        (SELECT COUNT(*) FROM customers) as "totalCustomers"
    `);

    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    const { rows: [todayStats] } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM shipments WHERE status = 'delivered' AND actual_delivery = $1) as "deliveredToday",
        (SELECT COUNT(*) FROM shipments WHERE created_at::date = $1::date) as "createdToday",
        (SELECT COUNT(*) FROM couriers WHERE created_at::date = $1::date) as "couriersRegisteredToday"
    `, [today]);

    // Convert string counts to numbers
    const toNum = (v) => parseInt(v) || 0;

    res.json({
      stats: {
        totalCouriers: toNum(stats.totalCouriers),
        activeCouriers: toNum(stats.activeCouriers),
        totalShipments: toNum(stats.totalShipments),
        inTransit: toNum(stats.inTransit),
        delivered: toNum(stats.delivered),
        pending: toNum(stats.pending),
        paused: toNum(stats.paused),
        returned: toNum(stats.returned),
        totalCustomers: toNum(stats.totalCustomers),
        deliveredToday: toNum(todayStats.deliveredToday),
        createdToday: toNum(todayStats.createdToday),
        couriersRegisteredToday: toNum(todayStats.couriersRegisteredToday),
      },
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/dashboard/recent-activity — Recent tracking events
router.get('/recent-activity', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const { rows: activity } = await pool.query(`
      SELECT th.*, s.sender_name, s.receiver_name, s.origin, s.destination
      FROM tracking_history th
      LEFT JOIN shipments s ON th.shipment_id = s.id
      ORDER BY th.created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({ activity });
  } catch (err) {
    console.error('Recent activity error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/dashboard/top-couriers — Leaderboard
router.get('/top-couriers', authMiddleware, async (req, res) => {
  try {
    const { rows: couriers } = await pool.query('SELECT id, courier_id, name, avatar, total_deliveries, rating, status FROM couriers ORDER BY total_deliveries DESC LIMIT 10');
    res.json({ couriers });
  } catch (err) {
    console.error('Top couriers error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/dashboard/notifications — List notifications
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const { rows: notifications } = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT $1', [limit]);
    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) as count FROM notifications WHERE is_read = FALSE');
    res.json({ notifications, unreadCount: parseInt(count) });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/dashboard/notifications/read-all — Mark all as read
// ⚠️ MUST be declared BEFORE /:id/read to prevent 'read-all' being captured as an id param
router.patch('/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE');
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/dashboard/notifications/:id/read — Mark single notification as read
router.patch('/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [req.params.id]);
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/dashboard/active-map — Active shipments for map display
router.get('/active-map', authMiddleware, async (req, res) => {
  try {
    const { rows: shipments } = await pool.query(`
      SELECT s.*, c.name as courier_name, c.phone as courier_phone, c.avatar as courier_avatar
      FROM shipments s
      LEFT JOIN couriers c ON s.courier_id = c.courier_id
      WHERE s.status IN ('in-transit', 'out-for-delivery', 'paused')
      ORDER BY COALESCE(s.updated_at, s.created_at) DESC
    `);

    res.json({ shipments });
  } catch (err) {
    console.error('Active map error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
