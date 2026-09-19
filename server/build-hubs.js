/**
 * Builds server/data/hubs.json from the CSV datasets in public/.
 *
 *   node build-hubs.js
 *
 * The generated file is committed and loaded by utils/hubLoader.js. It keeps
 * only the fields the planner needs, so the API function stays small and
 * starts fast (the CSVs are ~19 MB and are not bundled into the function).
 * Re-run this after updating the CSVs.
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const AIRPORTS_CSV = path.join(__dirname, '../public/world-airports.csv');
const SEAPORTS_CSV = path.join(__dirname, '../public/UpdatedPub150.csv');
const OUT = path.join(__dirname, 'data', 'hubs.json');

function buildAirports() {
  const records = parse(fs.readFileSync(AIRPORTS_CSV, 'utf-8'), { columns: true, skip_empty_lines: true, trim: true, relax_quotes: true });
  return records
    .filter((r) => {
      const isLarge = r.type === 'large_airport' || r.type === 'medium_airport';
      const hasService = r.scheduled_service === '1' || r.scheduled_service === 'yes';
      return isLarge && hasService && !isNaN(parseFloat(r.latitude_deg)) && !isNaN(parseFloat(r.longitude_deg));
    })
    .map((r) => ({
      name: r.name,
      iata: r.iata_code || '',
      icao: r.icao_code || r.ident || '',
      lat: Math.round(parseFloat(r.latitude_deg) * 1e5) / 1e5,
      lng: Math.round(parseFloat(r.longitude_deg) * 1e5) / 1e5,
      type: r.type,
      country: r.country_name || r.iso_country || '',
      score: parseFloat(r.score) || 0,
    }));
}

function buildSeaports() {
  const records = parse(fs.readFileSync(SEAPORTS_CSV, 'utf-8'), { columns: true, skip_empty_lines: true, trim: true, relax_quotes: true });
  return records
    .filter((r) => {
      const size = (r['Harbor Size'] || '').toLowerCase();
      return (size === 'large' || size === 'medium') && !isNaN(parseFloat(r['Latitude'])) && !isNaN(parseFloat(r['Longitude']));
    })
    .map((r) => ({
      name: r['Main Port Name'] || r['Alternate Port Name'] || 'Unknown Port',
      lat: Math.round(parseFloat(r['Latitude']) * 1e5) / 1e5,
      lng: Math.round(parseFloat(r['Longitude']) * 1e5) / 1e5,
      country: r['Country Code'] || '',
      harborSize: r['Harbor Size'] || 'Unknown',
      locode: r['UN/LOCODE'] || '',
      waterBody: r['World Water Body'] || '',
    }));
}

const airports = buildAirports();
const seaports = buildSeaports();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ airports, seaports }));
console.log(`✅ ${OUT}: ${airports.length} airports, ${seaports.length} seaports, ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB`);
