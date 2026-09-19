/**
 * Smart Routing API
 *
 * GET  /api/routing/nearest-hub?lat=&lng=&type=airport|seaport&limit=1
 *      Returns nearest hub(s) from local CSV datasets.
 *
 * POST /api/routing/plan
 *      Body: { originLat, originLng, destLat, destLng, mode: 'land'|'air'|'sea', mapboxToken }
 *      Returns full multi-modal plan with legs & GeoJSON segments.
 *
 * GET  /api/routing/stats
 *      Returns count of loaded airports/seaports.
 */

const express = require('express');
const router = express.Router();
const { findNearestAirports, findNearestSeaports, findNearestHub, getStats } = require('../utils/hubLoader');
const { authMiddleware } = require('../middleware/auth');
const { buildPlans } = require('../utils/transportPlanner');

// ─── POST /api/routing/plans (admin) ──────────────────────────────────────────
// Body: { origin: {name,lat,lng}, destination: {name,lat,lng}, vias?: [{name,lat,lng}],
//         cargoType?, mapboxToken? }
// Returns every realistic transport option (road / air / sea) with segments,
// stops and timings — used by the admin "Create Shipment" planner.
router.post('/plans', authMiddleware, async (req, res) => {
  try {
    const { origin, destination, vias = [], cargoType, mapboxToken } = req.body || {};
    const valid = (p) => p && typeof p.name === 'string' && isFinite(p.lat) && isFinite(p.lng)
      && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
    if (!valid(origin) || !valid(destination)) {
      return res.status(400).json({ error: 'origin and destination must include name, lat and lng.' });
    }
    if (!Array.isArray(vias) || vias.length > 6 || !vias.every(valid)) {
      return res.status(400).json({ error: 'vias must be a list of up to 6 airports with name, lat and lng.' });
    }
    const token = process.env.MAPBOX_TOKEN || (typeof mapboxToken === 'string' && mapboxToken.startsWith('pk.') ? mapboxToken : null);
    const result = await buildPlans(
      { name: origin.name, lat: Number(origin.lat), lng: Number(origin.lng) },
      { name: destination.name, lat: Number(destination.lat), lng: Number(destination.lng) },
      { token, vias: vias.map((v) => ({ name: v.name, lat: Number(v.lat), lng: Number(v.lng) })), cargoType }
    );
    res.json({ ...result, roadNetwork: !!token });
  } catch (err) {
    console.error('[routing] plans error:', err);
    res.status(500).json({ error: 'Route planning failed.' });
  }
});

// ─── Haversine (used inline for flight calcs) ─────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Great Circle Arc (browser-compatible, server-side GeoJSON) ───────────────
function greatCircleArc(from, to, numPoints = 120) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  const lat1 = toRad(from.lat); const lon1 = toRad(from.lng);
  const lat2 = toRad(to.lat);   const lon2 = toRad(to.lng);

  const d = 2 * Math.asin(
    Math.sqrt(
      Math.sin((lat2 - lat1) / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
    )
  );

  if (d < 1e-10) return [[from.lng, from.lat], [to.lng, to.lat]];

  const pts = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    pts.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return pts;
}

function straightLine(from, to, numPoints = 120) {
  const pts = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    pts.push([
      from.lng + (to.lng - from.lng) * f,
      from.lat + (to.lat - from.lat) * f
    ]);
  }
  return pts;
}

