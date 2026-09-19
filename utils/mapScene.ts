/**
 * Shared 3D map scene for shipment maps (admin Live Map and the public
 * tracking page): Mapbox Standard styles, terrain, route layers per
 * transport mode, vehicle and hub markers.
 */
import mapboxgl from 'mapbox-gl';
import type { Plan, Timeline } from './shipmentTimeline';
import { splitRoute, unwrapLine } from './shipmentTimeline';

export const MODE_COLORS: Record<string, string> = { road: '#f59e0b', air: '#f472b6', sea: '#22d3ee' };
export const DONE_COLOR = '#64748b';
export const MODE_ICON: Record<string, string> = { road: '🚛', air: '✈️', sea: '🚢' };
export const EMPTY_FC = { type: 'FeatureCollection', features: [] } as any;

export type StyleKey = 'standard' | 'satellite' | 'dark';
export type LightPreset = 'dawn' | 'day' | 'dusk' | 'night';

// Mapbox Standard = 3D buildings and landmarks with dynamic lighting.
export const MAP_STYLES: Record<StyleKey, { label: string; url: string; standard: boolean }> = {
  standard: { label: '3D', url: 'mapbox://styles/mapbox/standard', standard: true },
  satellite: { label: 'Satellite', url: 'mapbox://styles/mapbox/standard-satellite', standard: true },
  dark: { label: 'Dark', url: 'mapbox://styles/mapbox/dark-v11', standard: false },
};

export const LIGHT_PRESETS: LightPreset[] = ['dawn', 'day', 'dusk', 'night'];
export const LIGHT_ICONS: Record<LightPreset, string> = { dawn: '🌅', day: '☀️', dusk: '🌇', night: '🌙' };

/** Light preset matching the viewer's local time of day. */
export function lightForNow(): LightPreset {
  const h = new Date().getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

export function basemapConfig(light: LightPreset) {
  return { lightPreset: light, showPointOfInterestLabels: false, showTransitLabels: false, show3dObjects: true };
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Terrain, atmosphere and the route layers — call after every style (re)load. */
export function installScene(m: mapboxgl.Map, style: { standard: boolean }) {
  try {
    if (!m.getSource('mapbox-dem')) {
      m.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
    }
    m.setTerrain({ source: 'mapbox-dem', exaggeration: 1.3 });
  } catch { /* terrain is optional */ }
  if (!style.standard) {
    try {
      m.setFog({ color: 'rgb(10,25,47)', 'high-color': 'rgb(20,40,80)', 'horizon-blend': 0.08, 'space-color': 'rgb(5,10,20)', 'star-intensity': 0.5 } as any);
    } catch { /* fog is optional */ }
  }
  // The "top" slot keeps routes above buildings and labels in Standard styles.
  const slot = style.standard ? { slot: 'top' } : {};
  if (!m.getSource('route-todo')) m.addSource('route-todo', { type: 'geojson', data: EMPTY_FC });
  if (!m.getSource('route-done')) m.addSource('route-done', { type: 'geojson', data: EMPTY_FC });
  const add = (layer: any) => { if (!m.getLayer(layer.id)) m.addLayer({ ...layer, ...slot }); };
  add({
    id: 'route-todo-glow', type: 'line', source: 'route-todo',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 10, 'line-opacity': 0.22, 'line-blur': 4, 'line-emissive-strength': 1 },
  });
  add({
    id: 'route-todo', type: 'line', source: 'route-todo',
    filter: ['!=', ['get', 'mode'], 'sea'],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 2.5, 10, 5], 'line-emissive-strength': 1 },
  });
  add({
    id: 'route-todo-sea', type: 'line', source: 'route-todo',
    filter: ['==', ['get', 'mode'], 'sea'],
    layout: { 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [2, 1.5], 'line-emissive-strength': 1 },
  });
  add({
    id: 'route-done', type: 'line', source: 'route-done',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': DONE_COLOR, 'line-width': 3, 'line-opacity': 0.9, 'line-emissive-strength': 1 },
  });
}

