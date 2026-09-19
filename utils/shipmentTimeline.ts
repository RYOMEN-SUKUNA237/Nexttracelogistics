/**
 * Shipment timeline model (admin dashboard).
 *
 * Browser copy of server/utils/timeline.js — keep the two in sync.
 * Turns a multi-modal plan (segments + stops) into timed phases and answers
 * "where is the vehicle, which way is it heading and what is it doing" for
 * any moment of the journey.
 */

export type Coord = [number, number];
export type Mode = 'road' | 'air' | 'sea';

export interface PlanPoint {
  name: string;
  coords: Coord;
  iata?: string;
}

export interface PlanSegment {
  mode: Mode;
  coordinates: Coord[];
  from: PlanPoint;
  to: PlanPoint;
  distanceKm: number;
  durationHours: number;
  speedKmh: number;
  label: string;
  icon: string;
  approximate?: boolean;
}

export type StopRole = 'origin_hub' | 'dest_hub' | 'transit' | 'rest' | 'processing' | 'scheduled_road';

export interface PlanStop {
  name: string;
  coords: Coord;
  type: string;
  role: StopRole;
  waitHours: number;
  label: string;
  icon: string;
  afterSegment: number;
  scheduled?: boolean;
  /** Scheduled road stops only: stable id, preset kind and optional note. */
  id?: string;
  kind?: string;
  note?: string;
}

export interface Plan {
  segments: PlanSegment[];
  stops: PlanStop[];
}

export interface Phase {
  type: 'move' | 'stop' | 'hold';
  index: number;
  durationHours: number;
  startHours: number;
  endHours: number;
}

export interface Timeline {
  phases: Phase[];
  totalHours: number;
  nominalHours: number;
}

export interface VehicleState {
  phaseIndex: number;
  phase: Phase;
  kind: 'move' | 'stop';
  mode: string;
  role?: StopRole;
  label: string;
  icon: string;
  name?: string;
  segment?: PlanSegment;
  stop?: PlanStop;
  position: Coord;
  bearing: number;
  phaseFraction: number;
  elapsedHours: number;
  totalHours: number;
  remainingInPhaseHours: number;
}

const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(a: Coord, b: Coord): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return R_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function bearingDeg(a: Coord, b: Coord): number {
  const φ1 = toRad(a[1]);
  const φ2 = toRad(b[1]);
  const Δλ = toRad(b[0] - a[0]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/** Continuous across the antimeridian (so lines don't streak across the map). */
export function unwrapLine(coords: Coord[]): Coord[] {
  if (!Array.isArray(coords) || coords.length === 0) return [];
  const out: Coord[] = [[Number(coords[0][0]), Number(coords[0][1])]];
  for (let i = 1; i < coords.length; i++) {
    let lng = Number(coords[i][0]);
    const prev = out[i - 1][0];
    while (lng - prev > 180) lng -= 360;
    while (lng - prev < -180) lng += 360;
    out.push([lng, Number(coords[i][1])]);
  }
  return out;
}

export function parseJson<T = any>(v: unknown): T | null {
  let p: any = v;
  while (typeof p === 'string') {
    try { p = JSON.parse(p); } catch { return null; }
  }
  return (p ?? null) as T | null;
}

function pointCoords(p: any): Coord | null {
  if (!p) return null;
  if (Array.isArray(p.coords) && p.coords.length >= 2) return [Number(p.coords[0]), Number(p.coords[1])];
  if (p.lat != null && p.lng != null) return [Number(p.lng), Number(p.lat)];
  return null;
}

interface LineMetrics { line: Coord[]; cum: number[]; total: number }
const lineCache = new WeakMap<object, LineMetrics>();

export function lineMetrics(coords: Coord[]): LineMetrics {
  const cached = lineCache.get(coords);
  if (cached) return cached;
  const line = unwrapLine(coords);
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + haversineKm(line[i - 1], line[i]));
  const m = { line, cum, total: cum[cum.length - 1] || 0 };
  lineCache.set(coords, m);
  return m;
}

export function pointAlong(coords: Coord[], fraction: number): { position: Coord; bearing: number } {
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
  return { position: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], bearing: bearingDeg(a, b) };
}

