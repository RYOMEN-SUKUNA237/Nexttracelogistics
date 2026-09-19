/**
 * Multi-modal transport planner (server side, used by the admin dashboard).
 *
 *  Road : truck on the real road network, with mandatory driver rest breaks.
 *  Air  : truck → nearest cargo airport → cargo flight(s) → destination
 *         airport → last-mile truck.
 *  Sea  : truck → nearest ocean port → vessel on real shipping lanes →
 *         destination port → last-mile truck.
 *
 * Every leg's duration comes from its distance and the vehicle's speed, and
 * every hub adds realistic handling time. The resulting segments and stops
 * are what the timeline (utils/timeline.js) animates.
 */
const searoute = require('searoute-js');
const { findCargoAirport, findCargoSeaport, findMajorAirportsNear } = require('./hubLoader');
const { haversineKm, unwrapLine, wrapLng, lineMetrics, pointAlong, sliceLine } = require('./timeline');

const SPEED = {
  truckCity: 45,      // km/h, used when no road network data is available
  truckHighway: 72,   // km/h, average long-haul truck incl. traffic
  plane: 820,         // km/h, cargo aircraft block speed
  ship: 35,           // km/h (~19 knots), container vessel
};

const HANDLING = {
  airportDeparture: 3,     // cargo acceptance, screening, loading
  airportArrival: 3,       // unloading, import customs
  transitLayover: 2.5,     // refuelling, crew change
  seaportDeparture: 24,    // export customs, container loading
  seaportArrival: 36,      // berthing, unloading, import customs
  driverRest: 10,          // mandatory rest after a full driving shift
};

const TAXI_CLIMB_DESCENT_H = 0.6;   // added to each flight leg
const MAX_DRIVING_SHIFT_H = 10;
const MAX_FLIGHT_LEG_KM = 9000;     // typical freighter range with payload
const TRUCK_FACTOR = 1.2;           // trucks are slower than Mapbox car times
const MAX_POINTS_PER_SEGMENT = 1500;

// ─── Geometry helpers ────────────────────────────────────────────────

