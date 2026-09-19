/**
 * Shipment timeline model (server side).
 *
 * A multi-modal plan is a list of moving segments (road / air / sea) plus
 * stops (hub handling, transit layovers, driver rest). The timeline orders
 * them into phases with durations, then maps elapsed active time to the exact
 * phase, position and heading of the vehicle.
 *
 * The browser has an identical TypeScript copy in utils/shipmentTimeline.ts —
 * keep the two in sync.
 */

const R_KM = 6371;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

function haversineKm(a, b) {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return R_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function bearingDeg(a, b) {
  const φ1 = toRad(a[1]);
  const φ2 = toRad(b[1]);
  const Δλ = toRad(b[0] - a[0]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Longitude in [-180, 180]. */
function wrapLng(lng) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/** Make a polyline continuous across the antimeridian (no ±360° jumps). */
function unwrapLine(coords) {
  if (!Array.isArray(coords) || coords.length === 0) return [];
  const out = [[Number(coords[0][0]), Number(coords[0][1])]];
  for (let i = 1; i < coords.length; i++) {
    let lng = Number(coords[i][0]);
    const prev = out[i - 1][0];
    while (lng - prev > 180) lng -= 360;
    while (lng - prev < -180) lng += 360;
    out.push([lng, Number(coords[i][1])]);
  }
  return out;
}

/** Accept both `{coords:[lng,lat]}` and legacy `{lat,lng}` point shapes. */
function pointCoords(p) {
  if (!p) return null;
  if (Array.isArray(p.coords) && p.coords.length >= 2) return [Number(p.coords[0]), Number(p.coords[1])];
  if (p.lat != null && p.lng != null) return [Number(p.lng), Number(p.lat)];
  return null;
}

function parseJson(v) {
  let p = v;
  while (typeof p === 'string') {
    try { p = JSON.parse(p); } catch { return null; }
  }
  return p;
}

const lineCache = new WeakMap();
function lineMetrics(coords) {
  let cached = lineCache.get(coords);
  if (cached) return cached;
  const line = unwrapLine(coords);
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + haversineKm(line[i - 1], line[i]));
  cached = { line, cum, total: cum[cum.length - 1] || 0 };
  lineCache.set(coords, cached);
  return cached;
}

/** Point and heading at `fraction` (0..1) of a polyline's length. */
function pointAlong(coords, fraction) {
  const { line, cum, total } = lineMetrics(coords);
  if (line.length === 0) return { position: [0, 0], bearing: 0 };
  if (line.length === 1 || total === 0) return { position: line[0], bearing: 0 };
  const target = Math.max(0, Math.min(1, fraction)) * total;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const segLen = cum[i] - cum[i - 1] || 1;
  const t = Math.max(0, Math.min(1, (target - cum[i - 1]) / segLen));
  const a = line[i - 1];
  const b = line[i];
  const position = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { position, bearing: bearingDeg(a, b) };
}

/** Portion of a polyline between two fractions (used to truncate a leg). */
function sliceLine(coords, fromFraction, toFraction) {
  const { line, cum, total } = lineMetrics(coords);
  if (line.length < 2 || total === 0) return line.slice();
  const start = pointAlong(coords, fromFraction).position;
  const end = pointAlong(coords, toFraction).position;
  const a = fromFraction * total;
  const b = toFraction * total;
  const out = [start];
  for (let i = 0; i < line.length; i++) {
    if (cum[i] > a && cum[i] < b) out.push(line[i]);
  }
  out.push(end);
  return out;
}

/** Infer the role of a stop saved before roles existed. */
function stopRole(stop, index, stops) {
  if (stop.role) return stop.role;
  if (stop.type === 'roadside') return 'scheduled_road';
  if (stop.type === 'transit_airport') return 'transit';
  if (stop.icon === '🛫') return 'origin_hub';
  if (stop.icon === '🛬') return 'dest_hub';
  if (stop.type === 'seaport' || stop.type === 'airport') {
    const hubs = stops.filter((s) => s.type === 'seaport' || s.type === 'airport');
    return hubs.indexOf(stop) === 0 ? 'origin_hub' : 'dest_hub';
  }
  return 'transit';
}

/**
 * Normalise a shipment row (or a plan) into { segments, stops } with every
 * stop attached to the segment it follows (`afterSegment`).
 */
function planFromShipment(s) {
  let segments = parseJson(s.multi_modal_segments ?? s.segments);
  let stops = parseJson(s.multi_modal_stops ?? s.transitStops) || [];
  if (!Array.isArray(stops)) stops = [];

  if (!Array.isArray(segments) || segments.length === 0) {
    const route = parseJson(s.route_data);
    const origin = s.origin_lng != null ? [Number(s.origin_lng), Number(s.origin_lat)] : null;
    const dest = s.dest_lng != null ? [Number(s.dest_lng), Number(s.dest_lat)] : null;
    let coords = route && Array.isArray(route.coordinates) && route.coordinates.length > 1 ? route.coordinates : null;
    if (!coords && origin && dest) coords = [origin, dest];
    if (!coords) return { segments: [], stops: [] };
    const hours = Number(s.route_duration) > 0 ? Number(s.route_duration) / 3600 : lineMetrics(coords).total / 60;
    segments = [{
      mode: 'road',
      coordinates: coords,
      from: { name: s.origin || 'Origin', coords: coords[0] },
      to: { name: s.destination || 'Destination', coords: coords[coords.length - 1] },
      distanceKm: Math.round(lineMetrics(coords).total),
      durationHours: hours,
      speedKmh: 0,
      label: 'Road Transport',
      icon: '🚛',
    }];
    stops = [];
  }

  segments = segments
    .filter((seg) => seg && Array.isArray(seg.coordinates) && seg.coordinates.length > 0)
    .map((seg) => {
      const first = seg.coordinates[0];
      const last = seg.coordinates[seg.coordinates.length - 1];
      return {
        ...seg,
        durationHours: Number(seg.durationHours) || 0,
        from: { ...(seg.from || {}), name: seg.from?.name || 'Origin', coords: pointCoords(seg.from) || first },
        to: { ...(seg.to || {}), name: seg.to?.name || 'Destination', coords: pointCoords(seg.to) || last },
      };
    });
  stops = stops
    .filter((st) => st && pointCoords(st))
    .map((st) => ({ ...st, coords: pointCoords(st), waitHours: Number(st.waitHours) || 0 }));

  const used = new Set();
  const placed = stops.map((stop, i) => {
    const role = stopRole(stop, i, stops);
    let after = Number.isInteger(stop.afterSegment) ? stop.afterSegment : null;
    if (after === null) {
      const c = pointCoords(stop);
      for (let k = 0; k < segments.length && c; k++) {
        if (used.has(k)) continue;
        const end = pointCoords(segments[k].to) || segments[k].coordinates[segments[k].coordinates.length - 1];
        if (end && Math.abs(wrapLng(end[0] - c[0])) < 0.1 && Math.abs(end[1] - c[1]) < 0.1) { after = k; break; }
      }
    }
    if (after !== null) used.add(after);
    return { ...stop, role, afterSegment: after };
  }).filter((stop) => stop.afterSegment !== null && stop.afterSegment < segments.length);

  return { segments, stops: placed };
}

/**
 * Ordered phases with nominal durations (hours).
 * phase = { type: 'move'|'stop', index, durationHours }
 */
function nominalPhases(plan) {
  const phases = [];
  const { segments, stops } = plan;
  stops.filter((st) => st.afterSegment === -1).forEach((st) => {
    phases.push({ type: 'stop', index: stops.indexOf(st), durationHours: Math.max(0, Number(st.waitHours) || 0) });
  });
  segments.forEach((seg, i) => {
    phases.push({ type: 'move', index: i, durationHours: Math.max(0, Number(seg.durationHours) || 0) });
    stops.forEach((st, si) => {
      if (st.afterSegment === i) phases.push({ type: 'stop', index: si, durationHours: Math.max(0, Number(st.waitHours) || 0) });
    });
  });
  return phases;
}

/**
 * Fit the nominal phases into the real transit window (`actualHours`).
 * Extra time is spent at stops (handling takes longer — vehicles keep their
 * real speed); if there is less time than planned, everything is compressed.
 */
function buildTimeline(plan, actualHours) {
  const phases = nominalPhases(plan);
  const nominal = phases.reduce((a, p) => a + p.durationHours, 0);
  let total = actualHours != null && actualHours > 0 ? actualHours : nominal;

  if (nominal <= 0) return { phases: [], totalHours: 0, nominalHours: 0 };

  // Differences under a minute are rounding, not real waiting time.
  if (total >= nominal && total - nominal < 1 / 60) total = nominal;

  if (total >= nominal) {
    const extra = total - nominal;
    const stopTime = phases.filter((p) => p.type === 'stop').reduce((a, p) => a + p.durationHours, 0);
    if (extra > 1e-9) {
      if (stopTime > 0) {
        phases.forEach((p) => { if (p.type === 'stop') p.durationHours += extra * (p.durationHours / stopTime); });
      } else {
        // No stops (plain road trip): the parcel waits at the origin facility.
        phases.unshift({ type: 'hold', index: -1, durationHours: extra });
      }
    }
  } else {
    const k = total / nominal;
    phases.forEach((p) => { p.durationHours *= k; });
  }

  let cursor = 0;
  phases.forEach((p) => {
    p.startHours = cursor;
    cursor += p.durationHours;
    p.endHours = cursor;
  });
  total = cursor;
  return { phases, totalHours: total, nominalHours: nominal };
}

/** Everything about the vehicle at `elapsedHours` into the timeline. */
function stateAt(plan, timeline, elapsedHours) {
  const { phases, totalHours } = timeline;
  if (!phases.length) return null;
  const t = Math.max(0, Math.min(totalHours, elapsedHours));
  let idx = phases.findIndex((p) => t < p.endHours);
  if (idx === -1) idx = phases.length - 1;
  const phase = phases[idx];
  const within = phase.durationHours > 0 ? (t - phase.startHours) / phase.durationHours : 1;

  if (phase.type === 'move') {
    const seg = plan.segments[phase.index];
    const { position, bearing } = pointAlong(seg.coordinates, within);
    return {
      phaseIndex: idx, phase, kind: 'move', mode: seg.mode || 'road',
      label: seg.label || '', icon: seg.icon || '',
      from: seg.from, to: seg.to, segment: seg, segmentIndex: phase.index,
      position: [wrapLng(position[0]), position[1]], bearing,
      phaseFraction: within, elapsedHours: t, totalHours,
      remainingInPhaseHours: phase.endHours - t,
    };
  }

  if (phase.type === 'hold') {
    const seg = plan.segments[0];
    const start = pointCoords(seg.from) || seg.coordinates[0];
    return {
      phaseIndex: idx, phase, kind: 'stop', mode: 'hold', role: 'processing',
      label: 'Processing at origin facility', icon: '🏭', name: seg.from?.name || 'Origin',
      position: [wrapLng(start[0]), start[1]], bearing: 0,
      phaseFraction: within, elapsedHours: t, totalHours,
      remainingInPhaseHours: phase.endHours - t,
    };
  }

  const stop = plan.stops[phase.index];
  const c = pointCoords(stop) || [0, 0];
  const prevSeg = plan.segments[stop.afterSegment] || plan.segments[0];
  const prevEnd = prevSeg ? pointAlong(prevSeg.coordinates, 1) : { bearing: 0 };
  return {
    phaseIndex: idx, phase, kind: 'stop', mode: stop.type || 'stop', role: stop.role,
    label: stop.label || '', icon: stop.icon || '', name: stop.name, stop, stopIndex: phase.index,
    position: [wrapLng(c[0]), c[1]], bearing: prevEnd.bearing,
    phaseFraction: within, elapsedHours: t, totalHours,
    remainingInPhaseHours: phase.endHours - t,
  };
}

/** Real transit window (hours) and elapsed active hours for a shipment row. */
function shipmentClock(s, nowMs = Date.now()) {
  if (!s.departed_at || !s.estimated_delivery) return null;
  const departed = new Date(s.departed_at).getTime();
  const estStr = String(s.estimated_delivery);
  const est = new Date(estStr.includes('T') ? estStr : `${estStr}T00:00:00.000Z`).getTime();
  const paused = Number(s.total_paused_ms) || 0;
  let windowMs = est - departed - paused;
  if (windowMs <= 0 && Number(s.route_duration) > 0) windowMs = Number(s.route_duration) * 1000;
  if (windowMs <= 0) return null;
  const anchor = s.is_paused && s.paused_at ? new Date(s.paused_at).getTime() : nowMs;
  const elapsedMs = Math.max(0, Math.min(windowMs, anchor - departed - paused));
  return { windowHours: windowMs / 3.6e6, elapsedHours: elapsedMs / 3.6e6, departedMs: departed, pausedMs: paused };
}

/**
 * Milestones along the timeline, in order. Each has a stable key so it is
 * only acted upon once (see shipments route → syncTimelineEvents).
 */
function milestones(plan, timeline) {
  const events = [];
  const { phases, totalHours } = timeline;
  const lastMove = [...phases].reverse().find((p) => p.type === 'move');
  const destHubPhase = phases.find((p) => p.type === 'stop' && plan.stops[p.index]?.role === 'dest_hub');
  const firstMove = phases.find((p) => p.type === 'move');

  if (firstMove) {
    events.push({ key: 'in_transit', atHours: firstMove.startHours + Math.min(0.25, firstMove.durationHours * 0.1), kind: 'status', status: 'in-transit' });
  }

  phases.forEach((p) => {
    if (p.type !== 'stop') return;
    const stop = plan.stops[p.index];
    const c = pointCoords(stop);
    const where = stop.name;
    const isAir = stop.type === 'airport' || stop.type === 'transit_airport';
    const base = { lat: c ? c[1] : null, lng: c ? wrapLng(c[0]) : null, location: where, stop };
    const id = `${p.index}:${where}`;
    if (stop.role === 'origin_hub') {
      events.push({ ...base, key: `arrive:${id}`, atHours: p.startHours, kind: 'log',
        note: isAir ? `Arrived at ${where} — cargo screening, documentation and loading.` : `Arrived at ${where} — export customs and container loading.` });
      events.push({ ...base, key: `depart:${id}`, atHours: p.endHours, kind: 'log',
        note: isAir ? `Departed ${where} — cargo flight in progress.` : `Vessel departed ${where} — ocean voyage in progress.` });
    } else if (stop.role === 'scheduled_road') {
      events.push({ ...base, key: `arrive:${id}`, atHours: p.startHours, kind: 'roadstop', waitHours: stop.waitHours,
        note: `Stopped at ${where}${stop.note ? ` — ${stop.note}` : ''}.` });
      events.push({ ...base, key: `depart:${id}`, atHours: p.endHours, kind: 'log',
        note: `Departed ${where}; back on the road.` });
    } else if (stop.role === 'transit') {
      events.push({ ...base, key: `arrive:${id}`, atHours: p.startHours, kind: 'layover',
        note: `Landed at ${where} — scheduled transit layover (refuelling & crew change).` });
      events.push({ ...base, key: `depart:${id}`, atHours: p.endHours, kind: 'log',
        note: `Departed ${where} after transit layover.` });
    } else if (stop.role === 'dest_hub') {
      events.push({ ...base, key: `arrive:${id}`, atHours: p.startHours, kind: 'log',
        note: isAir ? `Landed at ${where} — import customs clearance and unloading.` : `Vessel berthed at ${where} — unloading and import customs.` });
      events.push({ ...base, key: `depart:${id}`, atHours: p.endHours, kind: 'log',
        note: `Cleared customs at ${where}.` });
    }
  });

  if (lastMove && destHubPhase && lastMove.startHours >= destHubPhase.endHours - 1e-9) {
    events.push({ key: 'out_for_delivery', atHours: lastMove.startHours + 1e-6, kind: 'status', status: 'out-for-delivery' });
  } else if (lastMove && !destHubPhase && lastMove.durationHours > 0) {
    // Road-only trips: out for delivery for the final stretch (last 10%, max 2h).
    events.push({ key: 'out_for_delivery', atHours: Math.max(lastMove.startHours, totalHours - Math.min(2, lastMove.durationHours * 0.1)), kind: 'status', status: 'out-for-delivery' });
  }
  events.push({ key: 'delivered', atHours: totalHours, kind: 'status', status: 'delivered' });

  return events.sort((a, b) => a.atHours - b.atHours);
}

module.exports = {
  haversineKm,
  bearingDeg,
  wrapLng,
  unwrapLine,
  pointCoords,
  parseJson,
  pointAlong,
  sliceLine,
  lineMetrics,
  planFromShipment,
  nominalPhases,
  buildTimeline,
  stateAt,
  shipmentClock,
  milestones,
};
