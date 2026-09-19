import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { MAPBOX_TOKEN, initMapbox } from '../../../utils/mapbox';
import { Coord, PlanSegment, PlanStop, unwrapLine } from '../../../utils/shipmentTimeline';

export const PREVIEW_COLORS: Record<string, string> = { road: '#f59e0b', air: '#f472b6', sea: '#22d3ee' };

interface Props {
  segments: PlanSegment[];
  stops: PlanStop[];
  vehicle?: { position: Coord; mode: string } | null;
  height?: number;
}

const EMPTY = { type: 'FeatureCollection', features: [] } as any;

/** Small map showing a planned multi-modal route (colour per transport mode). */
const RoutePreviewMap: React.FC<Props> = ({ segments, stops, vehicle, height = 220 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const vehicleMarker = useRef<mapboxgl.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const fittedKey = useRef('');

  useEffect(() => {
    if (!ref.current || !MAPBOX_TOKEN) return;
    initMapbox();
    const m = new mapboxgl.Map({
      container: ref.current,
      style: 'mapbox://styles/mapbox/standard',
      config: { basemap: { lightPreset: 'dusk', showPointOfInterestLabels: false, showTransitLabels: false } },
      center: [0, 20],
      zoom: 1,
      attributionControl: false,
      projection: 'mercator' as any,
    } as any);
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('style.load', () => {
      m.addSource('plan', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'plan-solid', type: 'line', slot: 'top', source: 'plan', filter: ['!=', ['get', 'mode'], 'sea'], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-emissive-strength': 1 } } as any);
      m.addLayer({ id: 'plan-sea', type: 'line', slot: 'top', source: 'plan', filter: ['==', ['get', 'mode'], 'sea'], layout: { 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [2, 1.5], 'line-emissive-strength': 1 } } as any);
      setReady(true);
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const lines = segments.map((s) => ({ mode: s.mode, coords: unwrapLine(s.coordinates) }));
    (m.getSource('plan') as mapboxgl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: lines.filter((l) => l.coords.length > 1).map((l) => ({
        type: 'Feature',
        properties: { mode: l.mode, color: PREVIEW_COLORS[l.mode] || '#3b82f6' },
        geometry: { type: 'LineString', coordinates: l.coords },
      })),
    } as any);

    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    const dot = (c: Coord, color: string, title: string, emoji = '') => {
      const el = document.createElement('div');
      el.title = title;
      el.style.cssText = `width:${emoji ? 20 : 12}px;height:${emoji ? 20 : 12}px;border-radius:50%;background:#0f172a;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:10px`;
      el.textContent = emoji;
      markers.current.push(new mapboxgl.Marker({ element: el }).setLngLat(c).addTo(m));
    };
    if (segments.length) {
      dot(segments[0].from.coords, '#10b981', `Origin: ${segments[0].from.name}`);
      dot(segments[segments.length - 1].to.coords, '#ef4444', `Destination: ${segments[segments.length - 1].to.name}`);
    }
    stops.filter((s) => s.role !== 'rest' && s.role !== 'processing').forEach((s) => dot(s.coords, s.role === 'transit' ? '#38bdf8' : '#a78bfa', `${s.label} — ${s.name}`, s.icon));

    const bounds = new mapboxgl.LngLatBounds();
    lines.forEach((l) => l.coords.forEach((c) => bounds.extend(c)));
    if (bounds.isEmpty()) return;
    // Only re-frame when the route itself changed (not on every live refresh).
    const key = `${segments.length}|${bounds.toArray().flat().map((v) => v.toFixed(3)).join(',')}`;
    if (fittedKey.current === key) return;
    fittedKey.current = key;
    // The map may sit in a modal that is still animating open: size first, then frame.
    const fit = () => {
      m.resize();
      try { m.fitBounds(bounds, { padding: 30, duration: 0, maxZoom: 9 }); } catch { /* ignore */ }
    };
    fit();
    const t = setTimeout(fit, 350);
    return () => clearTimeout(t);
  }, [segments, stops, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (!vehicle) {
      vehicleMarker.current?.remove();
      vehicleMarker.current = null;
      return;
    }
    if (!vehicleMarker.current) {
      const el = document.createElement('div');
      el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,.35)';
      vehicleMarker.current = new mapboxgl.Marker({ element: el }).setLngLat(vehicle.position).addTo(m);
    }
    vehicleMarker.current.setLngLat(vehicle.position);
  }, [vehicle?.position[0], vehicle?.position[1], ready]);

  if (!MAPBOX_TOKEN) return null;
  return <div ref={ref} className="w-full rounded-lg overflow-hidden border border-gray-200" style={{ height }} />;
};

export default RoutePreviewMap;