function greatCircle(a, b) {
  const toR = (d) => (d * Math.PI) / 180;
  const toD = (r) => (r * 180) / Math.PI;
  const [λ1, φ1] = [toR(a[0]), toR(a[1])];
  const [λ2, φ2] = [toR(b[0]), toR(b[1])];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d < 1e-9) return [a, b];
  const n = Math.max(24, Math.min(256, Math.round((d * 6371) / 60)));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    pts.push([toD(Math.atan2(y, x)), toD(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return unwrapLine(pts);
}

function thin(coords) {
  if (coords.length <= MAX_POINTS_PER_SEGMENT) return coords;
  const step = (coords.length - 1) / (MAX_POINTS_PER_SEGMENT - 1);
  const out = [];
  for (let i = 0; i < MAX_POINTS_PER_SEGMENT; i++) out.push(coords[Math.round(i * step)]);
  return out;
}

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const hub = (name, lng, lat) => ({ name, coords: [round(lng, 5), round(lat, 5)] });

// ─── Road routing ────────────────────────────────────────────────────

async function mapboxDriving(from, to, token) {
  if (!token) return null;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}`
    + `?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data.routes && data.routes[0];
    if (!r || !r.geometry || r.geometry.coordinates.length < 2) return null;
    return { coords: r.geometry.coordinates, distKm: r.distance / 1000, carHours: r.duration / 3600 };
  } catch (err) {
    console.error('[planner] Mapbox directions failed:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A truck leg. Uses the real road network when a Mapbox token is available;
 * otherwise an approximate route (only for short hops, so trucks never
 * "drive" across an ocean).
 */
async function roadLeg(from, to, token, { maxApproxKm = 600 } = {}) {
  const straight = haversineKm(from, to);
  if (straight < 0.3) {
    return { coords: [from, to], distKm: straight, hours: 0.1, approximate: false };
  }
  const route = await mapboxDriving(from, to, token);
  if (route) {
    const hours = Math.max(route.carHours * TRUCK_FACTOR, route.distKm / 90);
    return { coords: thin(route.coords), distKm: route.distKm, hours, approximate: false };
  }
  if (straight > maxApproxKm) return null;
  const distKm = straight * 1.3;
  const speed = distKm < 80 ? SPEED.truckCity : SPEED.truckHighway;
  return { coords: [from, to], distKm, hours: distKm / speed, approximate: true };
}

/**
 * Turn a truck leg into segments + driver-rest stops (one rest after every
 * full driving shift).
 */
function truckSegments(leg, fromHub, toHub, label, speedLabel) {
  const segments = [];
  const stops = [];
  const shifts = Math.max(1, Math.ceil(leg.hours / MAX_DRIVING_SHIFT_H - 1e-9));
  let prev = fromHub;
  for (let i = 0; i < shifts; i++) {
    const f0 = i / shifts;
    const f1 = (i + 1) / shifts;
    const coords = shifts === 1 ? leg.coords : sliceLine(leg.coords, f0, f1);
    const endPoint = coords[coords.length - 1];
    const next = i === shifts - 1 ? toHub : hub('En route', wrapLng(endPoint[0]), endPoint[1]);
    segments.push({
      mode: 'road',
      coordinates: coords,
      from: prev,
      to: next,
      distanceKm: Math.round(leg.distKm / shifts),
      durationHours: leg.hours / shifts,
      speedKmh: Math.round(leg.distKm / Math.max(leg.hours, 0.01)),
      label: shifts > 1 ? `${label} (shift ${i + 1}/${shifts})` : label,
      icon: '🚛',
      approximate: !!leg.approximate || undefined,
      speedLabel,
    });
    if (i < shifts - 1) {
      stops.push({
        name: 'Driver rest area',
        coords: next.coords,
        type: 'rest',
        role: 'rest',
        waitHours: HANDLING.driverRest,
        label: 'Mandatory driver rest break',
        icon: '🛌',
        afterLocal: segments.length - 1,
      });
    }
    prev = next;
  }
  return { segments, stops };
}

// ─── Plan assembly ───────────────────────────────────────────────────

/** Append a truck/flight/voyage block to a plan, fixing stop indices. */
function appendBlock(plan, block) {
  const offset = plan.segments.length;
  plan.segments.push(...block.segments);
  block.stops.forEach((st) => {
    const { afterLocal, ...rest } = st;
    plan.stops.push({ ...rest, afterSegment: offset + afterLocal });
  });
}

function addStopAfterLast(plan, stop) {
  plan.stops.push({ ...stop, afterSegment: plan.segments.length - 1 });
}

function summarise(plan) {
  const legs = [];
  plan.segments.forEach((seg) => {
    const last = legs[legs.length - 1];
    const baseLabel = seg.label.replace(/ \(shift \d+\/\d+\)$/, '');
    if (last && last.mode === 'truck' && seg.mode === 'road' && last.label === baseLabel) {
      last.distanceKm += seg.distanceKm;
      last.durationHours += seg.durationHours;
      last.to = seg.to.name;
      return;
    }
    legs.push({
      mode: seg.mode === 'road' ? 'truck' : seg.mode === 'air' ? 'plane' : 'ship',
      icon: seg.icon,
      label: baseLabel,
      from: seg.from.name,
      to: seg.to.name,
      distanceKm: seg.distanceKm,
      durationHours: seg.durationHours,
      speedKmh: seg.speedKmh,
    });
  });
  const moving = plan.segments.reduce((a, s) => a + s.durationHours, 0);
  const waiting = plan.stops.reduce((a, s) => a + s.waitHours, 0);
  plan.legs = legs;
  plan.totalDurationHours = moving + waiting;
  plan.totalDistanceKm = Math.round(plan.segments.reduce((a, s) => a + s.distanceKm, 0));
  plan.estimatedDeliveryDate = new Date(Date.now() + plan.totalDurationHours * 3.6e6).toISOString();
  plan.approximate = plan.segments.some((s) => s.approximate);
  return plan;
}

function portName(name) {
  const clean = String(name || 'Seaport').replace(/^port of\s+/i, '').trim();
  const titled = clean.toLowerCase().replace(/(^|[\s-])(\w)/g, (m, sep, c) => sep + c.toUpperCase());
  return `Port of ${titled}`;
}

function airportHub(a) {
  const label = a.iata ? `${a.name} (${a.iata})` : a.name;
  return { ...hub(label, a.lng, a.lat), iata: a.iata || '' };
}

/** Along-track position (0..1) of a point between two others. */
function alongTrack(start, end, p) {
  const a = haversineKm(start, p);
  const b = haversineKm(p, end);
  return a / Math.max(a + b, 1e-9);
}

/**
 * The busy airport that adds the least detour to a long flight while keeping
 * both resulting legs within a freighter's range.
 */
function refuelStop(a, b) {
  const arc = greatCircle(a, b);
  const direct = haversineKm(a, b);
  const seen = new Set();
  let best = null;
  for (const f of [0.5, 0.4, 0.6, 0.3, 0.7]) {
    const p = pointAlong(arc, f).position;
    for (const ap of findMajorAirportsNear(p[1], wrapLng(p[0]))) {
      if (seen.has(ap.iata)) continue;
      seen.add(ap.iata);
      const c = [ap.lng, ap.lat];
      const l1 = haversineKm(a, c);
      const l2 = haversineKm(c, b);
      if (l1 < 500 || l2 < 500 || l1 > MAX_FLIGHT_LEG_KM || l2 > MAX_FLIGHT_LEG_KM) continue;
      const detour = l1 + l2 - direct;
      if (!best || detour < best.detour) best = { detour, ap };
    }
  }
  return best ? { ...airportHub(best.ap), auto: true } : null;
}

/**
 * Cargo flight legs from `start` through `vias` to `end`, inserting
 * automatic refuelling stops on legs longer than a freighter's range.
 */
function flightBlock(start, end, vias, { airborneStart = false } = {}) {
  const points = [start];
  const kinds = [];
  vias.forEach((v) => { points.push(v); kinds.push(v.auto ? 'refuel' : 'scheduled'); });
  points.push(end);

  // Automatic refuelling stops (max two levels of splitting)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < points.length - 1; i++) {
      if (haversineKm(points[i].coords, points[i + 1].coords) <= MAX_FLIGHT_LEG_KM) continue;
      const refuel = refuelStop(points[i].coords, points[i + 1].coords);
      if (!refuel) continue;
      points.splice(i + 1, 0, refuel);
      kinds.splice(i, 0, 'refuel');
      i++;
    }
  }

  const segments = [];
  const stops = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dist = haversineKm(a.coords, b.coords);
    const overhead = i === 0 && airborneStart ? TAXI_CLIMB_DESCENT_H / 2 : TAXI_CLIMB_DESCENT_H;
    const hours = dist / SPEED.plane + overhead;
    const legNo = points.length > 2 ? ` (leg ${i + 1}/${points.length - 1})` : '';
    segments.push({
      mode: 'air',
      coordinates: greatCircle(a.coords, b.coords),
      from: { name: a.name, coords: a.coords },
      to: { name: b.name, coords: b.coords },
      distanceKm: Math.round(dist),
      durationHours: hours,
      speedKmh: SPEED.plane,
      label: `Cargo flight${legNo}`,
      icon: '✈️',
    });
    if (i < points.length - 2) {
      const refuel = kinds[i] === 'refuel';
      stops.push({
        name: b.name,
        coords: b.coords,
        type: 'transit_airport',
        role: 'transit',
        scheduled: !refuel,
        waitHours: HANDLING.transitLayover,
        label: refuel ? 'Refuelling stop' : 'Scheduled transit layover',
        icon: refuel ? '⛽' : '🔄',
        afterLocal: segments.length - 1,
      });
    }
  }
  return { segments, stops };
}