// ─── Mapbox Directions Proxy (called from server to avoid CORS issues) ────────
async function getMapboxRoute(fromLng, fromLat, toLng, toLat, token) {
  if (!token) return null;
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${fromLng},${fromLat};${toLng},${toLat}` +
      `?geometries=geojson&overview=full&access_token=${token}`;

    // Abort the request if Mapbox doesn't respond within 8 seconds
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let res;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const r = data.routes[0];
      return {
        coordinates: r.geometry.coordinates,
        distanceKm: r.distance / 1000,
        durationHours: r.duration / 3600,
      };
    }
  } catch (e) {
    console.error('[routing] Mapbox route error:', e.message);
  }
  // Fallback: straight line
  const dist = haversineKm(fromLat, fromLng, toLat, toLng);
  return {
    coordinates: [[fromLng, fromLat], [toLng, toLat]],
    distanceKm: dist,
    durationHours: dist / 80, // 80 km/h avg land speed
  };
}

// Speed constants (km/h)
const SPEEDS = { truck: 75, plane: 850, ship: 35 };

// Hub wait times (hours)
const WAIT = {
  airportBoarding: 3,
  airportArrival: 2,
  seaportLoading: 8,
  seaportUnloading: 6,
};

// ─── GET /api/routing/nearest-hub ─────────────────────────────────────────────
router.get('/nearest-hub', (req, res) => {
  const { lat, lng, type = 'airport', limit = 1 } = req.query;
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  const parsedLimit = Math.min(parseInt(limit) || 1, 10);

  if (isNaN(parsedLat) || isNaN(parsedLng)) {
    return res.status(400).json({ error: 'lat and lng are required numeric parameters.' });
  }

  if (type === 'airport') {
    const results = findNearestAirports(parsedLat, parsedLng, parsedLimit);
    return res.json({ type: 'airport', results });
  }
  if (type === 'seaport') {
    const results = findNearestSeaports(parsedLat, parsedLng, parsedLimit);
    return res.json({ type: 'seaport', results });
  }

  return res.status(400).json({ error: 'type must be "airport" or "seaport".' });
});

// ─── GET /api/routing/stats ───────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  res.json(getStats());
});

// ─── POST /api/routing/plan ───────────────────────────────────────────────────
router.post('/plan', async (req, res) => {
  try {
    const {
      originLat, originLng,
      destLat, destLng,
      mode,          // 'land' | 'air' | 'sea'
      mapboxToken,   // optional — passed from frontend
    } = req.body;

    const oLat = parseFloat(originLat);
    const oLng = parseFloat(originLng);
    const dLat = parseFloat(destLat);
    const dLng = parseFloat(destLng);

    if (isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) {
      return res.status(400).json({ error: 'originLat, originLng, destLat, destLng are required.' });
    }

    if (!['land', 'air', 'sea'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be "land", "air", or "sea".' });
    }

    const token = mapboxToken || process.env.MAPBOX_TOKEN || null;
    const straightKm = haversineKm(oLat, oLng, dLat, dLng);

    // ── LAND ──────────────────────────────────────────────────────────────────
    if (mode === 'land') {
      const road = await getMapboxRoute(oLng, oLat, dLng, dLat, token);
      const plan = {
        mode: 'land',
        segments: [{
          mode: 'road',
          coordinates: road.coordinates,
          from: { lat: oLat, lng: oLng },
          to: { lat: dLat, lng: dLng },
          distanceKm: Math.round(road.distanceKm),
          durationHours: road.durationHours,
          speedKmh: SPEEDS.truck,
          label: road.distanceKm > 500 ? 'Long-Haul Truck' : 'Road Delivery',
          icon: '🚛',
        }],
        transitStops: [],
        totalDistanceKm: Math.round(road.distanceKm),
        totalDurationHours: road.durationHours,
        straightLineKm: Math.round(straightKm),
      };
      return res.json({ plan });
    }

    // ── AIR ───────────────────────────────────────────────────────────────────
    if (mode === 'air') {
      const oAirportArr = findNearestAirports(oLat, oLng, 1);
      const dAirportArr = findNearestAirports(dLat, dLng, 1);

      const oAirport = oAirportArr[0] || { name: 'Origin Airport', lat: oLat, lng: oLng, distanceKm: 0 };
      const dAirport = dAirportArr[0] || { name: 'Destination Airport', lat: dLat, lng: dLng, distanceKm: 0 };

      // Leg 1: Land — Origin → Nearest Airport A
      const leg1Road = await getMapboxRoute(oLng, oLat, oAirport.lng, oAirport.lat, token);

      // Leg 2: Air — Airport A → Airport B (Great Circle)
      const flightKm = haversineKm(oAirport.lat, oAirport.lng, dAirport.lat, dAirport.lng);
      const flightHours = flightKm / SPEEDS.plane;
      const arcCoords = greatCircleArc(
        { lat: oAirport.lat, lng: oAirport.lng },
        { lat: dAirport.lat, lng: dAirport.lng },
        150
      );

      // Leg 3: Land — Nearest Airport B → Destination
      const leg3Road = await getMapboxRoute(dAirport.lng, dAirport.lat, dLng, dLat, token);

      const segments = [
        {
          mode: 'road',
          coordinates: leg1Road.coordinates,
          from: { lat: oLat, lng: oLng, name: 'Origin' },
          to: { lat: oAirport.lat, lng: oAirport.lng, name: oAirport.name },
          distanceKm: Math.round(leg1Road.distanceKm),
          durationHours: leg1Road.durationHours,
          speedKmh: SPEEDS.truck,
          label: 'Truck to Airport',
          icon: '🚛',
        },
        {
          mode: 'air',
          coordinates: arcCoords,
          from: { lat: oAirport.lat, lng: oAirport.lng, name: oAirport.name },
          to: { lat: dAirport.lat, lng: dAirport.lng, name: dAirport.name },
          distanceKm: Math.round(flightKm),
          durationHours: flightHours,
          speedKmh: SPEEDS.plane,
          label: 'Cargo Flight',
          icon: '✈️',
        },
        {
          mode: 'road',
          coordinates: leg3Road.coordinates,
          from: { lat: dAirport.lat, lng: dAirport.lng, name: dAirport.name },
          to: { lat: dLat, lng: dLng, name: 'Destination' },
          distanceKm: Math.round(leg3Road.distanceKm),
          durationHours: leg3Road.durationHours,
          speedKmh: SPEEDS.truck,
          label: 'Last-Mile Delivery',
          icon: '🚛',
        },
      ];

      const transitStops = [
        {
          name: oAirport.name,
          coords: [oAirport.lng, oAirport.lat],
          type: 'airport',
          waitHours: WAIT.airportBoarding,
          label: 'Boarding & Security Check',
          icon: '🛫',
          iata: oAirport.iata || '',
        },
        {
          name: dAirport.name,
          coords: [dAirport.lng, dAirport.lat],
          type: 'airport',
          waitHours: WAIT.airportArrival,
          label: 'Customs & Cargo Unloading',
          icon: '🛬',
          iata: dAirport.iata || '',
        },
      ];

      const totalHours =
        leg1Road.durationHours + WAIT.airportBoarding +
        flightHours + WAIT.airportArrival +
        leg3Road.durationHours;

      const plan = {
        mode: 'air',
        segments,
        transitStops,
        hubs: { origin: oAirport, destination: dAirport },
        totalDistanceKm: Math.round(leg1Road.distanceKm + flightKm + leg3Road.distanceKm),
        totalDurationHours: totalHours,
        straightLineKm: Math.round(straightKm),
      };

      return res.json({ plan });
    }

    // ── SEA ───────────────────────────────────────────────────────────────────
    if (mode === 'sea') {
      const oPortArr = findNearestSeaports(oLat, oLng, 1);
      const dPortArr = findNearestSeaports(dLat, dLng, 1);

      const oPort = oPortArr[0] || { name: 'Origin Seaport', lat: oLat, lng: oLng, distanceKm: 0 };
      const dPort = dPortArr[0] || { name: 'Destination Seaport', lat: dLat, lng: dLng, distanceKm: 0 };

      // Leg 1: Land — Origin → Nearest Seaport A
      const leg1Road = await getMapboxRoute(oLng, oLat, oPort.lng, oPort.lat, token);

      // Leg 2: Sea — Seaport A → Seaport B (Great Circle)
      const seaKm = haversineKm(oPort.lat, oPort.lng, dPort.lat, dPort.lng);
      const seaHours = seaKm / SPEEDS.ship;
      const seaArcCoords = greatCircleArc(
        { lat: oPort.lat, lng: oPort.lng },
        { lat: dPort.lat, lng: dPort.lng },
        200
      );

      // Leg 3: Land — Nearest Seaport B → Destination
      const leg3Road = await getMapboxRoute(dPort.lng, dPort.lat, dLng, dLat, token);

      const segments = [
        {
          mode: 'road',
          coordinates: leg1Road.coordinates,
          from: { lat: oLat, lng: oLng, name: 'Origin' },
          to: { lat: oPort.lat, lng: oPort.lng, name: oPort.name },
          distanceKm: Math.round(leg1Road.distanceKm),
          durationHours: leg1Road.durationHours,
          speedKmh: SPEEDS.truck,
          label: 'Truck to Seaport',
          icon: '🚛',
        },
        {
          mode: 'sea',
          coordinates: seaArcCoords,
          from: { lat: oPort.lat, lng: oPort.lng, name: oPort.name },
          to: { lat: dPort.lat, lng: dPort.lng, name: dPort.name },
          distanceKm: Math.round(seaKm),
          durationHours: seaHours,
          speedKmh: SPEEDS.ship,
          label: 'Cargo Vessel',
          icon: '🚢',
        },
        {
          mode: 'road',
          coordinates: leg3Road.coordinates,
          from: { lat: dPort.lat, lng: dPort.lng, name: dPort.name },
          to: { lat: dLat, lng: dLng, name: 'Destination' },
          distanceKm: Math.round(leg3Road.distanceKm),
          durationHours: leg3Road.durationHours,
          speedKmh: SPEEDS.truck,
          label: 'Last-Mile Delivery',
          icon: '🚛',
        },
      ];

      const transitStops = [
        {
          name: oPort.name,
          coords: [oPort.lng, oPort.lat],
          type: 'seaport',
          waitHours: WAIT.seaportLoading,
          label: 'Port Customs & Container Loading',
          icon: '🏗️',
        },
        {
          name: dPort.name,
          coords: [dPort.lng, dPort.lat],
          type: 'seaport',
          waitHours: WAIT.seaportUnloading,
          label: 'Port Customs & Unloading',
          icon: '🏗️',
        },
      ];

      const totalHours =
        leg1Road.durationHours + WAIT.seaportLoading +
        seaHours + WAIT.seaportUnloading +
        leg3Road.durationHours;

      const plan = {
        mode: 'sea',
        segments,
        transitStops,
        hubs: { origin: oPort, destination: dPort },
        totalDistanceKm: Math.round(leg1Road.distanceKm + seaKm + leg3Road.distanceKm),
        totalDurationHours: totalHours,
        straightLineKm: Math.round(straightKm),
      };

      return res.json({ plan });
    }

  } catch (err) {
    console.error('[routing] Plan error:', err);
    res.status(500).json({ error: 'Routing plan failed: ' + err.message });
  }
});

module.exports = router;
