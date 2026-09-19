/**
 * hubLoader.js — Loads airports & seaports from local CSV files at startup
 * and exposes fast nearest-hub lookup via Haversine distance.
 *
 * Airports  : public/world-airports.csv  (OurAirports dataset)
 * Seaports  : public/UpdatedPub150.csv   (NGA World Port Index)
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// ─── Haversine Distance (km) ──────────────────────────────────────────────────
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

// ─── Data arrays (populated at module load) ───────────────────────────────────
let airports = [];   // { name, iata, icao, lat, lng, type, country }
let seaports = [];   // { name, lat, lng, country, harborSize }

function loadAirports() {
  const csvPath = path.join(__dirname, '../../public/world-airports.csv');
  if (!fs.existsSync(csvPath)) {
    console.warn('[hubLoader] world-airports.csv not found at', csvPath);
    return [];
  }

  const raw = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true, relax_quotes: true });

  return records
    .filter(r => {
      // Only include airports with scheduled service and major types
      const isLarge = r.type === 'large_airport' || r.type === 'medium_airport';
      const hasService = r.scheduled_service === '1' || r.scheduled_service === 'yes';
      const lat = parseFloat(r.latitude_deg);
      const lng = parseFloat(r.longitude_deg);
      return isLarge && hasService && !isNaN(lat) && !isNaN(lng);
    })
    .map(r => ({
      name: r.name,
      iata: r.iata_code || '',
      icao: r.icao_code || r.ident || '',
      lat: parseFloat(r.latitude_deg),
      lng: parseFloat(r.longitude_deg),
      type: r.type,
      country: r.country_name || r.iso_country || '',
      score: parseFloat(r.score) || 0,
    }));
}

function loadSeaports() {
  const csvPath = path.join(__dirname, '../../public/UpdatedPub150.csv');
  if (!fs.existsSync(csvPath)) {
    console.warn('[hubLoader] UpdatedPub150.csv not found at', csvPath);
    return [];
  }

  const raw = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true, relax_quotes: true });

  return records
    .filter(r => {
      const lat = parseFloat(r['Latitude']);
      const lng = parseFloat(r['Longitude']);
      // Only include medium/large ports with container or cargo capability
      const harborSize = (r['Harbor Size'] || '').toLowerCase();
      const isUsable = harborSize === 'large' || harborSize === 'medium';
      return isUsable && !isNaN(lat) && !isNaN(lng);
    })
    .map(r => ({
      name: r['Main Port Name'] || r['Alternate Port Name'] || 'Unknown Port',
      lat: parseFloat(r['Latitude']),
      lng: parseFloat(r['Longitude']),
      country: r['Country Code'] || '',
      harborSize: r['Harbor Size'] || 'Unknown',
      locode: r['UN/LOCODE'] || '',
      waterBody: r['World Water Body'] || '',
    }));
}

// ─── Module initialization ────────────────────────────────────────────────────
// Prefer the pre-built data file (server/data/hubs.json, see build-hubs.js):
// it is ~0.5 MB instead of ~19 MB of CSV, so the API function stays small and
// starts fast. The CSVs in public/ are the fallback for local development.
try {
  const prebuilt = require('../data/hubs.json');
  airports = prebuilt.airports || [];
  seaports = prebuilt.seaports || [];
  console.log(`✅ [hubLoader] Loaded ${airports.length} airports and ${seaports.length} seaports (pre-built)`);
} catch (e) {
  console.warn('[hubLoader] Pre-built hub data unavailable, parsing CSVs:', e.message);
  try {
    airports = loadAirports();
    console.log(`✅ [hubLoader] Loaded ${airports.length} airports`);
  } catch (err) {
    console.error('[hubLoader] Failed to load airports:', err.message);
  }
  try {
    seaports = loadSeaports();
    console.log(`✅ [hubLoader] Loaded ${seaports.length} seaports`);
  } catch (err) {
    console.error('[hubLoader] Failed to load seaports:', err.message);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Find the nearest airport to given coords.
 * @param {number} lat
 * @param {number} lng
 * @param {number} [limit=1] — how many results to return
 * @returns Array of { name, iata, lat, lng, distanceKm }
 */
function findNearestAirports(lat, lng, limit = 1) {
  if (airports.length === 0) return [];
  const scored = airports.map(a => ({
    ...a,
    distanceKm: haversineKm(lat, lng, a.lat, a.lng),
  }));
  scored.sort((a, b) => a.distanceKm - b.distanceKm);
  return scored.slice(0, limit);
}