/** Sea lanes between two ports, including trans-Pacific crossings. */
function seaLane(from, to) {
  const quiet = (fn) => {
    const log = console.log;
    console.log = () => {};
    try { return fn(); } finally { console.log = log; }
  };
  const pt = (c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [wrapLng(c[0]), c[1]] } });
  const route = (a, b) => quiet(() => searoute(pt(a), pt(b)));
  const nmToKm = 1.852;

  let best = null;
  try {
    const direct = route(from, to);
    best = { coords: direct.geometry.coordinates, km: direct.properties.length * nmToKm };
  } catch (err) {
    console.error('[planner] searoute failed:', err.message);
  }

  // The lane network is split at the antimeridian, so a Pacific crossing is
  // routed as two halves joined at the date line; keep whichever is shorter.
  const crossesPacific = Math.abs(wrapLng(from[0]) - wrapLng(to[0])) > 90;
  if (crossesPacific) {
    for (let lat = -50; lat <= 55; lat += 5) {
      try {
        const west = wrapLng(from[0]) > 0 ? route(from, [179.9, lat]) : route(to, [179.9, lat]);
        const east = wrapLng(from[0]) > 0 ? route([-179.9, lat], to) : route([-179.9, lat], from);
        const w = west.geometry.coordinates;
        const e = east.geometry.coordinates;
        if (Math.abs(w[w.length - 1][1] - e[0][1]) > 1) continue;
        const km = (west.properties.length + east.properties.length) * nmToKm;
        if (!best || km < best.km) {
          let coords = [...w, ...e];
          if (wrapLng(from[0]) <= 0) coords = coords.reverse();
          best = { coords, km };
        }
      } catch { /* try next latitude */ }
    }
  }
  if (!best) return null;
  const coords = unwrapLine([from, ...best.coords, to]);
  return { coords: thin(coords), distKm: lineMetrics(coords).total };
}

