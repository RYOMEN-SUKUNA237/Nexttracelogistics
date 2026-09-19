import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, RefreshCw, Maximize2, Minimize2, Map as MapIcon, List, Loader2, Edit, Search, LocateFixed } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import { Shipment, STATUS_LABELS, formatDateTime } from './types';
import { MAPBOX_TOKEN, initMapbox } from '../../utils/mapbox';
import {
  Coord, planFromShipment, buildTimeline, shipmentClock, stateAt, progressFromPoint,
  unwrapLine, formatHours, wrapLng,
} from '../../utils/shipmentTimeline';
import PauseModal from './components/PauseModal';
import PositionEditor from './components/PositionEditor';
import StopControls from './components/StopControls';
import JourneyTimeline from '../../components/shipment/JourneyTimeline';
import {
  MODE_COLORS, DONE_COLOR, MODE_ICON, EMPTY_FC, MAP_STYLES, LIGHT_PRESETS, LIGHT_ICONS,
  StyleKey, LightPreset, lightForNow, basemapConfig, installScene, updateRoute, clearRoute,
  vehicleHtml, hubHtml, shortHubLabel, MARKER_KEYFRAMES, setVehicleHeading, trackMapRotation, frameRoute,
} from '../../utils/mapScene';

interface TrackMapProps {
  shipments: Shipment[];
  onRefresh: () => void;
}

const ACTIVE = ['pending', 'picked-up', 'in-transit', 'out-for-delivery', 'paused'];

/**
 * The map lists every shipment, finished ones included, so a delivery can be
 * reviewed or re-opened from here. Moving shipments sort first, then those
 * waiting to leave, then the ones that are done.
 */
const ORDER: Record<string, number> = {
  'in-transit': 0, 'out-for-delivery': 0, paused: 1, 'picked-up': 2, pending: 3, delivered: 4, returned: 4,
};
const rank = (s: Shipment) => (s.isPaused ? 1 : ORDER[s.status] ?? 5);

/**
 * One row of the shipment list. Defined outside TrackMap (and memoised) so the
 * one-second position tick re-renders the map, not the whole list: a component
 * declared inside the parent would be a new type on every render, which
 * unmounts and rebuilds every row and can swallow clicks.
 */
const ShipmentCard = React.memo<{ s: Shipment; selected: boolean; onSelect: (s: Shipment) => void }>(({ s, selected, onSelect }) => {
  const segs = s.raw.multi_modal_segments;
  const modes: string[] = Array.isArray(segs) ? Array.from(new Set(segs.map((x: any) => x?.mode).filter(Boolean))) : ['road'];
  const color = s.isPaused ? 'bg-amber-100 text-amber-700' : s.status === 'pending' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700';
  return (
    <button type="button" onClick={() => onSelect(s)}
      className={`w-full text-left p-3.5 border-b border-gray-100 transition-colors ${selected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-mono font-bold text-[#0a192f] truncate">{s.trackingId}</p>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${color}`}>{STATUS_LABELS[s.status]}</span>
      </div>
      <p className="text-[11px] text-gray-500 truncate">{s.origin} → {s.destination}</p>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[11px]">{modes.map((m) => MODE_ICON[m] || '').join(' ')}</span>
        <div className="flex-1 bg-gray-200 rounded-full h-1">
          <div className={`h-1 rounded-full ${s.isPaused ? 'bg-amber-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, s.progress)}%` }} />
        </div>
        <span className="text-[10px] text-gray-400 w-9 text-right">{Math.round(s.progress)}%</span>
      </div>
    </button>
  );
});
ShipmentCard.displayName = 'ShipmentCard';