/** Push the travelled / remaining route into the scene's sources. */
export function updateRoute(m: mapboxgl.Map, plan: Plan, tl: Timeline, elapsedHours: number, started: boolean) {
  const { done, todo } = splitRoute(plan, tl, elapsedHours);
  const fc = (parts: typeof done, colored: boolean) => ({
    type: 'FeatureCollection',
    features: parts.filter((p) => p.coordinates.length > 1).map((p) => ({
      type: 'Feature',
      properties: { mode: p.mode, color: colored ? MODE_COLORS[p.mode] || '#3b82f6' : DONE_COLOR },
      geometry: { type: 'LineString', coordinates: p.coordinates },
    })),
  });
  (m.getSource('route-todo') as mapboxgl.GeoJSONSource | undefined)?.setData(fc(started ? todo : [...done, ...todo], true) as any);
  (m.getSource('route-done') as mapboxgl.GeoJSONSource | undefined)?.setData(fc(started ? done : [], false) as any);
}

export function clearRoute(m: mapboxgl.Map) {
  (m.getSource('route-todo') as mapboxgl.GeoJSONSource | undefined)?.setData(EMPTY_FC);
  (m.getSource('route-done') as mapboxgl.GeoJSONSource | undefined)?.setData(EMPTY_FC);
}

// Top-down vehicle silhouettes pointing north; the marker is rotated to the heading.
const VEHICLE_SVG: Record<string, string> = {
  air: '<path d="M12 1.8c.8 0 1.3.9 1.3 1.9V9l7.9 4.6v2l-7.9-2.5v5.3l2.4 1.8v1.5L12 20.8l-3.7.9v-1.5l2.4-1.8v-5.3l-7.9 2.5v-2L10.7 9V3.7c0-1 .5-1.9 1.3-1.9z"/>',
  sea: '<path d="M12 1.5c2.6 2.4 3.6 5.4 3.6 8.4v10.8c0 .9-.7 1.6-1.6 1.6h-4c-.9 0-1.6-.7-1.6-1.6V9.9c0-3 1-6 3.6-8.4z"/><rect x="9.6" y="10" width="4.8" height="2.2" rx=".3" fill="#0f172a" opacity=".55"/><rect x="9.6" y="13.2" width="4.8" height="2.2" rx=".3" fill="#0f172a" opacity=".55"/><rect x="9.6" y="16.4" width="4.8" height="2.2" rx=".3" fill="#0f172a" opacity=".55"/>',
  road: '<rect x="8.3" y="2" width="7.4" height="5.2" rx="1.6"/><rect x="7.6" y="8" width="8.8" height="14" rx="1"/><rect x="9.2" y="3" width="5.6" height="1.6" rx=".4" fill="#0f172a" opacity=".55"/>',
};

/** Vehicle marker markup. `badge` is plain text (escaped here). */
export function vehicleHtml(mode: string, paused: boolean, atStop: boolean, badge: string) {
  const color = paused ? '#f59e0b' : atStop ? '#38bdf8' : MODE_COLORS[mode] || '#3b82f6';
  const svg = VEHICLE_SVG[mode] || VEHICLE_SVG.road;
  const ring = paused || atStop
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;background:${color};opacity:.25;animation:ntlping 1.6s infinite"></div>`
    : '';
  const label = badge
    ? `<div style="position:absolute;left:42px;top:50%;transform:translateY(-50%);white-space:nowrap;background:rgba(15,23,42,.92);border:1px solid ${color}99;color:${color};font:600 10px Inter,sans-serif;padding:3px 8px;border-radius:6px;pointer-events:none">${escapeHtml(badge)}</div>`
    : '';
  return `<div style="position:relative;width:34px;height:34px">${ring}${label}
    <div style="position:relative;width:34px;height:34px;border-radius:50%;background:#0f172a;border:2px solid ${color};box-shadow:0 2px 10px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center">
      <svg class="ntl-vehicle-svg" viewBox="0 0 24 24" width="22" height="22" fill="${color}" style="transition:transform .6s linear">${svg}</svg>
    </div></div>`;
}