/**
 * Find the nearest seaport to given coords.
 * @param {number} lat
 * @param {number} lng
 * @param {number} [limit=1]
 * @returns Array of { name, lat, lng, distanceKm }
 */
function findNearestSeaports(lat, lng, limit = 1) {
  if (seaports.length === 0) return [];
  const scored = seaports.map(p => ({
    ...p,
    distanceKm: haversineKm(lat, lng, p.lat, p.lng),
  }));
  scored.sort((a, b) => a.distanceKm - b.distanceKm);
  return scored.slice(0, limit);
}

/**
 * Generic hub finder used by the routing engine.
 * @param {number} lat
 * @param {number} lng
 * @param {'airport'|'seaport'} type
 * @returns {{ name, lat, lng, distanceKm } | null}
 */
const FALLBACK_AIRPORTS = [
  { name: "John F. Kennedy International Airport (JFK)", lat: 40.6413, lng: -73.7781, iata: "JFK" },
  { name: "Los Angeles International Airport (LAX)", lat: 33.9416, lng: -118.4085, iata: "LAX" },
  { name: "London Heathrow Airport (LHR)", lat: 51.4700, lng: -0.4543, iata: "LHR" },
  { name: "Paris Charles de Gaulle Airport (CDG)", lat: 49.0097, lng: 2.5500, iata: "CDG" },
  { name: "Frankfurt Airport (FRA)", lat: 50.0379, lng: 8.5622, iata: "FRA" },
  { name: "Dubai International Airport (DXB)", lat: 25.2532, lng: 55.3644, iata: "DXB" },
  { name: "Singapore Changi Airport (SIN)", lat: 1.3644, lng: 103.9915, iata: "SIN" },
  { name: "Tokyo Haneda Airport (HND)", lat: 35.5494, lng: 139.7798, iata: "HND" },
  { name: "Sydney Kingsford Smith Airport (SYD)", lat: -33.9461, lng: 151.1772, iata: "SYD" },
  { name: "Beijing Capital International Airport (PEK)", lat: 40.0799, lng: 116.5975, iata: "PEK" },
  { name: "O'Hare International Airport (ORD)", lat: 41.9742, lng: -87.9073, iata: "ORD" },
  { name: "Hartsfield-Jackson Atlanta International Airport (ATL)", lat: 33.6407, lng: -84.4277, iata: "ATL" },
  { name: "Dallas/Fort Worth International Airport (DFW)", lat: 32.8998, lng: -97.0372, iata: "DFW" },
  { name: "Denver International Airport (DEN)", lat: 39.8561, lng: -104.6737, iata: "DEN" },
  { name: "San Francisco International Airport (SFO)", lat: 37.6190, lng: -122.3790, iata: "SFO" },
  { name: "Toronto Pearson International Airport (YYZ)", lat: 43.6777, lng: -79.6248, iata: "YYZ" },
  { name: "São Paulo/Guarulhos International Airport (GRU)", lat: -23.4356, lng: -46.4731, iata: "GRU" },
  { name: "Johannesburg O.R. Tambo International Airport (JNB)", lat: -26.1367, lng: 28.2460, iata: "JNB" },
  { name: "Cairo International Airport (CAI)", lat: 30.1219, lng: 31.4056, iata: "CAI" },
  { name: "Incheon International Airport (ICN)", lat: 37.4602, lng: 126.4406, iata: "ICN" },
  { name: "Hong Kong International Airport (HKG)", lat: 22.3080, lng: 113.9145, iata: "HKG" },
  { name: "Mumbai Chhatrapati Shivaji Maharaj Airport (BOM)", lat: 19.0896, lng: 72.8656, iata: "BOM" },
  { name: "Istanbul Airport (IST)", lat: 41.2599, lng: 28.7278, iata: "IST" },
  { name: "Amsterdam Airport Schiphol (AMS)", lat: 52.3105, lng: 4.7683, iata: "AMS" },
  { name: "Madrid-Barajas Airport (MAD)", lat: 40.4839, lng: -3.5672, iata: "MAD" },
  { name: "Rome Fiumicino Airport (FCO)", lat: 41.8003, lng: 12.2389, iata: "FCO" },
  { name: "Munich Airport (MUC)", lat: 48.3538, lng: 11.7861, iata: "MUC" },
  { name: "Nairobi Jomo Kenyatta International Airport (NBO)", lat: -1.3192, lng: 36.9275, iata: "NBO" },
  { name: "Lagos Murtala Muhammed International Airport (LOS)", lat: 6.5774, lng: 3.3210, iata: "LOS" },
  { name: "Miami International Airport (MIA)", lat: 25.7959, lng: -80.2870, iata: "MIA" },
];