// ─── Public planners ─────────────────────────────────────────────────

async function planRoad(o, d, token) {
  const leg = await roadLeg(o.coords, d.coords, token, { maxApproxKm: 1500 });
  if (!leg) return null;
  const plan = { id: 'road', planName: leg.distKm > 600 ? 'Road Freight (Long-Haul Truck)' : 'Road Freight', icon: '🚛', segments: [], stops: [], hubs: {} };
  appendBlock(plan, truckSegments(leg, o, d, leg.distKm > 150 ? 'Long-haul truck' : 'Delivery truck'));
  return summarise(plan);
}

async function planAir(o, d, token, vias = []) {
  const oa = findCargoAirport(o.coords[1], o.coords[0]);
  const da = findCargoAirport(d.coords[1], d.coords[0]);
  if (!oa || !da || (oa.iata && oa.iata === da.iata) || haversineKm([oa.lng, oa.lat], [da.lng, da.lat]) < 150) return null;
  const oHub = airportHub(oa);
  const dHub = airportHub(da);

  const [first, last] = await Promise.all([roadLeg(o.coords, oHub.coords, token), roadLeg(dHub.coords, d.coords, token)]);
  if (!first || !last) return null;

  const plan = { id: 'air', planName: 'Air Freight', icon: '✈️', segments: [], stops: [], hubs: { origin: oHub, destination: dHub } };
  appendBlock(plan, truckSegments(first, o, oHub, `Truck to ${oa.iata || 'airport'}`));
  addStopAfterLast(plan, { name: oHub.name, coords: oHub.coords, type: 'airport', role: 'origin_hub', waitHours: HANDLING.airportDeparture, label: 'Cargo screening & aircraft loading', icon: '🛫' });

  const ordered = [...vias]
    .map((v) => ({ ...v, t: alongTrack(oHub.coords, dHub.coords, v.coords) }))
    .sort((a, b) => a.t - b.t);
  const flights = flightBlock(oHub, dHub, ordered);
  appendBlock(plan, flights);
  if (flights.stops.length) plan.planName = 'Air Freight (with transit)';

  addStopAfterLast(plan, { name: dHub.name, coords: dHub.coords, type: 'airport', role: 'dest_hub', waitHours: HANDLING.airportArrival, label: 'Import customs & cargo unloading', icon: '🛬' });
  appendBlock(plan, truckSegments(last, dHub, d, 'Last-mile delivery truck'));
  return summarise(plan);
}