/**
 * Hub marker markup with an optional always-visible label. Origin and
 * destination labels sit above the dot and hub labels below, so they never
 * cover each other when an address is next to its airport or port.
 */
export function hubHtml(icon: string, title: string, color: string, label = '', labelPos: 'above' | 'below' = 'below') {
  const place = labelPos === 'above' ? 'bottom:24px' : 'top:24px';
  const tag = label
    ? `<div style="position:absolute;${place};left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(255,255,255,.95);color:#0f172a;font:600 10px Inter,sans-serif;padding:2px 6px;border-radius:5px;box-shadow:0 1px 4px rgba(0,0,0,.25);pointer-events:none">${escapeHtml(label)}</div>`
    : '';
  return `<div title="${escapeHtml(title)}" style="position:relative;width:22px;height:22px;border-radius:50%;background:#0f172a;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:default">${escapeHtml(icon)}${tag}</div>`;
}

/** Short label for a hub: IATA code or the first part of the name. */
export function shortHubLabel(name: string): string {
  const iata = name.match(/\(([A-Z]{3})\)\s*$/);
  if (iata) return iata[1];
  const short = name.split(',')[0].replace(/ International Airport| Airport/i, '').trim();
  return short.length > 24 ? `${short.slice(0, 23).trimEnd()}…` : short;
}

/**
 * Point the vehicle icon along its heading. The marker itself stays aligned
 * to the screen (so its label is always readable); only the icon turns,
 * compensating for the map's own rotation.
 */
export function setVehicleHeading(marker: mapboxgl.Marker, bearing: number, m: mapboxgl.Map) {
  const el = marker.getElement();
  el.dataset.heading = String(bearing);
  const svg = el.querySelector('.ntl-vehicle-svg') as SVGElement | null;
  if (svg) svg.style.transform = `rotate(${Math.round(bearing - m.getBearing())}deg)`;
}

/** Keep vehicle icons pointing the right way while the user rotates the map. */
export function trackMapRotation(m: mapboxgl.Map, getMarker: () => mapboxgl.Marker | null) {
  m.on('rotate', () => {
    const mk = getMarker();
    const heading = mk ? Number(mk.getElement().dataset.heading) : NaN;
    if (mk && !isNaN(heading)) setVehicleHeading(mk, heading, m);
  });
}

/**
 * Frame a route. Regional trips fit the whole route with a 3D tilt; trips
 * spanning continents centre the globe on the vehicle instead of shrinking
 * the planet to a dot.
 */
export function frameRoute(m: mapboxgl.Map, plan: Plan, focus: [number, number] | null, tilted = true, duration = 1800) {
  const bounds = new mapboxgl.LngLatBounds();
  let km = 0;
  plan.segments.forEach((seg) => {
    unwrapLine(seg.coordinates).forEach((c) => bounds.extend(c));
    km += Number(seg.distanceKm) || 0;
  });
  if (bounds.isEmpty()) return;
  const span = Math.max(bounds.getEast() - bounds.getWest(), (bounds.getNorth() - bounds.getSouth()) * 1.3);
  try {
    if (span > 100) {
      const c = bounds.getCenter();
      const center = focus || [c.lng, c.lat];
      m.flyTo({ center, zoom: span > 140 ? 1.9 : 2.4, pitch: tilted ? 15 : 0, bearing: 0, duration } as any);
      return;
    }
    const pitch = !tilted ? 0 : km > 3000 ? 30 : km > 800 ? 45 : 55;
    m.fitBounds(bounds, { padding: { top: 90, bottom: 70, left: 70, right: 70 }, maxZoom: 11, pitch, bearing: 0, duration } as any);
  } catch { /* invalid bounds */ }
}

export const MARKER_KEYFRAMES = '@keyframes ntlping{75%,100%{transform:scale(1.9);opacity:0}}';