/** Part of a polyline between two fractions of its length. */
export function sliceLine(coords: Coord[], from: number, to: number): Coord[] {
  const { line, cum, total } = lineMetrics(coords);
  if (line.length < 2 || total === 0) return line.slice();
  const a = Math.max(0, from) * total;
  const b = Math.min(1, to) * total;
  const out: Coord[] = [pointAlong(coords, from).position];
  for (let i = 0; i < line.length; i++) if (cum[i] > a && cum[i] < b) out.push(line[i]);
  out.push(pointAlong(coords, to).position);
  return out;
}

function stopRole(stop: any, stops: any[]): StopRole {
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

/** Anything the admin API returns for a shipment. */
export interface ShipmentLike {
  status?: string;
  origin?: string;
  destination?: string;
  origin_lat?: number | string | null;
  origin_lng?: number | string | null;
  dest_lat?: number | string | null;
  dest_lng?: number | string | null;
  route_data?: any;
  route_duration?: number | string | null;
  multi_modal_segments?: any;
  multi_modal_stops?: any;
  departed_at?: string | null;
  estimated_delivery?: string | null;
  total_paused_ms?: number | string | null;
  is_paused?: boolean;
  paused_at?: string | null;
  progress?: number | string | null;
  computed_progress?: number | null;
}

export function planFromShipment(s: ShipmentLike): Plan {
  let rawSegments = parseJson<any[]>(s.multi_modal_segments);
  let rawStops = parseJson<any[]>(s.multi_modal_stops) || [];
  if (!Array.isArray(rawStops)) rawStops = [];

  if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
    const route = parseJson<any>(s.route_data);
    const origin: Coord | null = s.origin_lng != null && s.origin_lat != null ? [Number(s.origin_lng), Number(s.origin_lat)] : null;
    const dest: Coord | null = s.dest_lng != null && s.dest_lat != null ? [Number(s.dest_lng), Number(s.dest_lat)] : null;
    let coords: Coord[] | null = route && Array.isArray(route.coordinates) && route.coordinates.length > 1 ? route.coordinates : null;
    if (!coords && origin && dest) coords = [origin, dest];
    if (!coords) return { segments: [], stops: [] };
    const hours = Number(s.route_duration) > 0 ? Number(s.route_duration) / 3600 : lineMetrics(coords).total / 60;
    rawSegments = [{
      mode: 'road', coordinates: coords,
      from: { name: s.origin || 'Origin', coords: coords[0] },
      to: { name: s.destination || 'Destination', coords: coords[coords.length - 1] },
      distanceKm: Math.round(lineMetrics(coords).total), durationHours: hours, speedKmh: 0,
      label: 'Road transport', icon: '🚛',
    }];
    rawStops = [];
  }

  const segments: PlanSegment[] = rawSegments
    .filter((seg) => seg && Array.isArray(seg.coordinates) && seg.coordinates.length > 0)
    .map((seg) => {
      const first = seg.coordinates[0];
      const last = seg.coordinates[seg.coordinates.length - 1];
      return {
        ...seg,
        mode: seg.mode || 'road',
        durationHours: Number(seg.durationHours) || 0,
        from: { ...(seg.from || {}), name: seg.from?.name || 'Origin', coords: pointCoords(seg.from) || first },
        to: { ...(seg.to || {}), name: seg.to?.name || 'Destination', coords: pointCoords(seg.to) || last },
      };
    });

  const valid = rawStops.filter((st) => st && pointCoords(st));
  const used = new Set<number>();
  const stops: PlanStop[] = valid
    .map((st) => {
      const c = pointCoords(st)!;
      let after: number | null = Number.isInteger(st.afterSegment) ? st.afterSegment : null;
      if (after === null) {
        for (let k = 0; k < segments.length; k++) {
          if (used.has(k)) continue;
          const end = segments[k].to.coords;
          if (Math.abs(wrapLng(end[0] - c[0])) < 0.1 && Math.abs(end[1] - c[1]) < 0.1) { after = k; break; }
        }
      }
      if (after !== null) used.add(after);
      return { ...st, coords: c, waitHours: Number(st.waitHours) || 0, role: stopRole(st, valid), afterSegment: after };
    })
    .filter((st): st is PlanStop => st.afterSegment !== null && st.afterSegment < segments.length);

  return { segments, stops };
}