async function planSea(o, d, token) {
  const op = findCargoSeaport(o.coords[1], o.coords[0]);
  const dp = findCargoSeaport(d.coords[1], d.coords[0]);
  if (!op || !dp || op.name === dp.name || haversineKm([op.lng, op.lat], [dp.lng, dp.lat]) < 300) return null;
  const oHub = hub(portName(op.name), op.lng, op.lat);
  const dHub = hub(portName(dp.name), dp.lng, dp.lat);

  const lane = seaLane(oHub.coords, dHub.coords);
  if (!lane) return null;
  const direct = haversineKm(oHub.coords, dHub.coords);
  if (lane.distKm > direct * 5) return null;

  const [first, last] = await Promise.all([
    roadLeg(o.coords, oHub.coords, token, { maxApproxKm: 2500 }),
    roadLeg(dHub.coords, d.coords, token, { maxApproxKm: 2500 }),
  ]);
  if (!first || !last) return null;

  const plan = { id: 'sea', planName: 'Ocean Freight', icon: '🚢', segments: [], stops: [], hubs: { origin: oHub, destination: dHub } };
  appendBlock(plan, truckSegments(first, o, oHub, 'Truck to port'));
  addStopAfterLast(plan, { name: oHub.name, coords: oHub.coords, type: 'seaport', role: 'origin_hub', waitHours: HANDLING.seaportDeparture, label: 'Export customs & container loading', icon: '🏗️' });
  plan.segments.push({
    mode: 'sea',
    coordinates: lane.coords,
    from: oHub,
    to: dHub,
    distanceKm: Math.round(lane.distKm),
    durationHours: lane.distKm / SPEED.ship,
    speedKmh: SPEED.ship,
    label: 'Container vessel',
    icon: '🚢',
  });
  addStopAfterLast(plan, { name: dHub.name, coords: dHub.coords, type: 'seaport', role: 'dest_hub', waitHours: HANDLING.seaportArrival, label: 'Berthing, unloading & import customs', icon: '🏗️' });
  appendBlock(plan, truckSegments(last, dHub, d, 'Last-mile delivery truck'));
  return summarise(plan);
}

/**
 * All transport options between two places.
 * @param {{name:string, lat:number, lng:number}} origin
 * @param {{name:string, lat:number, lng:number}} destination
 * @param {{token?:string, vias?:Array<{name,lat,lng}>, cargoType?:string}} opts
 */
async function buildPlans(origin, destination, { token, vias = [], cargoType } = {}) {
  const o = hub(origin.name, origin.lng, origin.lat);
  const d = hub(destination.name, destination.lng, destination.lat);
  const straight = haversineKm(o.coords, d.coords);
  const viaHubs = vias.map((v) => hub(v.name, v.lng, v.lat));

  const [road, air, sea] = await Promise.all([
    planRoad(o, d, token).catch((e) => { console.error('[planner] road', e); return null; }),
    straight >= 300 ? planAir(o, d, token, viaHubs).catch((e) => { console.error('[planner] air', e); return null; }) : null,
    straight >= 800 ? planSea(o, d, token).catch((e) => { console.error('[planner] sea', e); return null; }) : null,
  ]);

  const plans = [road, air, sea].filter(Boolean);
  const pick = cargoType === 'Live Animals'
    ? (air || road)
    : straight < 500 ? (road || air) : (air || road || sea);
  if (pick) pick.isRecommended = true;

  plans.forEach((p) => {
    p.transitStops = p.stops;
    delete p.stops;
  });
  return { plans, straightKm: Math.round(straight) };
}

/**
 * Rebuild the flight part of an air shipment after its transit stops change,
 * without rewriting anything that has already happened.
 *
 * @param plan        normalised plan (timeline.planFromShipment)
 * @param timeline    timeline.buildTimeline(plan, windowHours)
 * @param elapsed     active hours since departure
 * @param vias        desired transit airports [{name, coords}], in any order
 * @param divertTo    optional airport the aircraft must land at next
 * @returns {{segments, stops, totalHours}} or throws Error with a user message
 */
