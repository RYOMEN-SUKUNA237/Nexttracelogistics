import mapboxgl from 'mapbox-gl';
import along from '@turf/along';
import length from '@turf/length';
import { lineString } from '@turf/helpers';

declare const __MAPBOX_TOKEN__: string;
export const MAPBOX_TOKEN =
  (typeof __MAPBOX_TOKEN__ !== 'undefined' && __MAPBOX_TOKEN__)
    ? __MAPBOX_TOKEN__
    : ((import.meta as any).env?.VITE_MAPBOX_TOKEN ?? '');

export function initMapbox() {
  if (MAPBOX_TOKEN) {
    (mapboxgl as any).accessToken = MAPBOX_TOKEN;
  }
}

export async function geocodeAddress(query: string): Promise<{ lng: number; lat: number; place_name: string } | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
    );
    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lng, lat, place_name: data.features[0].place_name };
    }
  } catch (e) {
    console.error('Geocode error:', e);
  }
  return null;
}

export async function geocodeSearch(query: string): Promise<Array<{ lng: number; lat: number; place_name: string }>> {
  if (!MAPBOX_TOKEN) return [];
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5`
    );
    const data = await res.json();
    return (data.features || []).map((f: any) => ({
      lng: f.center[0],
      lat: f.center[1],
      place_name: f.place_name,
    }));
  } catch (e) {
    console.error('Geocode search error:', e);
    return [];
  }
}

// ─── ROUTE STYLE CONSTANTS (Aura Track Theme) ──────────────────────
export const ROUTE_STYLE = {
  color: '#0a192f',          // Navy blue
  width: 5,
  glowColor: '#0a192f',
  glowWidth: 14,
  glowOpacity: 0.08,
  opacity: 0.85,
  lineJoin: 'round' as const,
  lineCap: 'round' as const,
  pausedDash: [2, 2] as number[],
  activeDash: [1] as number[],
};

// ─── TRUE ROUTE (Mapbox Directions API) ─────────────────────────────
export interface TrueRouteResult {
  geometry: { type: string; coordinates: [number, number][] };
  distance: number;   // meters
  duration: number;   // seconds
  legs: any[];
  steps: any[];
  summary: string;
}

export async function getTrueRoute(
  startCoords: [number, number],
  endCoords: [number, number],
  profile: 'driving' | 'driving-traffic' | 'walking' | 'cycling' = 'driving'
): Promise<TrueRouteResult | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/` +
      `${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}` +
      `?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      // Keep up to 1000 points for accurate road rendering
      const coords: [number, number][] = route.geometry?.coordinates || [];
      if (coords.length > 1000) {
        const step = Math.ceil(coords.length / 1000);
        route.geometry.coordinates = coords.filter((_: any, i: number) => i % step === 0 || i === coords.length - 1);
      }

      // Collect all steps from all legs
      const allSteps: any[] = [];
      for (const leg of (route.legs || [])) {
        allSteps.push(...(leg.steps || []));
      }

      return {
        geometry: route.geometry,
        distance: route.distance,
        duration: route.duration,
        legs: route.legs || [],
        steps: allSteps,
        summary: route.legs?.[0]?.summary || '',
      };
    }
  } catch (e) {
    console.error('getTrueRoute error:', e);
  }
  return null;
}

// Legacy alias — keep backward compat for any older callers
export const getRoute = getTrueRoute;

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function determineTransportModes(distance: number, cargoType: string): string[] {
  const modes: string[] = [];
  const distKm = distance / 1000;

  if (distKm > 5000) {
    modes.push('Air Freight', 'Ground Transport');
  } else if (distKm > 1000) {
    modes.push('Long-Haul Trucking', 'Regional Distribution');
  } else if (distKm > 200) {
    modes.push('Interstate Trucking');
  } else if (distKm > 50) {
    modes.push('Regional Delivery Van');
  } else {
    modes.push('Local Courier');
  }

  if (cargoType === 'Fragile') modes.push('Climate-Controlled');
  if (cargoType === 'Hazardous') modes.push('HazMat Certified');
  if (cargoType === 'Perishable') modes.push('Refrigerated');
  if (cargoType === 'Express') modes.push('Priority Express');

  modes.push('Last-Mile Delivery');
  return modes;
}

// ─── GREAT CIRCLE ARC ────────────────────────────────────────────────
// For air/sea routes where road directions aren't available
export function generateGreatCircleArc(
  origin: [number, number],
  destination: [number, number],
  numPoints: number = 100
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const lat1 = toRad(origin[1]);
  const lon1 = toRad(origin[0]);
  const lat2 = toRad(destination[1]);
  const lon2 = toRad(destination[0]);

  const d = 2 * Math.asin(
    Math.sqrt(
      Math.pow(Math.sin((lat2 - lat1) / 2), 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lon2 - lon1) / 2), 2)
    )
  );

  if (d < 1e-10) return [origin, destination];

  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);
    points.push([toDeg(lon), toDeg(lat)]);
  }
  return points;
}

// Try road route first, fall back to great circle arc for air/sea
export async function getRouteWithFallback(
  origin: [number, number],
  destination: [number, number],
  profile: 'driving' | 'driving-traffic' | 'walking' | 'cycling' = 'driving'
): Promise<{
  geometry: { type: string; coordinates: [number, number][] };
  distance: number;
  duration: number;
  steps: any[];
  isArc: boolean;
}> {
  // Try true road route
  const route = await getTrueRoute(origin, destination, profile);
  if (route?.geometry?.coordinates?.length > 2) {
    return {
      geometry: route.geometry,
      distance: route.distance,
      duration: route.duration,
      steps: route.steps,
      isArc: false,
    };
  }

  // Fallback: great circle arc (air/sea route)
  const coords = generateGreatCircleArc(origin, destination);
  // Approximate distance using Haversine
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(destination[1] - origin[1]);
  const dLon = toRad(destination[0] - origin[0]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(origin[1])) * Math.cos(toRad(destination[1])) * Math.sin(dLon / 2) ** 2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  // Rough estimate: 800 km/h for air, ~30 km/h for sea
  const speedMs = dist > 2000000 ? 222 : 8.3; // m/s
  const dur = dist / speedMs;

  return {
    geometry: { type: 'LineString', coordinates: coords },
    distance: dist,
    duration: dur,
    steps: [],
    isArc: true,
  };
}

// ─── TURF.JS POSITION CALCULATION ───────────────────────────────────
// Uses @turf/along for geodesic-accurate position along real road geometry

export function interpolateAlongRoute(
  coordinates: [number, number][],
  progress: number
): [number, number] {
  if (!coordinates || coordinates.length < 2) return coordinates?.[0] || [0, 0];
  if (progress <= 0) return coordinates[0];
  if (progress >= 100) return coordinates[coordinates.length - 1];

  try {
    const line = lineString(coordinates);
    const totalKm = length(line, { units: 'kilometers' });
    const targetKm = (progress / 100) * totalKm;
    const point = along(line, targetKm, { units: 'kilometers' });
    return point.geometry.coordinates as [number, number];
  } catch {
    // Fallback to simple linear interpolation if Turf fails
    const idx = Math.floor((progress / 100) * (coordinates.length - 1));
    return coordinates[Math.min(idx, coordinates.length - 1)];
  }
}

/**
 * Calculate position at a given time along a route.
 * Uses Turf.js turf.along for geodesic-accurate snapping to real road geometry.
 *
 * @param startTime  - ISO string or Date when transit began
 * @param duration   - total expected travel duration in seconds
 * @param routeCoordinates - GeoJSON coordinates array from the route geometry
 * @returns { position, progress } — [lng, lat] and 0-100 progress
 */
export function calculatePositionAtTime(
  startTime: string | Date,
  duration: number,
  routeCoordinates: [number, number][]
): { position: [number, number]; progress: number } {
  if (!routeCoordinates || routeCoordinates.length < 2 || duration <= 0) {
    return { position: routeCoordinates?.[0] || [0, 0], progress: 0 };
  }

  const startMs = new Date(startTime).getTime();
  const elapsedMs = Date.now() - startMs;
  const elapsedSec = elapsedMs / 1000;
  const progress = Math.max(0, Math.min(100, (elapsedSec / duration) * 100));

  const position = interpolateAlongRoute(routeCoordinates, progress);
  return { position, progress };
}

// ─── TIME-BASED PROGRESS ────────────────────────────────────────────
export interface ShipmentTimeData {
  status: string;
  departed_at?: string | null;
  estimated_delivery?: string | null;
  is_paused?: number | boolean;
  paused_at?: string | null;
  total_paused_ms?: number;
  progress?: number;
  computed_progress?: number;
}

export function computeTimeBasedProgress(s: ShipmentTimeData): number {
  // Use server-computed progress if available
  if (s.computed_progress != null) {
    // Re-compute client-side for real-time smoothness
  }
  if (s.status === 'delivered' || s.status === 'returned') return 100;
  if (s.status === 'pending') return 0;
  if (!s.departed_at || !s.estimated_delivery) return s.computed_progress ?? s.progress ?? 0;

  const departedMs = new Date(s.departed_at).getTime();
  // Estimated delivery is a date string (YYYY-MM-DD), treat as end of day UTC
  const estStr = s.estimated_delivery.includes('T') ? s.estimated_delivery : s.estimated_delivery + 'T23:59:59Z';
  const estimatedMs = new Date(estStr).getTime();
  const totalDuration = estimatedMs - departedMs;
  if (totalDuration <= 0) return s.computed_progress ?? s.progress ?? 0;

  const nowMs = Date.now();
  const pausedMs = s.total_paused_ms || 0;

  let currentPauseMs = 0;
  if (s.is_paused && s.paused_at) {
    currentPauseMs = nowMs - new Date(s.paused_at).getTime();
  }

  const elapsedActive = (nowMs - departedMs) - pausedMs - currentPauseMs;
  const progress = Math.max(0, Math.min(100, (elapsedActive / totalDuration) * 100));
  return Math.round(progress * 100) / 100;
}

export function computeTimeRemaining(s: ShipmentTimeData): string {
  if (s.status === 'delivered' || s.status === 'returned') return 'Delivered';
  if (s.status === 'pending') return 'Awaiting pickup';
  if (!s.departed_at || !s.estimated_delivery) return 'Calculating...';

  const estStr = s.estimated_delivery.includes('T') ? s.estimated_delivery : s.estimated_delivery + 'T23:59:59Z';
  const estimatedMs = new Date(estStr).getTime();
  const nowMs = Date.now();
  const pausedMs = s.total_paused_ms || 0;

  let currentPauseMs = 0;
  if (s.is_paused && s.paused_at) {
    currentPauseMs = nowMs - new Date(s.paused_at).getTime();
  }

  // Remaining = total - elapsed_active
  const departedMs = new Date(s.departed_at).getTime();
  const totalDuration = estimatedMs - departedMs;
  const elapsedActive = (nowMs - departedMs) - pausedMs - currentPauseMs;
  const remainingMs = Math.max(0, totalDuration - elapsedActive);

  if (remainingMs <= 0) return 'Arriving now';

  const totalMins = Math.floor(remainingMs / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}