export function buildTimeline(plan: Plan, actualHours: number | null): Timeline {
  const phases: Phase[] = [];
  const push = (type: Phase['type'], index: number, d: number) =>
    phases.push({ type, index, durationHours: Math.max(0, d), startHours: 0, endHours: 0 });

  plan.stops.forEach((st, si) => { if (st.afterSegment === -1) push('stop', si, st.waitHours); });
  plan.segments.forEach((seg, i) => {
    push('move', i, seg.durationHours);
    plan.stops.forEach((st, si) => { if (st.afterSegment === i) push('stop', si, st.waitHours); });
  });

  const nominal = phases.reduce((a, p) => a + p.durationHours, 0);
  if (nominal <= 0) return { phases: [], totalHours: 0, nominalHours: 0 };
  let total = actualHours != null && actualHours > 0 ? actualHours : nominal;
  // Differences under a minute are rounding, not real waiting time.
  if (total >= nominal && total - nominal < 1 / 60) total = nominal;

  if (total >= nominal) {
    const extra = total - nominal;
    const stopTime = phases.filter((p) => p.type === 'stop').reduce((a, p) => a + p.durationHours, 0);
    if (extra > 1e-9) {
      if (stopTime > 0) phases.forEach((p) => { if (p.type === 'stop') p.durationHours += extra * (p.durationHours / stopTime); });
      else phases.unshift({ type: 'hold', index: -1, durationHours: extra, startHours: 0, endHours: 0 });
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
  return { phases, totalHours: cursor, nominalHours: nominal };
}

export function stateAt(plan: Plan, tl: Timeline, elapsedHours: number): VehicleState | null {
  const { phases, totalHours } = tl;
  if (!phases.length) return null;
  const t = Math.max(0, Math.min(totalHours, elapsedHours));
  let idx = phases.findIndex((p) => t < p.endHours);
  if (idx === -1) idx = phases.length - 1;
  const phase = phases[idx];
  const within = phase.durationHours > 0 ? (t - phase.startHours) / phase.durationHours : 1;
  const base = { phaseIndex: idx, phase, phaseFraction: within, elapsedHours: t, totalHours, remainingInPhaseHours: phase.endHours - t };

  if (phase.type === 'move') {
    const seg = plan.segments[phase.index];
    const { position, bearing } = pointAlong(seg.coordinates, within);
    return { ...base, kind: 'move', mode: seg.mode, label: seg.label, icon: seg.icon, segment: seg, position, bearing };
  }
  if (phase.type === 'hold') {
    const seg = plan.segments[0];
    return {
      ...base, kind: 'stop', mode: 'hold', role: 'processing', label: 'Processing at origin facility', icon: '🏭',
      name: seg.from.name, position: seg.from.coords, bearing: 0,
    };
  }
  const stop = plan.stops[phase.index];
  const prev = plan.segments[stop.afterSegment] || plan.segments[0];
  return {
    ...base, kind: 'stop', mode: stop.type, role: stop.role, label: stop.label, icon: stop.icon, name: stop.name, stop,
    position: stop.coords, bearing: prev ? pointAlong(prev.coordinates, 1).bearing : 0,
  };
}

export interface Clock { windowHours: number; elapsedHours: number }

/** Transit window and active hours elapsed, from the shipment's timestamps. */
export function shipmentClock(s: ShipmentLike, nowMs = Date.now()): Clock | null {
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
  return { windowHours: windowMs / 3.6e6, elapsedHours: elapsedMs / 3.6e6 };
}

/** Timeline progress (0-100) of the point on the route closest to `click`. */
export function progressFromPoint(plan: Plan, tl: Timeline, click: Coord): { progress: number; position: Coord; distanceKm: number } | null {
  let best: { progress: number; position: Coord; distanceKm: number } | null = null;
  for (const phase of tl.phases) {
    if (phase.type !== 'move' || tl.totalHours <= 0) continue;
    const { line, cum, total } = lineMetrics(plan.segments[phase.index].coordinates);
    if (line.length < 2) continue;
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1];
      const b = line[i];
      // Compare in the same longitude "sheet" as the segment.
      let cx = click[0];
      while (cx - a[0] > 180) cx -= 360;
      while (cx - a[0] < -180) cx += 360;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((cx - a[0]) * dx + (click[1] - a[1]) * dy) / len2)) : 0;
      const p: Coord = [a[0] + dx * t, a[1] + dy * t];
      const d = haversineKm([cx, click[1]], p);
      if (!best || d < best.distanceKm) {
        const along = total > 0 ? (cum[i - 1] + (cum[i] - cum[i - 1]) * t) / total : 0;
        const hours = phase.startHours + along * phase.durationHours;
        best = { progress: (hours / tl.totalHours) * 100, position: [wrapLng(p[0]), p[1]], distanceKm: d };
      }
    }
  }
  return best;
}