function rerouteAir(plan, timeline, elapsed, vias, divertTo = null) {
  const { segments, stops } = plan;
  const phases = timeline.phases;
  const originIdx = stops.findIndex((s) => s.role === 'origin_hub' && (s.type === 'airport'));
  const destIdx = stops.findIndex((s) => s.role === 'dest_hub' && (s.type === 'airport'));
  if (originIdx === -1 || destIdx === -1) {
    const err = new Error('This shipment is not travelling by air.');
    err.status = 400;
    throw err;
  }
  const destPhase = phases.find((p) => p.type === 'stop' && p.index === destIdx);
  if (elapsed >= destPhase.startHours) {
    const err = new Error('The aircraft has already landed at the destination airport.');
    err.status = 400;
    throw err;
  }

  const out = { segments: [], stops: [] };
  const originPhasePos = phases.findIndex((p) => p.type === 'stop' && p.index === originIdx);
  let anchor = { name: stops[originIdx].name, coords: stops[originIdx].coords };
  let airborne = false;
  const visited = new Set();

  for (let k = 0; k < phases.length; k++) {
    const p = phases[k];
    const beforeTakeoff = k <= originPhasePos;
    const started = elapsed >= p.startHours;

    if (p.type === 'hold') {
      // Waiting time becomes an explicit processing stop before the first leg.
      out.stops.push({ name: segments[0].from.name, coords: segments[0].from.coords, type: 'facility', role: 'processing', waitHours: p.durationHours, label: 'Processing at origin facility', icon: '🏭', afterSegment: -1 });
      continue;
    }

    if (beforeTakeoff) {
      // Pickup truck, driver rests and airport handling: always kept as planned.
      if (p.type === 'move') out.segments.push({ ...segments[p.index], durationHours: p.durationHours });
      else out.stops.push({ ...stops[p.index], waitHours: p.durationHours, afterSegment: out.segments.length - 1 });
      continue;
    }

    if (!started) break;

    if (p.type === 'move') {
      const seg = segments[p.index];
      if (elapsed >= p.endHours) {
        out.segments.push({ ...seg, durationHours: p.durationHours });
        continue;
      }
      // In the air right now: keep the flown part and continue from here.
      const f = p.durationHours > 0 ? (elapsed - p.startHours) / p.durationHours : 0;
      const coords = sliceLine(seg.coordinates, 0, f);
      const here = coords[coords.length - 1];
      const hereHub = { name: 'In flight', coords: [round(here[0], 5), round(here[1], 5)] };
      out.segments.push({ ...seg, coordinates: coords, to: hereHub, durationHours: elapsed - p.startHours, distanceKm: Math.round(seg.distanceKm * f) });
      anchor = hereHub;
      airborne = true;
      break;
    }

    // A layover that has started (possibly still in progress) is kept whole.
    const stop = stops[p.index];
    out.stops.push({ ...stop, waitHours: p.durationHours, afterSegment: out.segments.length - 1 });
    visited.add(`${stop.name}|${stop.coords.join()}`);
    anchor = { name: stop.name, coords: stop.coords };
  }

  const destStop = stops[destIdx];
  const destHub = { name: destStop.name, coords: destStop.coords };
  const remaining = vias
    .filter((v) => !visited.has(`${v.name}|${v.coords.join()}`))
    .filter((v) => haversineKm(v.coords, anchor.coords) > 30)
    .map((v) => ({ ...v, t: alongTrack(anchor.coords, destHub.coords, v.coords) }))
    .sort((a, b) => a.t - b.t);
  if (divertTo) {
    const key = `${divertTo.name}|${divertTo.coords.join()}`;
    const rest = remaining.filter((v) => `${v.name}|${v.coords.join()}` !== key);
    remaining.length = 0;
    remaining.push(divertTo, ...rest);
  }

  const flights = flightBlock(anchor, destHub, remaining, { airborneStart: airborne });
  const offset = out.segments.length;
  out.segments.push(...flights.segments);
  flights.stops.forEach(({ afterLocal, ...st }) => out.stops.push({ ...st, afterSegment: offset + afterLocal }));

  out.stops.push({ ...destStop, afterSegment: out.segments.length - 1 });
  // Everything after the destination airport (last-mile legs and rests) is unchanged.
  const lastMileStart = destStop.afterSegment + 1;
  const shift = out.segments.length - lastMileStart;
  segments.slice(lastMileStart).forEach((seg) => out.segments.push(seg));
  stops.filter((s) => s.afterSegment >= lastMileStart).forEach((s) => out.stops.push({ ...s, afterSegment: s.afterSegment + shift }));

  const totalHours = out.segments.reduce((a, s) => a + Number(s.durationHours || 0), 0)
    + out.stops.reduce((a, s) => a + Number(s.waitHours || 0), 0);
  return { ...out, totalHours };
}

