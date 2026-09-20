const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { generateTrackingId } = require('../utils/generators');
const {
  sendMail,
  buildShipmentCreationEmail,
  buildShipmentPauseEmail,
  buildShipmentStatusChangeEmail,
  buildTrackingUpdateEmail,
} = require('../utils/mailer');
const T = require('../utils/timeline');
const { rerouteAir, addRoadStop, removeRoadStop, ROAD_STOP_PRESETS } = require('../utils/transportPlanner');
const { notify } = require('../utils/notify');
let createTrackingUpdateDraft;
try {
  createTrackingUpdateDraft = require('./emails').createTrackingUpdateDraft;
} catch (e) {
  createTrackingUpdateDraft = null;
}

const router = express.Router();

const ACTIVE_STATUSES = ['picked-up', 'in-transit', 'out-for-delivery'];
const STATUS_LABELS = {
  'pending': 'Order Confirmed',
  'picked-up': 'Picked Up',
  'in-transit': 'In Transit',
  'out-for-delivery': 'Out for Delivery',
  'delivered': 'Delivered',
  'returned': 'Returned',
  'paused': 'On Hold',
};

// ─── SCHEMA ──────────────────────────────────────────────────────────
// Columns added for the admin simulation overhaul. Created on first use so
// the live database upgrades itself (see server/migrate-admin-overhaul.js).
const REQUIRED_COLUMNS = {
  multi_modal_segments: 'JSONB',
  multi_modal_stops: 'JSONB',
  pet_details: 'JSONB',
  status_before_pause: 'TEXT',
  timeline_events: 'JSONB',
  eta_overridden: 'BOOLEAN DEFAULT FALSE',
  route_mode: 'TEXT',
};