const FALLBACK_SEAPORTS = [
  { name: "Port of Shanghai", lat: 31.1433, lng: 121.8053 },
  { name: "Port of Singapore", lat: 1.2902, lng: 103.8519 },
  { name: "Port of Rotterdam", lat: 51.9489, lng: 4.1489 },
  { name: "Port of Los Angeles", lat: 33.7380, lng: -118.2618 },
  { name: "Port of New York & New Jersey", lat: 40.6722, lng: -74.0722 },
  { name: "Port of Tokyo", lat: 35.6179, lng: 139.7897 },
  { name: "Port of Busan", lat: 35.1017, lng: 129.0403 },
  { name: "Port of Jebel Ali (Dubai)", lat: 24.9857, lng: 55.0272 },
  { name: "Port of Antwerp", lat: 51.3414, lng: 4.3414 },
  { name: "Port of Hamburg", lat: 53.5350, lng: 9.9538 },
  { name: "Port of Mumbai", lat: 18.9483, lng: 72.8466 },
  { name: "Port of Sydney", lat: -33.8568, lng: 151.2464 },
  { name: "Port of Rio de Janeiro", lat: -22.9009, lng: -43.1905 },
  { name: "Port of Cape Town", lat: -33.9167, lng: 18.4339 },
  { name: "Port of Mombasa", lat: -4.0435, lng: 39.6635 },
];

function findNearestHub(lat, lng, type) {
  if (type === 'airport') {
    const results = findNearestAirports(lat, lng, 1);
    if (results.length > 0) return results[0];
    const scored = FALLBACK_AIRPORTS.map(a => ({
      ...a,
      distanceKm: haversineKm(lat, lng, a.lat, a.lng),
    }));
    scored.sort((a, b) => a.distanceKm - b.distanceKm);
    return scored[0];
  }
  if (type === 'seaport') {
    const results = findNearestSeaports(lat, lng, 1);
    if (results.length > 0) return results[0];
    const scored = FALLBACK_SEAPORTS.map(p => ({
      ...p,
      distanceKm: haversineKm(lat, lng, p.lat, p.lng),
    }));
    scored.sort((a, b) => a.distanceKm - b.distanceKm);
    return scored[0];
  }
  return null;
}

// ─── Cargo-hub selection (used by the multi-modal transport planner) ───────

/**
 * Best cargo airport for a location: among the large airports close to the
 * nearest one, pick the busiest (e.g. JFK rather than LaGuardia for New York).
 * Falls back to a nearby medium airport with scheduled service.
 */
function findCargoAirport(lat, lng) {
  const near = findNearestAirports(lat, lng, 60);
  const large = near.filter(a => a.type === 'large_airport');
  if (large.length > 0) {
    const reach = Math.max(large[0].distanceKm + 40, 60);
    const candidates = large.filter(a => a.distanceKm <= reach).sort((a, b) => b.score - a.score);
    if (candidates[0] && candidates[0].distanceKm <= 350) return candidates[0];
  }
  if (near[0] && near[0].distanceKm <= 150) return near[0];
  return large[0] || near[0] || findNearestHub(lat, lng, 'airport');
}

/** Busy large airports within `radiusKm` of a point (refuelling candidates). */
function findMajorAirportsNear(lat, lng, radiusKm = 2500, minScore = 50000) {
  return findNearestAirports(lat, lng, 300)
    .filter(a => a.type === 'large_airport' && a.iata && a.score >= minScore && a.distanceKm <= radiusKm);
}

const LANDLOCKED_WATER = /great lakes|caspian|lake /i;

/**
 * Best ocean container port for a location. Lake ports (Great Lakes, Caspian)
 * are skipped; a large port is preferred when it is not much further away.
 */
function findCargoSeaport(lat, lng) {
  const near = findNearestSeaports(lat, lng, 80).filter(p => !LANDLOCKED_WATER.test(p.waterBody || ''));
  if (near.length === 0) return findNearestHub(lat, lng, 'seaport');
  const large = near.filter(p => String(p.harborSize).toLowerCase() === 'large');
  if (large[0] && large[0].distanceKm <= near[0].distanceKm + 150) return large[0];
  return near[0];
}

/**
 * Expose full dataset counts (for health checks / admin API).
 */
function getStats() {
  return { airportCount: airports.length, seaportCount: seaports.length };
}

module.exports = {
  findNearestAirports,
  findNearestSeaports,
  findNearestHub,
  findCargoAirport,
  findCargoSeaport,
  findMajorAirportsNear,
  getStats,
};