/** Route split at the vehicle: travelled part and remaining part (per mode). */
export function splitRoute(plan: Plan, tl: Timeline, elapsedHours: number) {
  const done: { mode: Mode; coordinates: Coord[] }[] = [];
  const todo: { mode: Mode; coordinates: Coord[] }[] = [];
  tl.phases.forEach((p) => {
    if (p.type !== 'move') return;
    const seg = plan.segments[p.index];
    if (elapsedHours >= p.endHours) done.push({ mode: seg.mode, coordinates: unwrapLine(seg.coordinates) });
    else if (elapsedHours <= p.startHours) todo.push({ mode: seg.mode, coordinates: unwrapLine(seg.coordinates) });
    else {
      const f = (elapsedHours - p.startHours) / p.durationHours;
      done.push({ mode: seg.mode, coordinates: sliceLine(seg.coordinates, 0, f) });
      todo.push({ mode: seg.mode, coordinates: sliceLine(seg.coordinates, f, 1) });
    }
  });
  return { done, todo };
}

export interface PhaseRow {
  key: string;
  icon: string;
  title: string;
  subtitle: string;
  startHours: number;
  endHours: number;
  kind: 'move' | 'stop' | 'hold';
  mode: string;
  role?: StopRole;
}

/** Human-readable journey steps (driver-rest shifts are merged into one leg). */
export function phaseRows(plan: Plan, tl: Timeline): PhaseRow[] {
  const rows: PhaseRow[] = [];
  tl.phases.forEach((p, i) => {
    if (p.type === 'hold') {
      rows.push({ key: `h${i}`, icon: '🏭', title: 'Processing at origin facility', subtitle: plan.segments[0]?.from.name || '', startHours: p.startHours, endHours: p.endHours, kind: 'hold', mode: 'hold' });
      return;
    }
    if (p.type === 'move') {
      const seg = plan.segments[p.index];
      const title = seg.label.replace(/ \(shift \d+\/\d+\)$/, '');
      const last = rows[rows.length - 1];
      if (last && last.kind === 'move' && last.mode === 'road' && seg.mode === 'road' && last.title === title) {
        last.endHours = p.endHours;
        last.subtitle = last.subtitle.replace(/→ .*$/, `→ ${seg.to.name}`);
        return;
      }
      rows.push({ key: `m${i}`, icon: seg.icon, title, subtitle: `${seg.from.name} → ${seg.to.name}`, startHours: p.startHours, endHours: p.endHours, kind: 'move', mode: seg.mode });
      return;
    }
    const st = plan.stops[p.index];
    if (st.role === 'rest') {
      // Rest breaks belong to the surrounding truck leg.
      const last = rows[rows.length - 1];
      if (last) last.endHours = p.endHours;
      return;
    }
    rows.push({ key: `s${i}`, icon: st.icon, title: st.label, subtitle: st.name, startHours: p.startHours, endHours: p.endHours, kind: 'stop', mode: st.type, role: st.role });
  });
  return rows;
}

export function formatHours(h: number): string {
  if (!isFinite(h)) return '—';
  const mins = Math.max(0, Math.round(h * 60));
  const d = Math.floor(mins / 1440);
  const hr = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${hr}h`;
  if (hr > 0) return `${hr}h ${m}m`;
  return `${m}m`;
}

/** Everything the UI needs about a shipment right now. */
export function liveState(s: ShipmentLike, nowMs = Date.now()) {
  const plan = planFromShipment(s);
  if (!plan.segments.length) return null;
  const clock = shipmentClock(s, nowMs);
  const tl = buildTimeline(plan, clock ? clock.windowHours : null);
  if (!tl.phases.length) return null;
  let elapsed: number;
  if (s.status === 'delivered' || s.status === 'returned') elapsed = tl.totalHours;
  else if (!clock || s.status === 'pending') elapsed = 0;
  else elapsed = clock.elapsedHours;
  return { plan, tl, clock, elapsed, state: stateAt(plan, tl, elapsed)!, progress: tl.totalHours > 0 ? (elapsed / tl.totalHours) * 100 : 0 };
}