let columnsReady = null;
function ensureShipmentColumns() {
  if (!columnsReady) {
    // Read the catalogue first: on an up-to-date database this is a cheap
    // SELECT, so many serverless instances never take an ALTER TABLE lock.
    columnsReady = (async () => {
      const { rows } = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'shipments'`
      );
      const have = new Set(rows.map((r) => r.column_name));
      const missing = Object.entries(REQUIRED_COLUMNS).filter(([name]) => !have.has(name));
      if (missing.length === 0) return;
      console.log(`[schema] Adding shipment columns: ${missing.map(([n]) => n).join(', ')}`);
      await pool.query(missing.map(([name, type]) => `ALTER TABLE shipments ADD COLUMN IF NOT EXISTS ${name} ${type};`).join('\n'));
    })().catch((err) => {
      columnsReady = null;
      throw err;
    });
  }
  return columnsReady;
}

router.use(async (req, res, next) => {
  try {
    await ensureShipmentColumns();
    next();
  } catch (err) {
    console.error('Shipment schema upgrade failed:', err.message);
    res.status(500).json({ error: 'Database schema upgrade failed.' });
  }
});

// ─── TIME-BASED PROGRESS ─────────────────────────────────────────────────────
// Single canonical formula: progress = (now - departed_at - paused) / (estimated_delivery - departed_at - paused)
function computeProgress(shipment) {
  if (shipment.status === 'delivered' || shipment.status === 'returned') return 100;
  if (shipment.status === 'pending') return 0;
  if (shipment.is_paused) return parseFloat(shipment.progress) || 0;
  if (!shipment.departed_at || !shipment.estimated_delivery) return parseFloat(shipment.progress) || 0;

  const departedMs  = new Date(shipment.departed_at).getTime();
  const estStr      = String(shipment.estimated_delivery);
  const estimatedMs = new Date(estStr.includes('T') ? estStr : estStr + 'T00:00:00.000Z').getTime();
  const totalPausedMs = parseInt(shipment.total_paused_ms) || 0;
  let totalDur    = estimatedMs - departedMs - totalPausedMs;
  if (totalDur <= 0 && shipment.route_duration) {
    totalDur = parseFloat(shipment.route_duration) * 1000;
  }
  if (totalDur <= 0) return 100;

  const nowMs         = Date.now();
  const elapsedActive = (nowMs - departedMs) - totalPausedMs;
  const pct           = Math.max(0, Math.min(100, (elapsedActive / totalDur) * 100));
  return Math.round(pct * 10) / 10;
}

function enrichShipment(s) {
  s.computed_progress = computeProgress(s);
  return s;
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function sendError(res, err, label) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(`${label}:`, err);
  return res.status(500).json({ error: 'Internal server error.' });
}

function actor(req) {
  return req.user.username || req.user.email || 'admin';
}

async function findShipment(id) {
  const { rows } = await pool.query('SELECT * FROM shipments WHERE id::text = $1 OR tracking_id = $1', [id]);
  return rows[0] || null;
}

async function reload(id) {
  const { rows } = await pool.query('SELECT * FROM shipments WHERE id = $1', [id]);
  return rows[0];
}

async function logHistory(s, { status, location = null, lat = null, lng = null, notes = null, by = 'system', at = null }) {
  await pool.query(
    `INSERT INTO tracking_history (shipment_id, tracking_id, status, location, lat, lng, notes, updated_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW()))`,
    [s.id, s.tracking_id, status || s.status, location, lat, lng, notes, by, at]
  );
}


function recipients(s) {
  const list = [];
  if (s.sender_email) list.push({ email: s.sender_email, name: s.sender_name, role: 'sender' });
  if (s.receiver_email && s.receiver_email !== s.sender_email) list.push({ email: s.receiver_email, name: s.receiver_name, role: 'receiver' });
  return list;
}

/** Email sender & receiver, logging each successful send in the admin Emails page. */
async function emailParties(s, build) {
  try {
    await Promise.allSettled(recipients(s).map(async (r) => {
      const mail = build(r);
      const result = await sendMail({ to: r.email, subject: mail.subject, html: mail.html, text: mail.text });
      if (result.success) {
        await pool.query(
          `INSERT INTO email_drafts (type, recipient_email, recipient_name, subject, html_body, text_body, status, related_tracking_id, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'sent', $7, NOW())`,
          ['tracking_update', r.email, r.name, mail.subject, mail.html, mail.text, s.tracking_id]
        );
      }
      return result;
    }));
  } catch (err) {
    console.error('Shipment email error:', err.message);
  }
}

async function draftForSubscribers(payload) {
  if (!createTrackingUpdateDraft) return;
  try {
    await createTrackingUpdateDraft(payload);
  } catch (err) {
    console.error('Tracking draft error:', err.message);
  }
}

/** Put the courier back to "active" once they have no other shipment in progress. */
async function releaseCourier(courierId, exceptShipmentId) {
  if (!courierId) return;
  const { rows } = await pool.query(
    `SELECT 1 FROM shipments WHERE courier_id = $1 AND id <> $2 AND status IN ('picked-up','in-transit','out-for-delivery','paused') LIMIT 1`,
    [courierId, exceptShipmentId]
  );
  if (rows.length === 0) {
    await pool.query(`UPDATE couriers SET status = 'active' WHERE courier_id = $1 AND status = 'on-delivery'`, [courierId]);
  }
}

/** Where the vehicle is right now according to the shipment's timeline. */
function currentState(s) {
  const plan = T.planFromShipment(s);
  if (!plan.segments.length) return null;
  const clock = T.shipmentClock(s);
  if (!clock) return null;
  const timeline = T.buildTimeline(plan, clock.windowHours);
  if (!timeline.phases.length) return null;
  return { plan, timeline, clock, state: T.stateAt(plan, timeline, clock.elapsedHours) };
}

function isAirborne(s) {
  const cur = currentState(s);
  return !!(cur && cur.state.kind === 'move' && cur.state.mode === 'air' && !s.is_paused);
}

/** Estimated arrival for a (re)departure now, unless the admin fixed the date. */
function freshEta(s, departedIso) {
  if (s.eta_overridden && s.estimated_delivery) return s.estimated_delivery;
  if (Number(s.route_duration) > 0) {
    return new Date(new Date(departedIso).getTime() + Number(s.route_duration) * 1000).toISOString();
  }
  return s.estimated_delivery || new Date(Date.now() + 5 * 86400000).toISOString();
}

/**
 * Mark every milestone up to the shipment's current position as done without
 * side effects (used after the timeline is moved by the admin, so jumping
 * forward never floods customers with emails).
 */
async function markMilestonesSilently(s) {
  const cur = currentState(s);
  if (!cur) {
    await pool.query(`UPDATE shipments SET timeline_events = '[]'::jsonb WHERE id = $1`, [s.id]);
    return;
  }
  const done = T.milestones(cur.plan, cur.timeline)
    .filter((e) => e.atHours < cur.clock.elapsedHours - 1e-6 && e.key !== 'delivered')
    .map((e) => e.key);
  await pool.query('UPDATE shipments SET timeline_events = $1::jsonb WHERE id = $2', [JSON.stringify(done), s.id]);
}

// ─── AUTOMATIC TIMELINE EVENTS ───────────────────────────────────────
// As simulated time passes, milestones (hub arrivals, layovers, out for
// delivery, delivered) are written to the tracking history once each.

const EMAIL_FRESHNESS_HOURS = 6;

// How far behind the simulation may catch up on its own. A status milestone
// overdue by more than this is recorded but not acted on, so old rows are
// never rewritten by someone simply opening a page. See syncTimelineEvents.
const STALE_MILESTONE_HOURS = 48;

/**
 * How many real hours ago a milestone was due.
 *
 * The simulated clock is clamped to the length of the journey, so once a
 * shipment is overdue `elapsedHours - atHours` collapses to zero however long
 * ago it should have arrived. Wall-clock time is what tells us whether we are
 * catching up on a short gap or replaying old history.
 */
function lateByHours(clock, e) {
  const dueMs = clock.departedMs + clock.pausedMs + e.atHours * 3.6e6;
  return (Date.now() - dueMs) / 3.6e6;
}

async function applyTimelineEvent(s, e, cur) {
  const lateBy = Math.max(0, lateByHours(cur.clock, e));
  const at = new Date(Date.now() - lateBy * 3.6e6).toISOString();
  const fresh = lateBy <= EMAIL_FRESHNESS_HOURS;

  if (e.kind === 'roadstop') {
    await logHistory(s, { status: s.status, location: e.location, lat: e.lat, lng: e.lng, notes: e.note, at });
    await notify('shipment_status', 'Scheduled Stop', `${s.tracking_id}: ${e.note}`, 'info');
    // Customers are only emailed about long stops; a short break is not news.
    if (fresh && Number(e.waitHours) >= 2) {
      await emailParties(s, (r) => buildTrackingUpdateEmail({
        trackingId: s.tracking_id,
        status: s.status,
        statusLabel: 'Scheduled Stop',
        location: e.location,
        notes: `${e.note} The journey continues in about ${Math.round(Number(e.waitHours))} hour(s).`,
        recipientName: r.name,
        footerNote: `You're receiving this because you are the ${r.role} of shipment ${s.tracking_id}.`,
      }));
      await draftForSubscribers({ trackingId: s.tracking_id, status: s.status, statusLabel: 'Scheduled Stop', location: e.location, notes: e.note });
    }
    return s;
  }

  if (e.kind === 'log' || e.kind === 'layover') {
    await logHistory(s, { status: s.status, location: e.location, lat: e.lat, lng: e.lng, notes: e.note, at });
    if (e.kind === 'layover') {
      await notify('shipment_status', 'Transit Layover', `${s.tracking_id}: ${e.note}`, 'info');
      if (fresh) {
        await emailParties(s, (r) => buildTrackingUpdateEmail({
          trackingId: s.tracking_id,
          status: 'in-transit',
          statusLabel: 'Scheduled Transit Layover',
          location: e.location,
          notes: 'The aircraft carrying your cargo has landed for a scheduled transit layover (refuelling and crew change). Your cargo remains secure and the flight will continue shortly.',
          recipientName: r.name,
          footerNote: `You're receiving this because you are the ${r.role} of shipment ${s.tracking_id}.`,
        }));
      }
      await draftForSubscribers({ trackingId: s.tracking_id, status: 'in-transit', statusLabel: 'Transit Layover', location: e.location, notes: e.note });
    }
    return s;
  }

  // Status milestones
  if (e.status === 'in-transit') {
    if (s.status !== 'picked-up') return s;
    await pool.query(`UPDATE shipments SET status = 'in-transit' WHERE id = $1 AND status = 'picked-up'`, [s.id]);
    await logHistory(s, { status: 'in-transit', location: s.origin, notes: 'Shipment departed the origin and is in transit.', at });
    return reload(s.id);
  }

  if (e.status === 'out-for-delivery') {
    if (!['picked-up', 'in-transit'].includes(s.status)) return s;
    await pool.query(`UPDATE shipments SET status = 'out-for-delivery' WHERE id = $1`, [s.id]);
    const updated = await reload(s.id);
    await logHistory(updated, { status: 'out-for-delivery', notes: `Out for delivery to ${s.destination}.`, at });
    await notify('shipment_status', 'Out for Delivery', `${s.tracking_id} is out for delivery to ${s.destination}.`, 'info');
    if (fresh) await emailParties(updated, (r) => buildShipmentStatusChangeEmail({ shipment: updated, newStatus: 'out-for-delivery', role: r.role, notes: null }));
    await draftForSubscribers({ trackingId: s.tracking_id, status: 'out-for-delivery', statusLabel: STATUS_LABELS['out-for-delivery'], location: null, notes: null });
    return updated;
  }

  if (e.status === 'delivered') {
    const day = at.split('T')[0];
    await pool.query(
      `UPDATE shipments SET status = 'delivered', progress = 100, actual_delivery = $1, current_lat = dest_lat, current_lng = dest_lng WHERE id = $2`,
      [day, s.id]
    );
    const updated = await reload(s.id);
    await logHistory(updated, { status: 'delivered', location: s.destination, lat: s.dest_lat, lng: s.dest_lng, notes: 'Shipment delivered.', at });
    if (s.courier_id) {
      await pool.query('UPDATE couriers SET total_deliveries = total_deliveries + 1 WHERE courier_id = $1', [s.courier_id]);
      await releaseCourier(s.courier_id, s.id);
    }
    await notify('shipment_delivered', 'Shipment Delivered', `${s.tracking_id} was delivered to ${s.destination}.`, 'success');
    if (fresh) await emailParties(updated, (r) => buildShipmentStatusChangeEmail({ shipment: updated, newStatus: 'delivered', role: r.role, notes: null }));
    await draftForSubscribers({ trackingId: s.tracking_id, status: 'delivered', statusLabel: STATUS_LABELS.delivered, location: s.destination, notes: null });
    return updated;
  }
  return s;
}

async function syncTimelineEvents(s) {
  if (!ACTIVE_STATUSES.includes(s.status) || s.is_paused) return s;
  const cur = currentState(s);
  if (!cur) return s;

  const due = T.milestones(cur.plan, cur.timeline).filter((e) => e.atHours <= cur.clock.elapsedHours + 1e-9);
  const logged = T.parseJson(s.timeline_events);

  if (!Array.isArray(logged)) {
    // Shipment created before automatic events existed. Everything already due
    // is adopted as "seen" so that nothing is replayed onto a shipment whose
    // journey ran before this feature existed.
    //
    // This deliberately includes `delivered`. Leaving it out meant that an old
    // shipment whose simulated arrival had already passed was marked delivered
    // on the very next request — rewriting status, progress, actual_delivery
    // and the courier's counters for data an administrator never touched.
    // Whatever is NOT yet due is not adopted, so a legacy shipment that is
    // still genuinely on the road goes on to deliver normally.
    await pool.query(
      'UPDATE shipments SET timeline_events = $1::jsonb WHERE id = $2 AND timeline_events IS NULL',
      [JSON.stringify(due.map((e) => e.key)), s.id]
    );
    return s;
  }

  let current = s;
  let changed = false;
  for (const e of due) {
    if (logged.includes(e.key)) continue;
    // Claim the event atomically so concurrent requests never act twice.
    const { rowCount } = await pool.query(
      `UPDATE shipments SET timeline_events = COALESCE(timeline_events, '[]'::jsonb) || $1::jsonb
       WHERE id = $2 AND NOT (COALESCE(timeline_events, '[]'::jsonb) ? $3)`,
      [JSON.stringify([e.key]), s.id, e.key]
    );
    if (rowCount === 0) continue;
    changed = true;
    // A milestone that came due long ago belongs to a stretch of the journey
    // nobody was watching. It is recorded above so it never fires later, but
    // it must not rewrite the shipment now: catching up days-old history would
    // change rows — statuses, delivery dates, courier counters — that no
    // administrator asked us to touch. Recent catch-up still works normally.
    const late = lateByHours(cur.clock, e);
    if (e.status && late > STALE_MILESTONE_HOURS) {
      console.log(`[timeline] ${s.tracking_id}: ${e.key} was due ${Math.round(late)}h ago — recorded, not applied.`);
      continue;
    }
    try {
      current = await applyTimelineEvent(current, e, cur);
    } catch (err) {
      console.error(`Timeline event ${e.key} failed for ${s.tracking_id}:`, err.message);
    }
  }
  return changed ? reload(s.id) : s;
}