const TrackMap: React.FC<TrackMapProps> = ({ shipments, onRefresh }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const vehicleMarker = useRef<mapboxgl.Marker | null>(null);
  const vehicleKey = useRef('');
  const hubMarkers = useRef<mapboxgl.Marker[]>([]);
  const fittedFor = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const [mobileTab, setMobileTab] = useState<'list' | 'map'>('list');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [pauseTarget, setPauseTarget] = useState<Shipment | null>(null);
  const [panel, setPanel] = useState<null | 'position' | 'transit' | 'journey'>('journey');
  const [previewProgress, setPreviewProgress] = useState<number | null>(null);
  const [clickSnap, setClickSnap] = useState<{ progress: number; label: string; key: number } | null>(null);
  const [mapPickActive, setMapPickActive] = useState(false);
  const [mapPickPoint, setMapPickPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [mapStyle, setMapStyle] = useState<StyleKey>(() => {
    try {
      const saved = localStorage.getItem('ntl_map_style') as StyleKey | null;
      return saved && MAP_STYLES[saved] ? saved : 'standard';
    } catch { return 'standard'; }
  });
  const [light, setLight] = useState<LightPreset>(lightForNow);
  const [follow, setFollow] = useState(false);
  const [tilted, setTilted] = useState(true);
  const [styleVersion, setStyleVersion] = useState(0);
  const mapStyleRef = useRef(mapStyle);
  mapStyleRef.current = mapStyle;
  const lightRef = useRef(light);
  lightRef.current = light;

  const active = useMemo(() => [...shipments].sort((a, b) => rank(a) - rank(b)), [shipments]);
  const moving = useMemo(() => shipments.filter((s) => ACTIVE.includes(s.status)).length, [shipments]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return active;
    return active.filter((s) => [s.trackingId, s.origin, s.destination, s.sender, s.receiver].some((v) => (v || '').toLowerCase().includes(q)));
  }, [active, search]);
  const selected = active.find((s) => s.trackingId === selectedId) || null;

  // Clock: drives the live position.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selectedId && active.length > 0) setSelectedId(active[0].trackingId);
    if (selectedId && active.length > 0 && !active.some((s) => s.trackingId === selectedId)) setSelectedId(active[0].trackingId);
  }, [active, selectedId]);

  // Reset per-shipment tools when the selection changes.
  useEffect(() => {
    setPanel('journey');
    setPreviewProgress(null);
    setClickSnap(null);
    setMapPickActive(false);
    setMapPickPoint(null);
  }, [selectedId]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  }, []);

  const afterAction = useCallback((msg: string) => {
    showToast(msg);
    setPanel('journey');
    setMapPickActive(false);
    setMapPickPoint(null);
    onRefresh();
  }, [onRefresh, showToast]);

  // ── Timeline for the selected shipment ──
  const raw = selected?.raw;
  const plan = useMemo(() => (raw ? planFromShipment(raw) : null), [raw]);
  const clock = raw ? shipmentClock(raw, now) : null;
  const windowHours = clock ? Math.round(clock.windowHours * 1e6) / 1e6 : null;
  const tl = useMemo(() => (plan ? buildTimeline(plan, windowHours) : null), [plan, windowHours]);
  const started = !!raw?.departed_at && selected?.status !== 'pending';
  const finished = !!selected && ['delivered', 'returned'].includes(selected.status);
  const elapsed = !tl ? 0 : started && clock ? clock.elapsedHours : 0;
  const shownElapsed = tl && previewProgress != null ? (previewProgress / 100) * tl.totalHours : elapsed;
  const vehicle = plan && tl && tl.phases.length ? stateAt(plan, tl, shownElapsed) : null;
  const live = plan && tl && tl.phases.length && vehicle
    ? { plan, tl, clock, elapsed, state: stateAt(plan, tl, elapsed)!, progress: tl.totalHours ? (elapsed / tl.totalHours) * 100 : 0 }
    : null;
  const progressPct = live ? live.progress : selected?.progress || 0;

  // Refs for map event handlers.
  const liveRef = useRef(live);
  liveRef.current = live;
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const mapPickRef = useRef(mapPickActive);
  mapPickRef.current = mapPickActive;

  // ── Map setup (once) ──
  useEffect(() => {
    if (!mapContainer.current || map.current || !MAPBOX_TOKEN) return;
    initMapbox();
    const initial = MAP_STYLES[mapStyleRef.current];
    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: initial.url,
      config: initial.standard ? { basemap: basemapConfig(lightRef.current) } : undefined,
      center: [10, 25],
      zoom: 1.7,
      pitch: 0,
      projection: 'globe' as any,
      antialias: true,
      failIfMajorPerformanceCaveat: false,
    } as any);
    m.addControl(new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
    m.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    m.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    // Every style (re)load: terrain, atmosphere and our route layers.
    m.on('style.load', () => {
      installScene(m, MAP_STYLES[mapStyleRef.current]);
      setStyleVersion((v) => v + 1);
      setMapReady(true);
    });
    // The user dragging the map ends "follow" mode.
    m.on('dragstart', () => setFollow(false));
    trackMapRotation(m, () => vehicleMarker.current);
    m.on('click', (e) => {
      const click: Coord = [e.lngLat.lng, e.lngLat.lat];
      if (mapPickRef.current) {
        setMapPickPoint({ lng: wrapLng(click[0]), lat: click[1] });
        setMapPickActive(false);
        return;
      }
      const lv = liveRef.current;
      if (panelRef.current === 'position' && lv) {
        const hit = progressFromPoint(lv.plan, lv.tl, click);
        if (hit && hit.distanceKm < 250) {
          setClickSnap({ progress: hit.progress, label: `Map point (${hit.position[1].toFixed(2)}, ${hit.position[0].toFixed(2)})`, key: Date.now() });
        }
      }
    });
    map.current = m;
    const container = mapContainer.current;
    const obs = new ResizeObserver(() => { if (container.offsetWidth > 0) m.resize(); });
    obs.observe(container);
    return () => {
      obs.disconnect();
      m.remove();
      map.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const canvas = map.current?.getCanvas();
    if (canvas) canvas.style.cursor = mapPickActive || panel === 'position' ? 'crosshair' : '';
  }, [mapPickActive, panel, mapReady]);

  // ── Map look: base style and lighting ──
  const appliedStyle = useRef(mapStyle);
  useEffect(() => {
    try { localStorage.setItem('ntl_map_style', mapStyle); } catch { /* per-viewer convenience only */ }
    const m = map.current;
    if (!m || appliedStyle.current === mapStyle) return;
    appliedStyle.current = mapStyle;
    const style = MAP_STYLES[mapStyle];
    setMapReady(false);
    m.setStyle(style.url, style.standard ? { config: { basemap: basemapConfig(lightRef.current) } } as any : undefined);
  }, [mapStyle]);

  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady || !MAP_STYLES[mapStyle].standard) return;
    try { (m as any).setConfigProperty('basemap', 'lightPreset', light); } catch { /* older style */ }
  }, [light, mapReady, mapStyle]);

  const toggleTilt = () => {
    const m = map.current;
    if (!m) return;
    const next = !tilted;
    setTilted(next);
    m.easeTo({ pitch: next ? 60 : 0, bearing: next ? m.getBearing() : 0, duration: 900 });
  };

  // ── Hub markers + camera: only when the selected shipment or its route changes ──
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;
    hubMarkers.current.forEach((mk) => mk.remove());
    hubMarkers.current = [];
    if (!plan || !plan.segments.length || !selected) {
      clearRoute(m);
      return;
    }
    const add = (c: Coord, html: string) => {
      const el = document.createElement('div');
      el.innerHTML = html;
      hubMarkers.current.push(new mapboxgl.Marker({ element: el }).setLngLat(c).addTo(m));
    };
    const first = plan.segments[0].from.coords;
    const last = plan.segments[plan.segments.length - 1].to.coords;
    add(first, hubHtml('🟢', `Origin: ${selected.origin}`, '#10b981', 'Origin', 'above'));
    add(last, hubHtml('📍', `Destination: ${selected.destination}`, '#ef4444', 'Destination', 'above'));
    plan.stops.forEach((st) => {
      if (st.role === 'rest' || st.role === 'processing') return;
      add(st.coords, hubHtml(st.icon || '•', `${st.label} — ${st.name}`, st.role === 'transit' ? '#38bdf8' : '#a78bfa', shortHubLabel(st.name)));
    });

    if (fittedFor.current !== selected.trackingId) {
      fittedFor.current = selected.trackingId;
      setFollow(false);
      frameRoute(m, plan, vehicle && started ? vehicle.position : null, tilted);
    }
  }, [plan, mapReady, selected?.trackingId]);

  // ── Follow camera: keeps the vehicle centred, looking along its heading ──
  const followZoomed = useRef(false);
  useEffect(() => {
    if (!follow) { followZoomed.current = false; return; }
    const m = map.current;
    if (!m || !mapReady || !vehicle) return;
    const moving = vehicle.kind === 'move' && !selected?.isPaused;
    const opts: any = { center: vehicle.position, duration: followZoomed.current ? 950 : 2200, easing: (t: number) => t };
    if (!followZoomed.current) {
      opts.zoom = vehicle.mode === 'air' ? 5.5 : vehicle.mode === 'sea' ? 6.5 : 13.5;
      opts.pitch = 62;
      followZoomed.current = true;
    }
    if (moving) opts.bearing = vehicle.bearing;
    m.easeTo(opts);
  }, [follow, vehicle?.position[0], vehicle?.position[1], mapReady]);

  // ── Route progress + vehicle: every tick ──
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;
    if (!plan || !tl || !vehicle || !selected) {
      vehicleMarker.current?.remove();
      vehicleMarker.current = null;
      vehicleKey.current = '';
      return;
    }
    updateRoute(m, plan, tl, shownElapsed, started);

    const paused = selected.isPaused && previewProgress == null;
    const atStop = vehicle.kind === 'stop';
    const mode = vehicle.kind === 'move' ? vehicle.mode : (vehicle.stop?.type === 'seaport' ? 'sea' : vehicle.stop?.type?.includes('airport') ? 'air' : 'road');
    let badge = '';
    if (previewProgress != null) badge = `Preview · ${previewProgress.toFixed(1)}%`;
    else if (paused) badge = `⏸ On hold${vehicle.name ? ` · ${vehicle.name}` : ''}`;
    else if (!started) badge = 'Awaiting pickup';
    else if (atStop) badge = `${vehicle.icon} ${vehicle.label}`;
    else if (vehicle.mode === 'air') badge = `✈️ In flight → ${shortHubLabel(vehicle.segment?.to.name || '')}`;
    else if (vehicle.mode === 'sea') badge = `🚢 At sea → ${shortHubLabel(vehicle.segment?.to.name || '')}`;
    else badge = `🚛 On the road → ${shortHubLabel(vehicle.segment?.to.name || '')}`;
    const key = `${mode}|${paused}|${atStop}|${badge}`;
    if (!vehicleMarker.current) {
      const el = document.createElement('div');
      vehicleMarker.current = new mapboxgl.Marker({ element: el }).setLngLat(vehicle.position).addTo(m);
    }
    if (vehicleKey.current !== key) {
      vehicleMarker.current.getElement().innerHTML = vehicleHtml(mode, paused, atStop, badge);
      vehicleKey.current = key;
    }
    vehicleMarker.current.setLngLat(vehicle.position);
    setVehicleHeading(vehicleMarker.current, vehicle.bearing, m);
  }, [plan, tl, vehicle?.position[0], vehicle?.position[1], vehicle?.kind, shownElapsed, mapReady, styleVersion, selected?.isPaused, started, previewProgress]);

  const showWholeRoute = () => {
    setFollow(false);
    const m = map.current;
    if (!m || !plan) return;
    fittedFor.current = selected?.trackingId || null;
    frameRoute(m, plan, vehicle && started ? vehicle.position : null, tilted, 1500);
  };

  // Stable identity: the one-second clock re-renders TrackMap, and a fresh
  // callback here would defeat ShipmentCard's memo, rebuild every row each
  // second and swallow clicks landing on a row mid-rebuild.
  const selectShipment = useCallback((s: Shipment) => {
    setSelectedId(s.trackingId);
    setMobileTab('map');
  }, []);

  const airborne = !!(live && started && !selected?.isPaused && live.state.kind === 'move' && live.state.mode === 'air');
  const isAir = !!plan?.segments.some((s) => s.mode === 'air');
  const eta = raw?.estimated_delivery;
  const remaining = live && started ? live.tl.totalHours - live.elapsed : live ? live.tl.totalHours : 0;

  let phaseText = '';
  if (selected && live) {
    const st = live.state;
    if (!started) phaseText = `Awaiting pickup · journey takes ${formatHours(live.tl.totalHours)}`;
    else if (selected.isPaused) phaseText = `On hold${selected.pauseCategory ? ` — ${selected.pauseCategory}` : ''}${selected.pauseReason ? `: ${selected.pauseReason}` : ''}`;
    else if (st.kind === 'move') phaseText = `${st.icon} ${st.label}: ${st.segment?.from.name} → ${st.segment?.to.name}`;
    else phaseText = `${st.icon} ${st.label} · ${st.name}`;
  }

  const mapHeight = expanded ? 'calc(100vh - 150px)' : '560px';

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className={`fixed top-4 right-4 z-[70] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold border ${toast.startsWith('❌') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-3 flex-shrink-0 gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#0a192f]">Live Tracking Map</h2>
          <p className="text-xs text-gray-400">{active.length} shipments · {moving} on the move or awaiting pickup</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="flex items-center gap-1 text-xs bg-white px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"><RefreshCw size={13} /> Refresh</button>
          <span className="hidden sm:flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />Live</span>
        </div>
      </div>

      <div className="flex sm:hidden gap-1 mb-3 bg-gray-100 p-1 rounded-lg flex-shrink-0">
        <button onClick={() => setMobileTab('list')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium ${mobileTab === 'list' ? 'bg-white shadow text-[#0a192f]' : 'text-gray-500'}`}><List size={13} /> Shipments</button>
        <button onClick={() => setMobileTab('map')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium ${mobileTab === 'map' ? 'bg-white shadow text-[#0a192f]' : 'text-gray-500'}`}><MapIcon size={13} /> Map</button>
      </div>

      {!MAPBOX_TOKEN ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-800 font-medium mb-1">Mapbox token required</p>
          <p className="text-amber-600 text-sm">Add VITE_MAPBOX_TOKEN to .env.local and restart the dev server.</p>
        </div>
      ) : (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Shipment list */}
          <div className={`${mobileTab === 'map' ? 'hidden' : 'flex'} sm:flex flex-col w-full sm:w-72 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden`} style={{ maxHeight: expanded ? 'calc(100vh - 150px)' : 'calc(100vh - 170px)' }}>
            <div className="p-3 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by ID, city, name…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-400" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {visible.length === 0
                ? <div className="p-8 text-center text-sm text-gray-400">{search.trim() ? 'No shipments match that search' : 'No shipments yet'}</div>
                : visible.map((s) => <ShipmentCard key={s.trackingId} s={s} selected={s.trackingId === selectedId} onSelect={selectShipment} />)}
            </div>
          </div>

          {/* Map + details */}
          <div className={`${mobileTab === 'list' ? 'hidden' : 'flex'} sm:flex flex-col flex-1 min-w-0 gap-3`}>
            <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-[#0a192f] flex-shrink-0 transition-all duration-300" style={{ height: mapHeight }}>
              <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
              {!mapReady && <div className="absolute inset-0 flex items-center justify-center bg-[#0a192f]/90 z-20"><Loader2 size={28} className="animate-spin text-blue-400" /></div>}
              <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 items-start">
                <div className="flex gap-1 bg-[#0f172a]/85 backdrop-blur p-1 rounded-lg shadow-lg">
                  {(Object.keys(MAP_STYLES) as StyleKey[]).map((k) => (
                    <button key={k} onClick={() => setMapStyle(k)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${mapStyle === k ? 'bg-white text-[#0a192f]' : 'text-gray-200 hover:bg-white/10'}`}>
                      {MAP_STYLES[k].label}
                    </button>
                  ))}
                </div>
                {MAP_STYLES[mapStyle].standard && (
                  <div className="flex gap-1 bg-[#0f172a]/85 backdrop-blur p-1 rounded-lg shadow-lg" title="Lighting">
                    {LIGHT_PRESETS.map((p) => (
                      <button key={p} onClick={() => setLight(p)} title={p}
                        className={`w-7 h-6 rounded-md text-xs ${light === p ? 'bg-white' : 'hover:bg-white/10'}`}>
                        {LIGHT_ICONS[p]}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-1">
                  <button onClick={() => setExpanded((e) => !e)} title={expanded ? 'Shrink map' : 'Expand map'} className="w-8 h-8 bg-white rounded-lg shadow-lg flex items-center justify-center text-gray-600 hover:text-[#0a192f]">
                    {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>
                  <button onClick={toggleTilt} title={tilted ? 'Flat view' : '3D view'} className={`h-8 px-2 rounded-lg shadow-lg text-[11px] font-bold ${tilted ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>
                    {tilted ? '3D' : '2D'}
                  </button>
                  {vehicle && (
                    <>
                      <button onClick={() => setFollow((f) => !f)} title={follow ? 'Stop following' : 'Follow vehicle'}
                        className={`h-8 px-2 rounded-lg shadow-lg flex items-center gap-1 text-[11px] font-semibold ${follow ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:text-[#0a192f]'}`}>
                        <LocateFixed size={14} /> {follow ? 'Following' : 'Follow'}
                      </button>
                      <button onClick={showWholeRoute} title="Show whole route" className="h-8 px-2 bg-white rounded-lg shadow-lg text-[11px] font-semibold text-gray-600 hover:text-[#0a192f]">
                        Route
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="absolute bottom-9 left-3 z-10 bg-[#0f172a]/90 backdrop-blur px-3 py-1.5 rounded-lg shadow text-[10px] text-gray-200 flex gap-3 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded" style={{ background: MODE_COLORS.road }} />Truck</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded" style={{ background: MODE_COLORS.air }} />Flight</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded border-t border-dashed" style={{ borderColor: MODE_COLORS.sea }} />Vessel</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded" style={{ background: DONE_COLOR }} />Completed</span>
              </div>
              {(mapPickActive || panel === 'position') && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-sky-600 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow">
                  {mapPickActive ? 'Click near the airport you want to add' : 'Click the route to move the shipment there'}
                </div>
              )}
              {!selected && <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"><div className="bg-white/90 px-6 py-3 rounded-xl shadow text-sm font-medium text-gray-500">← Select a shipment</div></div>}
            </div>

            <AnimatePresence>
              {selected && (
                <motion.div key={selected.trackingId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-shrink-0">
                  <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-sm text-[#0a192f]">{selected.trackingId}</p>
                      <p className="text-[11px] text-gray-400 truncate">{selected.origin} → {selected.destination}</p>
                    </div>
                    {selected.status !== 'pending' && (
                      <button
                        onClick={() => setPauseTarget(selected)}
                        disabled={airborne}
                        title={airborne ? 'The aircraft is airborne — divert it or wait until it lands' : undefined}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed ${selected.isPaused ? 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200'}`}>
                        {selected.isPaused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> {airborne ? 'Airborne' : 'Pause'}</>}
                      </button>
                    )}
                  </div>

                  <div className={`px-4 py-2 text-xs font-semibold border-b ${selected.isPaused ? 'bg-amber-50 text-amber-800 border-amber-100' : 'bg-slate-50 text-slate-700 border-slate-100'}`}>
                    {phaseText || 'No route data for this shipment.'}
                  </div>

                  <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div><p className="text-gray-400 uppercase text-[10px]">Status</p><p className="font-semibold text-[#0a192f]">{STATUS_LABELS[selected.status]}</p></div>
                    <div><p className="text-gray-400 uppercase text-[10px]">Progress</p><p className="font-semibold text-[#0a192f]">{progressPct.toFixed(1)}%</p></div>
                    <div><p className="text-gray-400 uppercase text-[10px]">Arrival</p><p className="font-semibold text-blue-600">{selected.isPaused ? 'On hold' : formatDateTime(eta)}</p></div>
                    <div><p className="text-gray-400 uppercase text-[10px]">Time left</p><p className="font-semibold text-[#0a192f]">{live ? (selected.isPaused ? `${formatHours(remaining)} after resume` : formatHours(remaining)) : '—'}</p></div>
                    <div><p className="text-gray-400 uppercase text-[10px]">Speed</p><p className="font-semibold text-[#0a192f]">{live && started && !selected.isPaused && live.state.kind === 'move' ? `${live.state.segment?.speedKmh || '—'} km/h` : '0 km/h'}</p></div>
                    <div><p className="text-gray-400 uppercase text-[10px]">Distance</p><p className="font-semibold text-[#0a192f]">{raw?.route_distance ? `${Math.round(Number(raw.route_distance) / 1000).toLocaleString()} km` : '—'}</p></div>
                    <div><p className="text-gray-400 uppercase text-[10px]">Cargo</p><p className="font-semibold text-[#0a192f]">{selected.type} · {selected.weight}</p></div>
                    <div><p className="text-gray-400 uppercase text-[10px]">Courier</p><p className="font-semibold text-[#0a192f] truncate">{selected.courierName}</p></div>
                  </div>
                  <div className="px-4 pb-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${selected.isPaused ? 'bg-amber-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, progressPct)}%` }} />
                    </div>
                  </div>

                  <div className="px-4 border-t border-gray-100 flex gap-1 overflow-x-auto">
                    {([
                      ['journey', '🧭 Journey'],
                      ...(started ? [['position', finished ? '↩️ Re-open' : '📍 Move shipment']] : []),
                      ...(live && !finished ? [['transit', isAir ? '✈️ Stops & layovers' : '🛑 Scheduled stops']] : []),
                    ] as [typeof panel, string][]).map(([id, label]) => (
                      <button key={id} onClick={() => setPanel(panel === id ? null : id)}
                        className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap ${panel === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {panel === 'journey' && live && (
                    <div className="px-4 py-3 max-h-80 overflow-y-auto border-t border-gray-50">
                      <JourneyTimeline live={live} paused={selected.isPaused} started={started} nowMs={now} />
                    </div>
                  )}
                  {panel === 'position' && live && (
                    <div className="px-4 py-3 border-t border-gray-50">
                      <PositionEditor
                        key={selected.trackingId}
                        shipment={selected}
                        live={live}
                        external={clickSnap}
                        onPreview={setPreviewProgress}
                        onDone={afterAction}
                        onCancel={() => setPanel('journey')}
                      />
                    </div>
                  )}
                  {panel === 'transit' && !finished && (
                    <div className="px-4 py-3 border-t border-gray-50">
                      <StopControls
                        shipment={selected}
                        live={live}
                        onChanged={afterAction}
                        mapPick={{ active: mapPickActive, toggle: () => setMapPickActive((v) => !v), point: mapPickPoint }}
                      />
                    </div>
                  )}
                  {!live && (
                    <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-50 flex items-center gap-1"><Edit size={12} /> This shipment has no route yet.</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <PauseModal shipment={pauseTarget} onClose={() => setPauseTarget(null)} onDone={afterAction} />
      <style>{MARKER_KEYFRAMES}</style>
    </div>
  );
};

export default TrackMap;