// ─── Scheduled road stops ────────────────────────────────────────────
// A stop anywhere along a truck leg: a rest area, fuel station, parking bay,
// checkpoint… The leg is split in two at that point and the vehicle waits
// there. Air and sea legs cannot be stopped this way — only road.

const ROAD_STOP_PRESETS = {
  rest: { label: 'Scheduled rest stop', icon: '🛌' },
  fuel: { label: 'Refuelling stop', icon: '⛽' },
  parking: { label: 'Parking / holding bay', icon: '🅿️' },
  roadside: { label: 'Roadside stop', icon: '🛑' },
  checkpoint: { label: 'Checkpoint / weighbridge', icon: '🚧' },
  delivery: { label: 'Intermediate drop-off', icon: '📦' },
  meal: { label: 'Driver break', icon: '☕' },
};

/** Point on a polyline closest to `target`, with its distance along the line. */
function closestOnLine(coords, target) {
  const { line, cum, total } = lineMetrics(coords);
  let best = null;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    let tx = target[0];
    while (tx - a[0] > 180) tx -= 360;
    while (tx - a[0] < -180) tx += 360;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((tx - a[0]) * dx + (target[1] - a[1]) * dy) / len2)) : 0;
    const p = [a[0] + dx * t, a[1] + dy * t];
    const d = haversineKm([tx, target[1]], p);
    if (!best || d < best.distanceKm) {
      best = { distanceKm: d, position: p, fraction: total > 0 ? (cum[i - 1] + haversineKm(a, p)) / total : 0 };
    }
  }
  return best;
}

/**
 * Add a stop to a truck leg.
 *
 * @param plan      normalised plan (timeline.planFromShipment)
 * @param timeline  timeline.buildTimeline(plan, windowHours)
 * @param elapsed   active hours since departure (0 before pickup)
 * @param target    { atHours } — this many hours from now — or { coords: [lng,lat] }
 * @param opts      { waitHours, kind, name, note }
 * @returns {{segments, stops, totalHours, stop}}
 */