// ─── PAUSE / RESUME ──────────────────────────────────────────────────

async function pauseShipment(s, { category = null, reason = null, location = null, lat = null, lng = null, by }) {
  if (s.is_paused) throw httpError(409, 'This shipment is already on hold.');
  s = await syncTimelineEvents(s);
  if (['delivered', 'returned'].includes(s.status)) throw httpError(400, `A ${s.status} shipment cannot be paused.`);
  if (isAirborne(s)) {
    throw httpError(409, 'The aircraft is airborne. Divert it to an airport or wait until it lands before placing a hold.');
  }

  const nowIso = new Date().toISOString();
  const cur = currentState(s);
  const frozen = computeProgress(s);
  const pos = cur ? cur.state.position : null;
  const where = location || (cur && cur.state.kind === 'stop' ? cur.state.name : null);

  await pool.query(
    `UPDATE shipments SET is_paused = TRUE, status = 'paused', status_before_pause = $1, paused_at = $2,
       pause_category = $3, pause_reason = $4, progress = $5,
       current_lat = COALESCE($6, current_lat), current_lng = COALESCE($7, current_lng)
     WHERE id = $8`,
    [s.status, nowIso, category, reason, frozen, lat ?? (pos ? pos[1] : null), lng ?? (pos ? pos[0] : null), s.id]
  );

  const note = category ? `Paused — ${category}${reason ? `: ${reason}` : ''}` : 'Shipment paused.';
  await logHistory(s, { status: 'paused', location: where, lat: lat ?? (pos ? pos[1] : null), lng: lng ?? (pos ? pos[0] : null), notes: note, by });
  await notify('shipment_paused', 'Shipment Paused', `${s.tracking_id}: ${note}`, 'warning');

  const updated = await reload(s.id);
  const { rows: histRows } = await pool.query(
    'SELECT location FROM tracking_history WHERE shipment_id = $1 AND location IS NOT NULL ORDER BY created_at DESC LIMIT 1', [s.id]
  );
  const lastLocation = where || histRows[0]?.location || null;
  await emailParties(updated, () => buildShipmentPauseEmail({
    shipment: updated, isPaused: true, pauseCategory: category, pauseReason: reason, location: lastLocation, pausedAt: nowIso,
  }));
  await draftForSubscribers({
    trackingId: s.tracking_id, status: 'paused', statusLabel: STATUS_LABELS.paused, location: lastLocation,
    notes: note, pauseCategory: category, pauseReason: reason,
  });
  return updated;
}

async function resumeShipment(s, { by, targetStatus = null }) {
  if (!s.is_paused) throw httpError(409, 'This shipment is not on hold.');

  const departed = !!s.departed_at;
  const pauseMs = s.paused_at ? Math.max(0, Date.now() - new Date(s.paused_at).getTime()) : 0;
  const totalPaused = (parseInt(s.total_paused_ms) || 0) + (departed ? pauseMs : 0);
  let eta = s.estimated_delivery;
  if (departed && eta && pauseMs > 0) {
    const estStr = String(eta).includes('T') ? String(eta) : `${eta}T23:59:59Z`;
    eta = new Date(new Date(estStr).getTime() + pauseMs).toISOString();
  }
  let restored = targetStatus || s.status_before_pause || (departed ? 'in-transit' : 'pending');
  if (restored === 'paused') restored = departed ? 'in-transit' : 'pending';

  await pool.query(
    `UPDATE shipments SET is_paused = FALSE, status = $1, paused_at = NULL, total_paused_ms = $2,
       pause_category = NULL, pause_reason = NULL, status_before_pause = NULL,
       estimated_delivery = COALESCE($3, estimated_delivery)
     WHERE id = $4`,
    [restored, totalPaused, eta, s.id]
  );

  const note = s.pause_category === 'Transit Stop'
    ? `Resumed from transit hold: ${s.pause_reason || 'airport'}`
    : 'Shipment resumed.';
  await logHistory(s, { status: restored, notes: note, by });
  await notify('shipment_paused', 'Shipment Resumed', `${s.tracking_id}: ${note}`, 'info');

  const updated = await reload(s.id);
  await emailParties(updated, () => buildShipmentPauseEmail({
    shipment: updated, isPaused: false, pauseCategory: null, pauseReason: null, location: null, pausedAt: null,
  }));
  await draftForSubscribers({ trackingId: s.tracking_id, status: restored, statusLabel: 'Resumed — ' + (STATUS_LABELS[restored] || restored), location: null, notes: note });
  return updated;
}

// ─── ROUTES ──────────────────────────────────────────────────────────

