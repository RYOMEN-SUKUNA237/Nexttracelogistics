import React, { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { LocateFixed, Route as RouteIcon, Maximize2, Minimize2 } from 'lucide-react';
import { MAPBOX_TOKEN, initMapbox } from '../../utils/mapbox';
import { ShipmentLike, liveState, stateAt, Coord } from '../../utils/shipmentTimeline';
import {
  MODE_COLORS, DONE_COLOR, MAP_STYLES, LIGHT_PRESETS, LIGHT_ICONS, StyleKey, LightPreset,
  lightForNow, basemapConfig, installScene, updateRoute, clearRoute, vehicleHtml, hubHtml, shortHubLabel, MARKER_KEYFRAMES,
  setVehicleHeading, trackMapRotation, frameRoute,
} from '../../utils/mapScene';

interface Props {
  shipment: ShipmentLike & { tracking_id: string; is_paused?: boolean; pause_category?: string | null; pause_reason?: string | null };
  nowMs: number;
  height?: number;
}

/**
 * Customer-facing 3D shipment map: every leg in its transport colour,
 * labelled hubs and layovers, and the live vehicle (truck, plane or ship).
 */
const LiveShipmentMap: React.FC<Props> = ({ shipment, nowMs, height = 460 }) => {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const vehicleMarker = useRef<mapboxgl.Marker | null>(null);
  const vehicleKey = useRef('');
  const hubMarkers = useRef<mapboxgl.Marker[]>([]);
  const fitted = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [styleVersion, setStyleVersion] = useState(0);
  const [mapStyle, setMapStyle] = useState<StyleKey>('standard');
  const [light, setLight] = useState<LightPreset>(lightForNow);
  const [follow, setFollow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const styleRef = useRef(mapStyle);
  styleRef.current = mapStyle;
  const lightRef = useRef(light);
  lightRef.current = light;

  const live = useMemo(() => liveState(shipment, nowMs), [shipment, nowMs]);
  const plan = live?.plan || null;
  const started = !!shipment.departed_at && shipment.status !== 'pending';
  const finished = shipment.status === 'delivered' || shipment.status === 'returned';

  // Map (once)
  useEffect(() => {
    if (!container.current || map.current || !MAPBOX_TOKEN) return;
    initMapbox();
    const m = new mapboxgl.Map({
      container: container.current,
      style: MAP_STYLES.standard.url,
      config: { basemap: basemapConfig(lightRef.current) },
      center: [10, 25],
      zoom: 1.6,
      projection: 'globe' as any,
      antialias: true,
      cooperativeGestures: true,
    } as any);
    m.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    m.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    m.on('style.load', () => {
      installScene(m, MAP_STYLES[styleRef.current]);
      setStyleVersion((v) => v + 1);
      setReady(true);
    });
    m.on('dragstart', () => setFollow(false));
    trackMapRotation(m, () => vehicleMarker.current);
    map.current = m;
    const el = container.current;
    const obs = new ResizeObserver(() => { if (el.offsetWidth > 0) m.resize(); });
    obs.observe(el);
    return () => {
      obs.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  // Style and lighting
  const applied = useRef<StyleKey>('standard');
  useEffect(() => {
    const m = map.current;
    if (!m || applied.current === mapStyle) return;
    applied.current = mapStyle;
    const st = MAP_STYLES[mapStyle];
    setReady(false);
    m.setStyle(st.url, st.standard ? ({ config: { basemap: basemapConfig(lightRef.current) } } as any) : undefined);
  }, [mapStyle]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !MAP_STYLES[mapStyle].standard) return;
    try { (m as any).setConfigProperty('basemap', 'lightPreset', light); } catch { /* ignore */ }
  }, [light, ready, mapStyle]);

  // Hubs + first framing
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    hubMarkers.current.forEach((mk) => mk.remove());
    hubMarkers.current = [];
    if (!plan || !plan.segments.length) { clearRoute(m); return; }
    const add = (c: Coord, html: string) => {
      const el = document.createElement('div');
      el.innerHTML = html;
      hubMarkers.current.push(new mapboxgl.Marker({ element: el }).setLngLat(c).addTo(m));
    };
    add(plan.segments[0].from.coords, hubHtml('🟢', `Origin: ${shipment.origin || ''}`, '#10b981', 'Origin', 'above'));
    add(plan.segments[plan.segments.length - 1].to.coords, hubHtml('📍', `Destination: ${shipment.destination || ''}`, '#ef4444', 'Destination', 'above'));
    plan.stops.forEach((st) => {
      if (st.role === 'rest' || st.role === 'processing') return;
      add(st.coords, hubHtml(st.icon || '•', `${st.label} — ${st.name}`, st.role === 'transit' ? '#38bdf8' : '#a78bfa', shortHubLabel(st.name)));
    });
    if (fitted.current !== shipment.tracking_id) {
      fitted.current = shipment.tracking_id;
      fitWhole(false);
    }
  }, [plan, ready]);

  const fitWhole = (animate = true) => {
    const m = map.current;
    if (!m || !plan || !live) return;
    frameRoute(m, plan, finished ? null : live.state.position, true, animate ? 1500 : 1800);
  };

  // Route + vehicle every tick
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !live || !plan) return;
    updateRoute(m, plan, live.tl, live.elapsed, started);

    if (finished) {
      vehicleMarker.current?.remove();
      vehicleMarker.current = null;
      vehicleKey.current = '';
      return;
    }
    const v = stateAt(plan, live.tl, live.elapsed)!;
    const paused = !!shipment.is_paused;
    const atStop = v.kind === 'stop';
    const mode = v.kind === 'move' ? v.mode : v.stop?.type === 'seaport' ? 'sea' : v.stop?.type?.includes('airport') ? 'air' : 'road';
    let badge = '';
    if (!started) badge = 'Awaiting pickup';
    else if (paused) badge = shipment.pause_category === 'Transit Stop' ? `✈️ Held at ${v.name || 'airport'}` : '⏸ On hold';
    else if (atStop) badge = `${v.icon} ${v.label}`;
    else if (v.mode === 'air') badge = `✈️ In flight → ${shortHubLabel(v.segment?.to.name || '')}`;
    else if (v.mode === 'sea') badge = `🚢 At sea → ${shortHubLabel(v.segment?.to.name || '')}`;
    else badge = `🚛 On the road → ${shortHubLabel(v.segment?.to.name || '')}`;
    const key = `${mode}|${paused}|${atStop}|${badge}`;
    if (!vehicleMarker.current) {
      vehicleMarker.current = new mapboxgl.Marker({ element: document.createElement('div') })
        .setLngLat(v.position).addTo(m);
    }
    if (vehicleKey.current !== key) {
      vehicleMarker.current.getElement().innerHTML = vehicleHtml(mode, paused, atStop, badge);
      vehicleKey.current = key;
    }
    vehicleMarker.current.setLngLat(v.position);
    setVehicleHeading(vehicleMarker.current, v.bearing, m);

    if (follow) {
      const opts: any = { center: v.position, duration: 950, easing: (t: number) => t };
      if (v.kind === 'move' && !paused) opts.bearing = v.bearing;
      m.easeTo(opts);
    }
  }, [live?.elapsed, live?.tl, ready, styleVersion, shipment.is_paused, follow]);

  const startFollow = () => {
    const m = map.current;
    if (!m || !live) return;
    if (follow) { setFollow(false); return; }
    const v = live.state;
    m.easeTo({ center: v.position, zoom: v.mode === 'air' ? 5.5 : v.mode === 'sea' ? 6.5 : 13.5, pitch: 62, duration: 2000 });
    setFollow(true);
  };

  if (!MAPBOX_TOKEN) {
    return <div className="h-[380px] bg-gray-50 flex items-center justify-center text-sm text-gray-400">Map unavailable</div>;
  }

  const modes = plan ? Array.from(new Set(plan.segments.map((s) => s.mode))) : [];

  return (
    <div className="relative" style={{ height: expanded ? '78vh' : height }}>
      {/* Inline position: mapbox-gl.css sets .mapboxgl-map { position: relative }, which would override a class and collapse the map to 0px. */}
      <div ref={container} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 items-start">
        <div className="flex gap-1 bg-[#0f172a]/85 backdrop-blur p-1 rounded-lg shadow-lg">
          {(['standard', 'satellite'] as StyleKey[]).map((k) => (
            <button key={k} onClick={() => setMapStyle(k)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${mapStyle === k ? 'bg-white text-[#0a192f]' : 'text-gray-200 hover:bg-white/10'}`}>
              {MAP_STYLES[k].label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-[#0f172a]/85 backdrop-blur p-1 rounded-lg shadow-lg">
          {LIGHT_PRESETS.map((p) => (
            <button key={p} onClick={() => setLight(p)} title={p} aria-label={`${p} lighting`}
              className={`w-7 h-6 rounded-md text-xs ${light === p ? 'bg-white' : 'hover:bg-white/10'}`}>{LIGHT_ICONS[p]}</button>
          ))}
        </div>
        <div className="flex gap-1">
          {!finished && live && (
            <button onClick={startFollow}
              className={`h-8 px-2.5 rounded-lg shadow-lg flex items-center gap-1 text-[11px] font-semibold ${follow ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>
              <LocateFixed size={13} /> {follow ? 'Following' : 'Follow'}
            </button>
          )}
          <button onClick={() => { setFollow(false); fitWhole(); }} className="h-8 px-2.5 rounded-lg shadow-lg flex items-center gap-1 text-[11px] font-semibold bg-white text-gray-700">
            <RouteIcon size={13} /> Route
          </button>
          <button onClick={() => setExpanded((e) => !e)} aria-label={expanded ? 'Shrink map' : 'Expand map'} className="h-8 w-8 rounded-lg shadow-lg flex items-center justify-center bg-white text-gray-700">
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>
      <div className="absolute bottom-9 left-3 z-10 bg-[#0f172a]/90 backdrop-blur px-3 py-1.5 rounded-lg shadow text-[10px] text-gray-200 flex gap-3 flex-wrap">
        {modes.includes('road') && <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded" style={{ background: MODE_COLORS.road }} />Truck</span>}
        {modes.includes('air') && <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded" style={{ background: MODE_COLORS.air }} />Flight</span>}
        {modes.includes('sea') && <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded border-t border-dashed" style={{ borderColor: MODE_COLORS.sea }} />Vessel</span>}
        {started && <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded" style={{ background: DONE_COLOR }} />Completed</span>}
      </div>
      <style>{MARKER_KEYFRAMES}</style>
    </div>
  );
};

export default LiveShipmentMap;