function addRoadStop(plan, timeline, elapsed, target, opts = {}) {
  const waitHours = Math.max(1 / 60, Number(opts.waitHours) || 0.5);
  const preset = ROAD_STOP_PRESETS[opts.kind] || ROAD_STOP_PRESETS.roadside;
  const fail = (msg) => { const e = new Error(msg); e.status = 400; throw e; };

  // Where on the timeline should the stop go?
  let phase;
  let fraction;
  if (target.atHours != null) {
    const at = elapsed + Number(target.atHours);
    if (!(at > elapsed)) fail('Choose a time in the future.');
    if (at >= timeline.totalHours) fail('That is after the shipment arrives — pick an earlier time.');
    phase = timeline.phases.find((p) => at >= p.startHours && at < p.endHours);
    if (!phase) fail('Nothing is scheduled at that time.');
    if (phase.type !== 'move') fail('The shipment is already stopped at that time — pick another moment.');
    if (plan.segments[phase.index].mode !== 'road') {
      fail(`At that time the shipment is ${plan.segments[phase.index].mode === 'air' ? 'in the air' : 'at sea'}. Road stops are only possible on truck legs.`);
    }
    fraction = phase.durationHours > 0 ? (at - phase.startHours) / phase.durationHours : 0;
  } else {
    const coords = target.coords;
    let best = null;
    timeline.phases.forEach((p) => {
      if (p.type !== 'move' || plan.segments[p.index].mode !== 'road') return;
      if (p.endHours <= elapsed) return;                       // already driven
      const hit = closestOnLine(plan.segments[p.index].coordinates, coords);
      if (!hit) return;
      if (!best || hit.distanceKm < best.hit.distanceKm) best = { p, hit };
    });
    if (!best) fail('This shipment has no upcoming road legs to stop on.');
    if (best.hit.distanceKm > 25) fail(`That place is ${Math.round(best.hit.distanceKm)} km from the route — pick somewhere along it.`);
    phase = best.p;
    fraction = best.hit.fraction;
    const atHours = phase.startHours + fraction * phase.durationHours;
    if (atHours <= elapsed) fail('The shipment has already passed that point.');
  }

  const segIndex = phase.index;
  const seg = plan.segments[segIndex];
  const f = Math.min(0.999, Math.max(0.001, fraction));
  const firstCoords = sliceLine(seg.coordinates, 0, f);
  const secondCoords = sliceLine(seg.coordinates, f, 1);
  const point = firstCoords[firstCoords.length - 1];
  const name = String(opts.name || '').trim() || `${preset.label} near ${point[1].toFixed(2)}, ${round(wrapLng(point[0]), 2)}`;
  const stopPoint = { name, coords: [round(point[0], 5), round(point[1], 5)] };

  const segments = plan.segments.map((s, i) => (i === segIndex
    ? { ...s, coordinates: firstCoords, to: stopPoint, distanceKm: Math.round(s.distanceKm * f), durationHours: s.durationHours * f }
    : s));
  segments.splice(segIndex + 1, 0, {
    ...seg,
    coordinates: secondCoords,
    from: stopPoint,
    distanceKm: Math.round(seg.distanceKm * (1 - f)),
    durationHours: seg.durationHours * (1 - f),
  });

  const stop = {
    id: `road-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    coords: stopPoint.coords,
    type: 'roadside',
    role: 'scheduled_road',
    kind: opts.kind || 'roadside',
    waitHours,
    label: preset.label,
    icon: preset.icon,
    note: opts.note ? String(opts.note).slice(0, 200) : undefined,
    afterSegment: segIndex,
  };
  // Stops sit at the end of their leg, so everything that was at the end of
  // the split leg (airport handling, driver rests…) moves to the second half.
  const stops = plan.stops
    .map((s) => (s.afterSegment >= segIndex ? { ...s, afterSegment: s.afterSegment + 1 } : { ...s }))
    .concat(stop)
    .sort((a, b) => a.afterSegment - b.afterSegment);

  const totalHours = segments.reduce((a, s) => a + Number(s.durationHours || 0), 0)
    + stops.reduce((a, s) => a + Number(s.waitHours || 0), 0);
  return { segments, stops, totalHours, stop };
}

/** Remove a scheduled road stop and join the two halves of its leg back together. */
function removeRoadStop(plan, stopId) {
  const idx = plan.stops.findIndex((s) => s.role === 'scheduled_road' && (s.id === stopId || String(s.afterSegment) === String(stopId)));
  if (idx === -1) {
    const e = new Error('Scheduled stop not found.');
    e.status = 404;
    throw e;
  }
  const stop = plan.stops[idx];
  const first = stop.afterSegment;
  const second = first + 1;
  const a = plan.segments[first];
  const b = plan.segments[second];
  const segments = plan.segments.slice();
  if (a && b && a.mode === 'road' && b.mode === 'road') {
    segments.splice(first, 2, {
      ...a,
      coordinates: [...a.coordinates, ...b.coordinates.slice(1)],
      to: b.to,
      distanceKm: Math.round(Number(a.distanceKm || 0) + Number(b.distanceKm || 0)),
      durationHours: Number(a.durationHours || 0) + Number(b.durationHours || 0),
    });
  }
  const merged = segments.length < plan.segments.length;
  const stops = plan.stops
    .filter((_, i) => i !== idx)
    .map((s) => ({ ...s, afterSegment: merged && s.afterSegment > first ? s.afterSegment - 1 : s.afterSegment }));

  const totalHours = segments.reduce((acc, s) => acc + Number(s.durationHours || 0), 0)
    + stops.reduce((acc, s) => acc + Number(s.waitHours || 0), 0);
  return { segments, stops, totalHours, stop };
}

module.exports = { buildPlans, rerouteAir, addRoadStop, removeRoadStop, greatCircle, ROAD_STOP_PRESETS, HANDLING, SPEED };