// GET /api/shipments — List all shipments (admin). Also advances automatic timeline events.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, courier_id, customer_id, search, page = 1, limit = 50 } = req.query;
    let query = 'SELECT * FROM shipments WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM shipments WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      query += ` AND status = $${params.length}`;
      countQuery += ` AND status = $${params.length}`;
    }

    if (courier_id) {
      params.push(courier_id);
      query += ` AND courier_id = $${params.length}`;
      countQuery += ` AND courier_id = $${params.length}`;
    }

    if (customer_id) {
      params.push(customer_id);
      query += ` AND customer_id = $${params.length}`;
      countQuery += ` AND customer_id = $${params.length}`;
    }

    if (search) {
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
      const n = params.length;
      query += ` AND (tracking_id ILIKE $${n-4} OR sender_name ILIKE $${n-3} OR receiver_name ILIKE $${n-2} OR origin ILIKE $${n-1} OR destination ILIKE $${n})`;
      countQuery += ` AND (tracking_id ILIKE $${n-4} OR sender_name ILIKE $${n-3} OR receiver_name ILIKE $${n-2} OR origin ILIKE $${n-1} OR destination ILIKE $${n})`;
    }

    const { rows: countRows } = await pool.query(countQuery, params);
    const total = parseInt(countRows[0].total);

    query += ' ORDER BY created_at DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await pool.query(query, params);

    const shipments = [];
    for (const row of rows) {
      let current = row;
      try {
        current = await syncTimelineEvents(row);
      } catch (err) {
        console.error(`Timeline sync failed for ${row.tracking_id}:`, err.message);
      }
      shipments.push(enrichShipment(current));
    }

    res.json({
      shipments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('List shipments error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/shipments/:id/track — Public tracking endpoint (no auth required)
router.get('/:id/track', async (req, res) => {
  try {
    // Viewing a shipment also advances its automatic milestones.
    const full = await findShipment(req.params.id);
    if (full && full.tracking_id === req.params.id) {
      try { await syncTimelineEvents(full); } catch (err) { console.error('Track sync failed:', err.message); }
    }

    const { rows } = await pool.query(
      `SELECT tracking_id, sender_name, receiver_name, origin, destination,
              origin_lat, origin_lng, dest_lat, dest_lng, current_lat, current_lng,
              status, progress, is_paused, estimated_delivery, actual_delivery,
              cargo_type, weight, route_data, transport_modes, route_distance,
              route_duration, route_summary, created_at,
              departed_at, paused_at, total_paused_ms,
              multi_modal_segments, multi_modal_stops,
              pause_category, pause_reason,
              status_before_pause, scheduled_transit_stops, pet_details, route_mode
       FROM shipments WHERE tracking_id = $1`, [req.params.id]
    );

    const shipment = rows[0];
    if (!shipment) return res.status(404).json({ error: 'Shipment not found.' });

    // Only non-sensitive animal details are public (no microchip, vet or medication data).
    const pet = T.parseJson(shipment.pet_details);
    shipment.pet_details = pet && typeof pet === 'object'
      ? ['species', 'breed', 'gender', 'age', 'color', 'weight', 'vaccinationStatus', 'crateType', 'tempMin', 'tempMax', 'feedingSchedule', 'specialCare']
        .reduce((out, k) => (pet[k] ? { ...out, [k]: pet[k] } : out), {})
      : null;

    // Parse JSON fields
    if (shipment.route_data && typeof shipment.route_data === 'string') {
      try { shipment.route_data = JSON.parse(shipment.route_data); } catch (e) {}
    }
    if (shipment.transport_modes && typeof shipment.transport_modes === 'string') {
      try { shipment.transport_modes = JSON.parse(shipment.transport_modes); } catch (e) {}
    }
    if (shipment.multi_modal_segments && typeof shipment.multi_modal_segments === 'string') {
      try { shipment.multi_modal_segments = JSON.parse(shipment.multi_modal_segments); } catch (e) {}
    }
    if (shipment.multi_modal_stops && typeof shipment.multi_modal_stops === 'string') {
      try { shipment.multi_modal_stops = JSON.parse(shipment.multi_modal_stops); } catch (e) {}
    }

    // Compute real-time progress
    enrichShipment(shipment);

    const { rows: history } = await pool.query(
      'SELECT status, location, lat, lng, notes, created_at FROM tracking_history WHERE tracking_id = $1 ORDER BY created_at DESC', [req.params.id]
    );

    // Get courier info (public-safe fields only)
    const { rows: fullRows } = await pool.query('SELECT courier_id FROM shipments WHERE tracking_id = $1', [req.params.id]);
    let courier = null;
    if (fullRows[0] && fullRows[0].courier_id) {
      const { rows: cRows } = await pool.query('SELECT courier_id, name, phone, vehicle_type, avatar, rating FROM couriers WHERE courier_id = $1', [fullRows[0].courier_id]);
      courier = cRows[0] || null;
    }

    res.json({ shipment, history, courier });
  } catch (err) {
    console.error('Track shipment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/shipments/:id — Get single shipment with tracking history
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const shipment = await findShipment(req.params.id);
    if (!shipment) return res.status(404).json({ error: 'Shipment not found.' });

    for (const key of ['route_data', 'transport_modes', 'multi_modal_segments', 'multi_modal_stops', 'scheduled_transit_stops', 'pet_details']) {
      if (typeof shipment[key] === 'string') shipment[key] = T.parseJson(shipment[key]);
    }
    enrichShipment(shipment);

    const { rows: history } = await pool.query('SELECT * FROM tracking_history WHERE shipment_id = $1 ORDER BY created_at DESC', [shipment.id]);

    let courier = null;
    if (shipment.courier_id) {
      const { rows: cRows } = await pool.query('SELECT id, courier_id, name, phone, vehicle_type, avatar FROM couriers WHERE courier_id = $1', [shipment.courier_id]);
      courier = cRows[0] || null;
    }

    res.json({ shipment, history, courier });
  } catch (err) {
    console.error('Get shipment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

const asJson = (v) => (v == null ? null : typeof v === 'string' ? v : JSON.stringify(v));

// POST /api/shipments — Create new shipment
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      sender_name, sender_email, sender_phone,
      receiver_name, receiver_email, receiver_phone,
      origin, destination, origin_lat, origin_lng, dest_lat, dest_lng,
      courier_id, customer_id, weight, dimensions, cargo_type,
      description, declared_value, insurance, estimated_delivery, eta_overridden, special_instructions,
      route_data, transport_modes, route_distance, route_duration, route_summary, route_mode,
      multi_modal_segments, multi_modal_stops, scheduled_transit_stops, pet_details,
    } = req.body;

    if (!sender_name || !receiver_name || !origin || !destination) {
      return res.status(400).json({ error: 'sender_name, receiver_name, origin, and destination are required.' });
    }

    if (courier_id) {
      const { rows: cRows } = await pool.query('SELECT id FROM couriers WHERE courier_id = $1', [courier_id]);
      if (cRows.length === 0) return res.status(400).json({ error: 'Courier not found.' });
    }

    if (cargo_type === 'Live Animals') {
      const pet = T.parseJson(pet_details) || {};
      if (!pet.species) return res.status(400).json({ error: 'Species is required for live animal shipments.' });
      if (!pet.ownerConsent) return res.status(400).json({ error: 'Owner consent must be confirmed for live animal shipments.' });
    }

    let trackingId;
    let attempts = 0;
    do {
      trackingId = generateTrackingId();
      const { rows: dup } = await pool.query('SELECT id FROM shipments WHERE tracking_id = $1', [trackingId]);
      if (dup.length === 0) break;
      attempts++;
    } while (attempts < 10);

    const initialStatus = courier_id ? 'picked-up' : 'pending';
    const now = new Date();
    const departedAt = courier_id ? now.toISOString() : null;

    // Arrival time: the admin's explicit date wins; otherwise it is exactly
    // departure (or now, until pickup) + the planned route duration.
    const overridden = !!(eta_overridden && estimated_delivery);
    let estDelivery;
    if (overridden) {
      const d = new Date(estimated_delivery);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid arrival date.' });
      if (d.getTime() <= now.getTime()) return res.status(400).json({ error: 'The arrival date must be in the future.' });
      estDelivery = d.toISOString();
    } else if (Number(route_duration) > 0) {
      estDelivery = new Date(now.getTime() + Number(route_duration) * 1000).toISOString();
    } else if (estimated_delivery) {
      estDelivery = new Date(estimated_delivery).toISOString();
    } else {
      estDelivery = new Date(now.getTime() + 5 * 86400000).toISOString();
    }

    const { rows: inserted } = await pool.query(`
      INSERT INTO shipments (
        tracking_id, sender_name, sender_email, sender_phone,
        receiver_name, receiver_email, receiver_phone,
        origin, destination, origin_lat, origin_lng, dest_lat, dest_lng,
        status, courier_id, customer_id, weight, dimensions, cargo_type,
        description, declared_value, insurance, estimated_delivery, special_instructions,
        route_data, transport_modes, route_distance, route_duration, route_summary,
        departed_at, multi_modal_segments, multi_modal_stops, scheduled_transit_stops,
        pet_details, eta_overridden, route_mode, timeline_events, current_lat, current_lng
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,'[]'::jsonb,$10,$11) RETURNING *
    `, [
      trackingId,
      sender_name, sender_email || null, sender_phone || null,
      receiver_name, receiver_email || null, receiver_phone || null,
      origin, destination,
      origin_lat ?? null, origin_lng ?? null, dest_lat ?? null, dest_lng ?? null,
      initialStatus, courier_id || null, customer_id || null,
      weight || null, dimensions || null, cargo_type || 'General',
      description || null, declared_value || null, insurance ? true : false,
      estDelivery, special_instructions || null,
      asJson(route_data),
      asJson(transport_modes),
      route_distance || null, route_duration || null, route_summary || null,
      departedAt,
      asJson(multi_modal_segments),
      asJson(multi_modal_stops),
      asJson(scheduled_transit_stops) || '[]',
      cargo_type === 'Live Animals' ? asJson(pet_details) : null,
      overridden,
      route_mode || null,
    ]);

    const shipment = inserted[0];
    enrichShipment(shipment);

    if (courier_id) {
      await pool.query(`UPDATE couriers SET status = 'on-delivery' WHERE courier_id = $1 AND status = 'active'`, [courier_id]);
    }

    await logHistory(shipment, { status: initialStatus, location: origin, notes: 'Shipment created.', by: actor(req) });
    await notify('shipment_status', 'New Shipment Created', `Shipment ${trackingId} from ${origin} to ${destination}.`, 'info', `/shipments/${trackingId}`);

    await Promise.allSettled(recipients(shipment).map(async (r) => {
      const emailData = buildShipmentCreationEmail({ shipment, role: r.role });
      const result = await sendMail({ to: r.email, subject: emailData.subject, html: emailData.html, text: emailData.text });
      if (result.success) {
        await pool.query(
          `INSERT INTO email_drafts (type, recipient_email, recipient_name, subject, html_body, text_body, status, related_tracking_id, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'sent', $7, NOW())`,
          ['tracking_update', r.email, r.name, emailData.subject, emailData.html, emailData.text, shipment.tracking_id]
        );
      }
    }));

    res.status(201).json({ shipment });
  } catch (err) {
    console.error('Create shipment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/shipments/:id/status — Update shipment status
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    let s = await findShipment(req.params.id);
    if (!s) return res.status(404).json({ error: 'Shipment not found.' });
    s = await syncTimelineEvents(s);

    const { status, location, lat, lng, notes, pause_category, pause_reason } = req.body;
    const validStatuses = ['pending', 'picked-up', 'in-transit', 'out-for-delivery', 'delivered', 'returned', 'paused'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    // Holds go through the dedicated pause logic (reason, timing, emails).
    if (status === 'paused') {
      const updated = await pauseShipment(s, { category: pause_category || notes || null, reason: pause_reason || null, location, lat, lng, by: actor(req) });
      return res.json({ shipment: enrichShipment(updated) });
    }

    let current = s;
    if (s.is_paused) {
      // Leaving a hold through the status menu resumes it first.
      current = await resumeShipment(s, { by: actor(req), targetStatus: ['delivered', 'returned', 'pending'].includes(status) ? s.status_before_pause || 'in-transit' : status });
    }
    if (current.status === status && status !== 'out-for-delivery') {
      return res.json({ shipment: enrichShipment(current) });
    }

    const nowIso = new Date().toISOString();
    const updates = { status };
    let historyNote = notes || null;

    if (status === 'pending') {
      Object.assign(updates, { departed_at: null, total_paused_ms: 0, progress: 0, timeline_events: '[]', actual_delivery: null });
      if (!current.eta_overridden && Number(current.route_duration) > 0) {
        updates.estimated_delivery = new Date(Date.now() + Number(current.route_duration) * 1000).toISOString();
      }
      await releaseCourier(current.courier_id, current.id);
    } else if (['picked-up', 'in-transit', 'out-for-delivery'].includes(status)) {
      if (!current.departed_at || ['delivered', 'returned'].includes(current.status)) {
        // (Re)starting the journey now.
        updates.departed_at = nowIso;
        updates.total_paused_ms = 0;
        updates.timeline_events = '[]';
        updates.actual_delivery = null;
        updates.estimated_delivery = freshEta({ ...current, eta_overridden: current.status === 'pending' ? current.eta_overridden : false }, nowIso);
        if (current.eta_overridden && current.status === 'pending' && new Date(updates.estimated_delivery).getTime() <= Date.now()) {
          updates.estimated_delivery = freshEta({ ...current, eta_overridden: false }, nowIso);
          updates.eta_overridden = false;
        }
        if (current.courier_id) {
          await pool.query(`UPDATE couriers SET status = 'on-delivery' WHERE courier_id = $1 AND status = 'active'`, [current.courier_id]);
        }
      }
      if (status === 'out-for-delivery') {
        // Jump the simulation to the start of the final delivery leg.
        const probe = { ...current, ...updates };
        const cur = currentState(probe);
        if (cur) {
          const events = T.milestones(cur.plan, cur.timeline);
          const ofd = events.find((e) => e.key === 'out_for_delivery');
          if (ofd && ofd.atHours > cur.clock.elapsedHours) {
            const shiftMs = (ofd.atHours - cur.clock.elapsedHours) * 3.6e6 + 1000;
            updates.departed_at = new Date(new Date(probe.departed_at).getTime() - shiftMs).toISOString();
            updates.estimated_delivery = new Date(new Date(probe.estimated_delivery).getTime() - shiftMs).toISOString();
          }
        }
      }
    } else if (status === 'delivered' || status === 'returned') {
      updates.progress = 100;
      if (status === 'delivered') {
        updates.actual_delivery = nowIso.split('T')[0];
        updates.current_lat = current.dest_lat;
        updates.current_lng = current.dest_lng;
      }
    }

    const keys = Object.keys(updates);
    const sets = keys.map((k, i) => (k === 'timeline_events' ? `${k} = $${i + 1}::jsonb` : `${k} = $${i + 1}`));
    await pool.query(`UPDATE shipments SET ${sets.join(', ')} WHERE id = $${keys.length + 1}`, [...keys.map((k) => updates[k]), current.id]);

    if (lat != null && lng != null) {
      await pool.query('UPDATE shipments SET current_lat = $1, current_lng = $2 WHERE id = $3', [lat, lng, current.id]);
    }

    let updated = await reload(current.id);
    if (['picked-up', 'in-transit', 'out-for-delivery'].includes(status)) {
      await markMilestonesSilently(updated);
      if (status === 'out-for-delivery') {
        await pool.query(`UPDATE shipments SET timeline_events = COALESCE(timeline_events,'[]'::jsonb) || '["out_for_delivery","in_transit"]'::jsonb WHERE id = $1`, [current.id]);
      }
      updated = await reload(current.id);
    }

    if (status === 'delivered' || status === 'returned') {
      if (status === 'delivered' && current.courier_id) {
        await pool.query('UPDATE couriers SET total_deliveries = total_deliveries + 1 WHERE courier_id = $1', [current.courier_id]);
      }
      await releaseCourier(current.courier_id, current.id);
    }

    await logHistory(updated, {
      status,
      location: location || (status === 'delivered' ? current.destination : null),
      lat: lat ?? null,
      lng: lng ?? null,
      notes: historyNote,
      by: actor(req),
    });

    await notify(
      status === 'delivered' ? 'shipment_delivered' : 'shipment_status',
      status === 'delivered' ? 'Shipment Delivered' : 'Shipment Status Updated',
      `${current.tracking_id} is now ${STATUS_LABELS[status] || status}.`,
      status === 'delivered' ? 'success' : status === 'returned' ? 'error' : 'info'
    );
    await emailParties(updated, (r) => buildShipmentStatusChangeEmail({ shipment: updated, newStatus: status, role: r.role, notes: notes || null }));
    await draftForSubscribers({
      trackingId: current.tracking_id, status, statusLabel: STATUS_LABELS[status] || status, location: location || null, notes: historyNote,
    });

    res.json({ shipment: enrichShipment(updated) });
  } catch (err) {
    sendError(res, err, 'Update shipment status error');
  }
});

// PATCH /api/shipments/:id/assign — Assign courier to shipment
router.patch('/:id/assign', authMiddleware, async (req, res) => {
  try {
    const shipment = await findShipment(req.params.id);
    if (!shipment) return res.status(404).json({ error: 'Shipment not found.' });

    const { courier_id } = req.body;
    if (!courier_id) return res.status(400).json({ error: 'courier_id is required.' });

    const { rows: cRows } = await pool.query('SELECT * FROM couriers WHERE courier_id = $1', [courier_id]);
    const courier = cRows[0];
    if (!courier) return res.status(404).json({ error: 'Courier not found.' });

    const previous = shipment.courier_id;
    if (shipment.status === 'pending') {
      const nowIso = new Date().toISOString();
      await pool.query(
        `UPDATE shipments SET courier_id = $1, status = 'picked-up', departed_at = $2, total_paused_ms = 0,
           timeline_events = '[]'::jsonb, estimated_delivery = $3 WHERE id = $4`,
        [courier_id, nowIso, freshEta(shipment, nowIso), shipment.id]
      );
    } else {
      await pool.query('UPDATE shipments SET courier_id = $1 WHERE id = $2', [courier_id, shipment.id]);
    }

    await pool.query("UPDATE couriers SET status = 'on-delivery' WHERE courier_id = $1", [courier_id]);
    if (previous && previous !== courier_id) await releaseCourier(previous, shipment.id);

    await logHistory(shipment, {
      status: shipment.status === 'pending' ? 'picked-up' : shipment.status,
      notes: `Assigned to courier ${courier.name} (${courier_id}).`,
      by: actor(req),
    });

    res.json({ shipment: enrichShipment(await reload(shipment.id)) });
  } catch (err) {
    console.error('Assign courier error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/shipments/:id/pause — Toggle pause/resume
router.patch('/:id/pause', authMiddleware, async (req, res) => {
  try {
    let s = await findShipment(req.params.id);
    if (!s) return res.status(404).json({ error: 'Shipment not found.' });
    s = await syncTimelineEvents(s);
    const { pause_category, pause_reason } = req.body || {};

    const updated = s.is_paused
      ? await resumeShipment(s, { by: actor(req) })
      : await pauseShipment(s, { category: pause_category || null, reason: pause_reason || null, by: actor(req) });
    res.json({ shipment: enrichShipment(updated) });
  } catch (err) {
    sendError(res, err, 'Pause/Resume error');
  }
});

// PATCH /api/shipments/:id/alter-location — Move the shipment along its timeline
router.patch('/:id/alter-location', authMiddleware, async (req, res) => {
  try {
    const shipment = await findShipment(req.params.id);
    if (!shipment) return res.status(404).json({ error: 'Shipment not found.' });

    const { progress, location_name, lat, lng } = req.body;
    const prgNum = parseFloat(progress);
    if (progress === undefined || isNaN(prgNum) || prgNum < 0 || prgNum > 100) {
      return res.status(400).json({ error: 'Invalid progress percentage. Must be between 0 and 100.' });
    }
    if (shipment.status === 'pending') {
      return res.status(400).json({ error: 'Dispatch the shipment before moving it.' });
    }
    // A delivered or returned shipment can be re-opened by moving it back onto
    // its route: the delivery date is cleared and the status recomputed below
    // from the new position. Moving it to 100% leaves it finished.
    const reopening = ['delivered', 'returned'].includes(shipment.status) && prgNum < 100;

    let newDeparted = shipment.departed_at;
    let newEstimated = shipment.estimated_delivery;

    if (shipment.departed_at && shipment.estimated_delivery) {
      const departedMs = new Date(shipment.departed_at).getTime();
      const estStr = String(shipment.estimated_delivery).includes('T')
        ? String(shipment.estimated_delivery)
        : String(shipment.estimated_delivery) + 'T00:00:00.000Z';
      const estimatedMs = new Date(estStr).getTime();
      const totalPausedMs = parseInt(shipment.total_paused_ms) || 0;
      let D_transit = estimatedMs - departedMs - totalPausedMs;
      if (D_transit <= 0 && shipment.route_duration) {
        D_transit = parseFloat(shipment.route_duration) * 1000;
      }

      if (D_transit > 0) {
        const anchorMs = shipment.is_paused && shipment.paused_at
          ? new Date(shipment.paused_at).getTime()
          : Date.now();

        const newDepartedMs = anchorMs - totalPausedMs - (prgNum / 100) * D_transit;
        newDeparted = new Date(newDepartedMs).toISOString();
        newEstimated = new Date(newDepartedMs + D_transit + totalPausedMs).toISOString();
      }
    }

    await pool.query(`
      UPDATE shipments
      SET progress = $1,
          current_lat = COALESCE($2, current_lat),
          current_lng = COALESCE($3, current_lng),
          departed_at = COALESCE($4, departed_at),
          estimated_delivery = COALESCE($5, estimated_delivery),
          actual_delivery = CASE WHEN $6 THEN NULL ELSE actual_delivery END
      WHERE id = $7
    `, [prgNum, lat != null ? parseFloat(lat) : null, lng != null ? parseFloat(lng) : null, newDeparted, newEstimated, reopening, shipment.id]);

    let updated = await reload(shipment.id);
    await markMilestonesSilently(updated);

    // Keep the status consistent with the new position.
    if (!updated.is_paused) {
      const cur = currentState(updated);
      if (cur) {
        const events = T.milestones(cur.plan, cur.timeline);
        const ofd = events.find((e) => e.key === 'out_for_delivery');
        const departed = events.find((e) => e.key === 'in_transit');
        const inLastMile = ofd && cur.clock.elapsedHours >= ofd.atHours;
        const onTheWay = departed && cur.clock.elapsedHours >= departed.atHours;
        let next = updated.status;
        const movable = ['picked-up', 'in-transit', 'out-for-delivery'].concat(reopening ? ['delivered', 'returned'] : []);
        if (inLastMile && movable.includes(updated.status)) next = 'out-for-delivery';
        else if (onTheWay && movable.includes(updated.status) && updated.status !== 'in-transit') next = 'in-transit';
        else if (!onTheWay && movable.includes(updated.status) && updated.status !== 'picked-up') next = 'picked-up';
        if (next !== updated.status) await pool.query('UPDATE shipments SET status = $1 WHERE id = $2', [next, shipment.id]);
      }
    }

    const actionNotes = (reopening ? `Shipment re-opened and moved to ${Math.round(prgNum)}%` : `Location altered to ${Math.round(prgNum)}%`)
      + (location_name ? ` (${location_name})` : '') + ' by administrator.';
    await logHistory(shipment, {
      status: reopening ? (await reload(shipment.id)).status : shipment.status,
      location: location_name || 'En Route',
      lat: lat != null ? parseFloat(lat) : null,
      lng: lng != null ? parseFloat(lng) : null,
      notes: actionNotes,
      by: actor(req),
    });

    updated = await reload(shipment.id);
    res.json({ shipment: enrichShipment(updated) });
  } catch (err) {
    console.error('Alter location error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/shipments/:id — Edit shipment details
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const shipment = await findShipment(req.params.id);
    if (!shipment) return res.status(404).json({ error: 'Shipment not found.' });

    const required = ['sender_name', 'receiver_name', 'origin', 'destination'];
    const optional = ['sender_email', 'sender_phone', 'receiver_email', 'receiver_phone', 'weight', 'dimensions',
      'description', 'declared_value', 'special_instructions'];
    const updates = {};

    for (const key of required) {
      if (req.body[key] === undefined) continue;
      const v = String(req.body[key]).trim();
      if (!v) return res.status(400).json({ error: `${key.replace('_', ' ')} cannot be empty.` });
      updates[key] = v;
    }
    for (const key of optional) {
      if (req.body[key] === undefined) continue;
      const v = req.body[key] === null ? '' : String(req.body[key]).trim();
      updates[key] = v || null;   // empty string clears the field
    }
    if (req.body.cargo_type !== undefined) updates.cargo_type = req.body.cargo_type || 'General';
    if (req.body.insurance !== undefined) updates.insurance = !!req.body.insurance;
    if (req.body.pet_details !== undefined) updates.pet_details = asJson(req.body.pet_details);

    let etaChanged = false;
    if (req.body.estimated_delivery !== undefined && req.body.estimated_delivery !== '') {
      const d = new Date(req.body.estimated_delivery);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid arrival date.' });
      if (shipment.departed_at && d.getTime() <= new Date(shipment.departed_at).getTime() + (parseInt(shipment.total_paused_ms) || 0)) {
        return res.status(400).json({ error: 'The arrival date must be after the departure time.' });
      }
      const current = String(shipment.estimated_delivery || '');
      if (new Date(current).getTime() !== d.getTime()) {
        updates.estimated_delivery = d.toISOString();
        updates.eta_overridden = true;
        etaChanged = true;
      }
    }

    const keys = Object.keys(updates);
    if (keys.length === 0) return res.json({ shipment: enrichShipment(shipment) });

    const sets = keys.map((k, i) => (k === 'pet_details' ? `${k} = $${i + 1}::jsonb` : `${k} = $${i + 1}`));
    await pool.query(`UPDATE shipments SET ${sets.join(', ')} WHERE id = $${keys.length + 1}`, [...keys.map((k) => updates[k]), shipment.id]);

    let updated = await reload(shipment.id);
    if (etaChanged) {
      await markMilestonesSilently(updated);
      await logHistory(updated, {
        status: updated.status,
        notes: `Estimated arrival updated to ${new Date(updates.estimated_delivery).toUTCString()}.`,
        by: actor(req),
      });
      updated = await reload(shipment.id);
    }
    res.json({ shipment: enrichShipment(updated) });
  } catch (err) {
    console.error('Update shipment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/shipments/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const shipment = await findShipment(req.params.id);
    if (!shipment) return res.status(404).json({ error: 'Shipment not found.' });

    await pool.query('DELETE FROM tracking_history WHERE shipment_id = $1', [shipment.id]);
    await pool.query('DELETE FROM shipments WHERE id = $1', [shipment.id]);
    await releaseCourier(shipment.courier_id, shipment.id);
    res.json({ message: 'Shipment deleted successfully.' });
  } catch (err) {
    console.error('Delete shipment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── AIR TRANSIT STOPS ───────────────────────────────────────────────

function scheduledStops(s) {
  const list = T.parseJson(s.scheduled_transit_stops);
  return Array.isArray(list) ? list.filter((v) => v && v.lat != null && v.lng != null) : [];
}

/**
 * Re-plan the remaining flights of an air shipment and save it, keeping the
 * part of the journey that already happened unchanged.
 */
/** Save a re-planned route (segments + stops) and keep the ETA consistent. */
async function saveRoutePlan(s, result, { scheduledStops = null, summary = null, clock = null } = {}) {
  const allCoords = [];
  result.segments.forEach((seg) => allCoords.push(...T.unwrapLine(seg.coordinates)));
  const distanceKm = result.segments.reduce((a, seg) => a + Number(seg.distanceKm || 0), 0);
  const durationSeconds = result.totalHours * 3600;
  const pausedMs = parseInt(s.total_paused_ms) || 0;

  const eta = s.departed_at && s.status !== 'pending'
    ? new Date(new Date(s.departed_at).getTime() + pausedMs + durationSeconds * 1000).toISOString()
    : new Date(Date.now() + durationSeconds * 1000).toISOString();

  // While on hold the frozen progress must match the new timeline length.
  let progress = s.progress;
  if (s.is_paused && clock) progress = Math.round((clock.elapsedHours / result.totalHours) * 1000) / 10;

  const sets = [
    'route_data = $1::jsonb', 'multi_modal_segments = $2::jsonb', 'multi_modal_stops = $3::jsonb',
    'route_duration = $4', 'route_distance = $5', 'estimated_delivery = $6', 'eta_overridden = FALSE', 'progress = $7',
  ];
  const params = [
    JSON.stringify({ type: 'LineString', coordinates: allCoords }),
    JSON.stringify(result.segments),
    JSON.stringify(result.stops),
    durationSeconds,
    Math.round(distanceKm * 1000),
    eta,
    progress,
  ];
  if (scheduledStops) {
    params.push(JSON.stringify(scheduledStops));
    sets.push(`scheduled_transit_stops = $${params.length}::jsonb`);
  }
  if (summary) {
    params.push(summary);
    sets.push(`route_summary = $${params.length}`);
  }
  params.push(s.id);
  await pool.query(`UPDATE shipments SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  return reload(s.id);
}

/** Plan + timeline + elapsed hours for route surgery (works before pickup too). */
function planningContext(s) {
  const plan = T.planFromShipment(s);
  const clock = T.shipmentClock(s);
  const timeline = T.buildTimeline(plan, clock ? clock.windowHours : null);
  const elapsed = clock && s.status !== 'pending' ? clock.elapsedHours : 0;
  return { plan, clock, timeline, elapsed };
}

async function applyAirReroute(s, stopsList, { divertTo = null } = {}) {
  if (['delivered', 'returned'].includes(s.status)) throw httpError(400, `This shipment is already ${s.status}.`);
  const plan = T.planFromShipment(s);
  if (!plan.segments.some((seg) => seg.mode === 'air')) throw httpError(400, 'Transit stops are only available for air freight shipments.');

  // Before pickup the plan is laid out from the start (nothing has happened yet).
  const clock = T.shipmentClock(s);
  const nominal = T.buildTimeline(plan, null);
  const timeline = clock ? T.buildTimeline(plan, clock.windowHours) : nominal;
  const elapsed = clock && s.status !== 'pending' ? clock.elapsedHours : 0;

  const vias = stopsList.map((v) => ({ name: v.name, coords: [Number(v.lng), Number(v.lat)] }));
  const divert = divertTo ? { name: divertTo.name, coords: [Number(divertTo.lng), Number(divertTo.lat)] } : null;
  const result = rerouteAir(plan, timeline, elapsed, vias, divert);

  const allCoords = [];
  result.segments.forEach((seg) => allCoords.push(...T.unwrapLine(seg.coordinates)));
  const distanceKm = result.segments.reduce((a, seg) => a + Number(seg.distanceKm || 0), 0);
  const durationSeconds = result.totalHours * 3600;
  const pausedMs = parseInt(s.total_paused_ms) || 0;

  let departed = s.departed_at;
  let eta;
  if (s.departed_at && s.status !== 'pending') {
    eta = new Date(new Date(s.departed_at).getTime() + pausedMs + durationSeconds * 1000).toISOString();
  } else {
    eta = new Date(Date.now() + durationSeconds * 1000).toISOString();
    departed = s.departed_at;
  }

  // If on hold, the frozen progress must match the new, longer/shorter timeline.
  let progress = s.progress;
  if (s.is_paused && clock) progress = Math.round((elapsed / result.totalHours) * 1000) / 10;

  // Stops the aircraft actually flies through (manual ones plus any diversion).
  const flown = result.stops.filter((st) => st.role === 'transit' && st.scheduled !== false)
    .map((st) => {
      const existing = stopsList.find((v) => v.name === st.name) || {};
      return { name: st.name, lat: st.coords[1], lng: T.wrapLng(st.coords[0]), added_at: existing.added_at || new Date().toISOString() };
    });

  await pool.query(`
    UPDATE shipments
    SET scheduled_transit_stops = $1::jsonb, route_data = $2::jsonb, multi_modal_segments = $3::jsonb,
        multi_modal_stops = $4::jsonb, route_duration = $5, route_distance = $6, estimated_delivery = $7,
        eta_overridden = FALSE, departed_at = $8, progress = $9, route_summary = $10
    WHERE id = $11
  `, [
    JSON.stringify(flown),
    JSON.stringify({ type: 'LineString', coordinates: allCoords }),
    JSON.stringify(result.segments),
    JSON.stringify(result.stops),
    durationSeconds,
    Math.round(distanceKm * 1000),
    eta,
    departed,
    progress,
    result.stops.some((st) => st.role === 'transit') ? 'Air Freight (with transit)' : 'Air Freight',
    s.id,
  ]);
  return reload(s.id);
}

// POST /api/shipments/:id/transit-stop — Add a scheduled transit stop (air only)
router.post('/:id/transit-stop', authMiddleware, async (req, res) => {
  try {
    let s = await findShipment(req.params.id);
    if (!s) return res.status(404).json({ error: 'Shipment not found.' });
    s = await syncTimelineEvents(s);

    const { airport_name, lat, lng, reason } = req.body;
    if (!airport_name || lat === undefined || lng === undefined || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
      return res.status(400).json({ error: 'airport_name, lat, and lng are required.' });
    }
    const list = scheduledStops(s);
    if (list.some((v) => T.haversineKm([Number(v.lng), Number(v.lat)], [parseFloat(lng), parseFloat(lat)]) < 5)) {
      return res.status(409).json({ error: `${airport_name} is already a scheduled stop.` });
    }
    list.push({ name: airport_name, lat: parseFloat(lat), lng: parseFloat(lng), added_at: new Date().toISOString() });

    const updated = await applyAirReroute(s, list);
    await markMilestonesSilently(updated);
    await logHistory(updated, {
      status: updated.status,
      notes: `Added scheduled transit stop at ${airport_name}` + (reason ? `: ${reason}` : ''),
      by: actor(req),
    });
    res.json({ shipment: enrichShipment(await reload(s.id)) });
  } catch (err) {
    sendError(res, err, 'Add transit stop error');
  }
});

// DELETE /api/shipments/:id/transit-stop/:index — Remove an upcoming scheduled stop
router.delete('/:id/transit-stop/:index', authMiddleware, async (req, res) => {
  try {
    let s = await findShipment(req.params.id);
    if (!s) return res.status(404).json({ error: 'Shipment not found.' });
    s = await syncTimelineEvents(s);

    const idx = parseInt(req.params.index);
    const list = scheduledStops(s);
    if (isNaN(idx) || idx < 0 || idx >= list.length) {
      return res.status(400).json({ error: 'Invalid stop index.' });
    }
    const removed = list[idx];

    // A layover that has already started cannot be undone.
    const cur = currentState(s);
    if (cur && s.status !== 'pending') {
      const phase = cur.timeline.phases.find((p) => {
        if (p.type !== 'stop') return false;
        const st = cur.plan.stops[p.index];
        return st.role === 'transit' && T.haversineKm(st.coords, [Number(removed.lng), Number(removed.lat)]) < 5;
      });
      if (phase && cur.clock.elapsedHours >= phase.startHours) {
        return res.status(409).json({ error: `The aircraft has already reached ${removed.name}; this stop can no longer be removed.` });
      }
    }

    list.splice(idx, 1);
    const updated = await applyAirReroute(s, list);
    await markMilestonesSilently(updated);
    await logHistory(updated, { status: updated.status, notes: `Removed scheduled transit stop at ${removed.name}`, by: actor(req) });
    res.json({ shipment: enrichShipment(await reload(s.id)) });
  } catch (err) {
    sendError(res, err, 'Delete transit stop error');
  }
});

// ─── SCHEDULED ROAD STOPS ────────────────────────────────────────────
// Stop a truck anywhere along its route: a rest area, fuel station, parking
// bay or checkpoint. Chosen either by place ("stop here") or by time
// ("stop in 30 minutes"). Air and sea legs cannot be stopped this way.

// POST /api/shipments/:id/road-stop
router.post('/:id/road-stop', authMiddleware, async (req, res) => {
  try {
    let s = await findShipment(req.params.id);
    if (!s) return res.status(404).json({ error: 'Shipment not found.' });
    s = await syncTimelineEvents(s);
    if (['delivered', 'returned'].includes(s.status)) {
      return res.status(400).json({ error: `This shipment is already ${s.status}.` });
    }

    const { lat, lng, in_minutes, duration_minutes, kind, name, note } = req.body || {};
    const waitHours = Number(duration_minutes) > 0 ? Number(duration_minutes) / 60 : 0.5;
    if (Number(duration_minutes) && (Number(duration_minutes) < 1 || Number(duration_minutes) > 72 * 60)) {
      return res.status(400).json({ error: 'The stop must last between 1 minute and 72 hours.' });
    }

    let target;
    if (in_minutes !== undefined && in_minutes !== null && in_minutes !== '') {
      const minutes = Number(in_minutes);
      if (!isFinite(minutes) || minutes <= 0) return res.status(400).json({ error: 'Enter how many minutes from now the stop should happen.' });
      target = { atHours: minutes / 60 };
    } else if (isFinite(Number(lat)) && isFinite(Number(lng))) {
      target = { coords: [Number(lng), Number(lat)] };
    } else {
      return res.status(400).json({ error: 'Give a place (lat/lng) or a time (in_minutes) for the stop.' });
    }

    const { plan, clock, timeline, elapsed } = planningContext(s);
    if (!plan.segments.some((seg) => seg.mode === 'road')) {
      return res.status(400).json({ error: 'This shipment has no road legs.' });
    }
    const result = addRoadStop(plan, timeline, elapsed, target, { waitHours, kind, name, note });
    const updated = await saveRoutePlan(s, result, { clock });
    await markMilestonesSilently(updated);
    await logHistory(updated, {
      status: updated.status,
      location: result.stop.name,
      lat: result.stop.coords[1],
      lng: T.wrapLng(result.stop.coords[0]),
      notes: `Scheduled ${result.stop.label.toLowerCase()} at ${result.stop.name} (${Math.round(result.stop.waitHours * 60)} min).`,
      by: actor(req),
    });
    res.json({ shipment: enrichShipment(await reload(s.id)), stop: result.stop });
  } catch (err) {
    sendError(res, err, 'Add road stop error');
  }
});

// DELETE /api/shipments/:id/road-stop/:stopId — remove an upcoming road stop
router.delete('/:id/road-stop/:stopId', authMiddleware, async (req, res) => {
  try {
    let s = await findShipment(req.params.id);
    if (!s) return res.status(404).json({ error: 'Shipment not found.' });
    s = await syncTimelineEvents(s);

    const { plan, clock, timeline, elapsed } = planningContext(s);
    const target = plan.stops.find((st) => st.role === 'scheduled_road' && st.id === req.params.stopId);
    if (!target) return res.status(404).json({ error: 'Scheduled stop not found.' });
    const phase = timeline.phases.find((p) => p.type === 'stop' && plan.stops[p.index] === target);
    if (phase && elapsed >= phase.startHours) {
      return res.status(409).json({ error: `The shipment has already reached ${target.name}; this stop can no longer be removed.` });
    }

    const result = removeRoadStop(plan, req.params.stopId);
    const updated = await saveRoutePlan(s, result, { clock });
    await markMilestonesSilently(updated);
    await logHistory(updated, { status: updated.status, notes: `Removed scheduled stop at ${result.stop.name}.`, by: actor(req) });
    res.json({ shipment: enrichShipment(await reload(s.id)) });
  } catch (err) {
    sendError(res, err, 'Remove road stop error');
  }
});

// POST /api/shipments/:id/divert — Send an airborne aircraft to a different airport next
router.post('/:id/divert', authMiddleware, async (req, res) => {
  try {
    let s = await findShipment(req.params.id);
    if (!s) return res.status(404).json({ error: 'Shipment not found.' });
    s = await syncTimelineEvents(s);
    const { airport_name, lat, lng, reason } = req.body;
    if (!airport_name || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
      return res.status(400).json({ error: 'airport_name, lat, and lng are required.' });
    }
    if (!isAirborne(s)) {
      return res.status(409).json({ error: 'Diversions are only possible while the aircraft is in flight.' });
    }

    const target = { name: airport_name, lat: parseFloat(lat), lng: parseFloat(lng) };
    const list = scheduledStops(s).filter((v) => T.haversineKm([Number(v.lng), Number(v.lat)], [target.lng, target.lat]) >= 5);
    list.push({ ...target, added_at: new Date().toISOString() });

    const updated = await applyAirReroute(s, list, { divertTo: target });
    await markMilestonesSilently(updated);
    const note = `Flight diverted to ${airport_name}` + (reason ? `: ${reason}` : '');
    await logHistory(updated, { status: updated.status, notes: note, by: actor(req) });
    await notify('shipment_status', 'Flight Diverted', `${s.tracking_id}: ${note}`, 'warning');
    res.json({ shipment: enrichShipment(await reload(s.id)) });
  } catch (err) {
    sendError(res, err, 'Divert flight error');
  }
});

// POST /api/shipments/:id/transit-land — Hold the cargo at the airport it is currently at
router.post('/:id/transit-land', authMiddleware, async (req, res) => {
  try {
    let s = await findShipment(req.params.id);
    if (!s) return res.status(404).json({ error: 'Shipment not found.' });
    s = await syncTimelineEvents(s);
    if (s.is_paused) return res.status(409).json({ error: 'This shipment is already on hold.' });
    if (!ACTIVE_STATUSES.includes(s.status)) {
      return res.status(400).json({ error: 'Only shipments that are on their way can be held at an airport.' });
    }

    const cur = currentState(s);
    const st = cur && cur.state;
    if (!st || st.kind !== 'stop' || !['airport', 'transit_airport'].includes(st.stop?.type)) {
      return res.status(409).json({
        error: st && st.kind === 'move' && st.mode === 'air'
          ? 'The aircraft is still in flight. Divert it to an airport first.'
          : 'The shipment is not at an airport right now.',
      });
    }

    const airport = st.name;
    const reason = (req.body && req.body.reason) || `Held at ${airport}`;
    const updated = await pauseShipment(s, {
      category: 'Transit Stop',
      reason,
      location: airport,
      lat: st.position[1],
      lng: st.position[0],
      by: actor(req),
    });
    res.json({ shipment: enrichShipment(updated) });
  } catch (err) {
    sendError(res, err, 'Transit hold error');
  }
});

module.exports = router;
module.exports.computeProgress = computeProgress;
