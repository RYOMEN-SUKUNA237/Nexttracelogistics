import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Pause, Play, Navigation, Clock, Package, Truck,
  ChevronLeft, ChevronRight, Eye, LocateFixed, RefreshCw,
  Coffee, ShieldCheck, Route, AlertTriangle, FileText, X, Loader2, MessageSquare
} from 'lucide-react';
import { Shipment } from './types';
import * as api from '../../services/api';
import mapboxgl from 'mapbox-gl';
// mapbox-gl CSS loaded via index.html <link> to avoid PostCSS conflict
import { MAPBOX_TOKEN, initMapbox, interpolateAlongRoute, formatDistance, formatDuration, computeTimeBasedProgress, computeTimeRemaining, getRouteWithFallback, ROUTE_STYLE, calculatePositionAtTime } from '../../utils/mapbox';

interface TrackMapProps {
  shipments: Shipment[];
  setShipments: React.Dispatch<React.SetStateAction<Shipment[]>>;
  onRefresh: () => void;
}

const statusColors: Record<string, string> = {
  'in-transit': '#3b82f6',
  'out-for-delivery': '#06b6d4',
  'paused': '#f59e0b',
  'picked-up': '#8b5cf6',
  'pending': '#6b7280',
  'delivered': '#10b981',
};

const TrackMap: React.FC<TrackMapProps> = ({ shipments, setShipments, onRefresh }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const auxMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const drawnRoutesRef = useRef<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [fullShipmentData, setFullShipmentData] = useState<Record<string, any>>({});
  const [liveProgress, setLiveProgress] = useState<Record<string, number>>({});
  const [liveEta, setLiveEta] = useState<Record<string, string>>({});
  const routesFetchedRef = useRef<Set<string>>(new Set());

  // Pause modal state
  const [pauseModalShipment, setPauseModalShipment] = useState<Shipment | null>(null);
  const [pauseCategory, setPauseCategory] = useState<string>('');
  const [pauseCustomReason, setPauseCustomReason] = useState('');
  const [pauseSubmitting, setPauseSubmitting] = useState(false);

  const activeShipments = shipments.filter(s =>
    ['in-transit', 'out-for-delivery', 'paused', 'picked-up'].includes(s.status)
  );

  // Fetch full shipment data (with route_data) from API, then fetch missing routes
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const res = await api.shipments.list({ limit: 100 });
        const dataMap: Record<string, any> = {};
        for (const s of res.shipments) {
          dataMap[s.tracking_id] = {
            ...s,
            route_data: s.route_data ? (typeof s.route_data === 'string' ? JSON.parse(s.route_data) : s.route_data) : null,
            transport_modes: s.transport_modes ? (typeof s.transport_modes === 'string' ? JSON.parse(s.transport_modes) : s.transport_modes) : null,
          };
        }
        setFullShipmentData(dataMap);

        // Fetch real road routes for shipments that don't have route_data
        for (const tid of Object.keys(dataMap)) {
          const d = dataMap[tid];
          if (!d.route_data && d.origin_lat && d.origin_lng && d.dest_lat && d.dest_lng && !routesFetchedRef.current.has(tid)) {
            routesFetchedRef.current.add(tid);
            getRouteWithFallback([d.origin_lng, d.origin_lat], [d.dest_lng, d.dest_lat]).then(result => {
              if (result?.geometry) {
                setFullShipmentData(prev => ({
                  ...prev,
                  [tid]: { ...prev[tid], route_data: result.geometry, route_distance: result.distance, route_duration: result.duration },
                }));
              }
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('Failed to fetch shipment data:', err);
      }
    };
    fetchRoutes();
  }, [shipments]);

  // Live progress + ETA ticker — recomputes every 2 seconds
  useEffect(() => {
    const tick = () => {
      const progressMap: Record<string, number> = {};
      const etaMap: Record<string, string> = {};
      for (const s of activeShipments) {
        const full = fullShipmentData[s.trackingId];
        if (full) {
          progressMap[s.trackingId] = computeTimeBasedProgress(full);
          etaMap[s.trackingId] = computeTimeRemaining(full);
        } else {
          progressMap[s.trackingId] = s.progress;
          etaMap[s.trackingId] = '';
        }
      }
      setLiveProgress(progressMap);
      setLiveEta(etaMap);
    };
    tick();
    const interval = setInterval(tick, 2000);
    return () => clearInterval(interval);
  }, [activeShipments, fullShipmentData]);

  // Init Mapbox map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    initMapbox();

    if (!MAPBOX_TOKEN) {
      setMapReady(false);
      return;
    }

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/standard',
      center: [-95.3698, 29.7604], // Default to Houston
      zoom: 13,
      pitch: 60,
      bearing: -20,
      antialias: true
    });

    m.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

    m.on('style.load', () => {
      // Atmosphere / fog for the globe — gives it the spherical glow
      m.setFog({
        color: 'rgb(10, 25, 47)',          // dark navy horizon
        'high-color': 'rgb(20, 40, 80)',    // upper atmosphere
        'horizon-blend': 0.08,
        'space-color': 'rgb(5, 10, 20)',    // dark space background
        'star-intensity': 0.6,              // subtle stars
      });
    });

    m.on('load', () => {
      setMapReady(true);
    });

    map.current = m;

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
      m.remove();
      map.current = null;
    };
  }, []);

  // Stable route drawing — add new routes, update existing sources, remove stale ones
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const m = map.current;
    const activeIds = new Set(activeShipments.map(s => s.trackingId));

    // Remove routes for shipments no longer active
    drawnRoutesRef.current.forEach(tid => {
      if (!activeIds.has(tid)) {
        try { m.removeLayer(`route-glow-${tid}`); } catch (e) {}
        try { m.removeLayer(`route-line-${tid}`); } catch (e) {}
        try { m.removeSource(`route-${tid}`); } catch (e) {}
        drawnRoutesRef.current.delete(tid);
      }
    });

    // Add or update routes for active shipments
    activeShipments.forEach(s => {
      const fullData = fullShipmentData[s.trackingId];
      const hasRoute = fullData?.route_data?.coordinates?.length > 0;
      if (!hasRoute) return;

      const sourceId = `route-${s.trackingId}`;
      const glowLayerId = `route-glow-${s.trackingId}`;
      const layerId = `route-line-${s.trackingId}`;
      const geojsonData = { type: 'Feature' as const, properties: {}, geometry: fullData.route_data };
      const isSelected = selectedId === s.trackingId;

      try {
        const existingSource = m.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
        if (existingSource) {
          existingSource.setData(geojsonData as any);
          try {
            m.setPaintProperty(layerId, 'line-opacity', isSelected ? 1 : ROUTE_STYLE.opacity);
            m.setPaintProperty(layerId, 'line-dasharray', s.isPaused ? ROUTE_STYLE.pausedDash : ROUTE_STYLE.activeDash);
            m.setPaintProperty(glowLayerId, 'line-opacity', isSelected ? ROUTE_STYLE.glowOpacity * 2 : ROUTE_STYLE.glowOpacity);
          } catch (e) {}
        } else {
          m.addSource(sourceId, { type: 'geojson', data: geojsonData as any });
          // Glow layer (subtle shadow beneath the route)
          m.addLayer({
            id: glowLayerId,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': ROUTE_STYLE.lineJoin, 'line-cap': ROUTE_STYLE.lineCap },
            paint: {
              'line-color': ROUTE_STYLE.glowColor,
              'line-width': ROUTE_STYLE.glowWidth,
              'line-opacity': isSelected ? ROUTE_STYLE.glowOpacity * 2 : ROUTE_STYLE.glowOpacity,
            },
          });
          // Main route line — navy blue, width 5, rounded
          m.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': ROUTE_STYLE.lineJoin, 'line-cap': ROUTE_STYLE.lineCap },
            paint: {
              'line-color': ROUTE_STYLE.color,
              'line-width': ROUTE_STYLE.width,
              'line-opacity': isSelected ? 1 : ROUTE_STYLE.opacity,
              'line-dasharray': s.isPaused ? ROUTE_STYLE.pausedDash : ROUTE_STYLE.activeDash,
            },
          });
          drawnRoutesRef.current.add(s.trackingId);
        }
      } catch (e) {}
    });
  }, [activeShipments, mapReady, fullShipmentData, selectedId]);

  // Create / rebuild markers when shipment list or data changes
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const m = map.current;

    // Clear old markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();
    auxMarkersRef.current.forEach(marker => marker.remove());
    auxMarkersRef.current = [];

    activeShipments.forEach(s => {
      const fullData = fullShipmentData[s.trackingId];
      const hasCoords = fullData && fullData.origin_lat && fullData.origin_lng && fullData.dest_lat && fullData.dest_lng;
      const hasRoute = fullData?.route_data?.coordinates?.length > 0;
      const color = statusColors[s.status] || '#3b82f6';
      const progress = liveProgress[s.trackingId] ?? s.progress;

      // Calculate initial marker position
      let markerLng: number, markerLat: number;
      if (hasRoute) {
        const pos = interpolateAlongRoute(fullData.route_data.coordinates, progress);
        markerLng = pos[0];
        markerLat = pos[1];
      } else if (hasCoords) {
        const p = progress / 100;
        markerLng = fullData.origin_lng + (fullData.dest_lng - fullData.origin_lng) * p;
        markerLat = fullData.origin_lat + (fullData.dest_lat - fullData.origin_lat) * p;
      } else {
        return;
      }

      // Create marker element
      const el = document.createElement('div');
      el.className = 'mapbox-shipment-marker';
      el.innerHTML = `
        <div style="position:relative;cursor:pointer;">
          ${!s.isPaused ? `<div style="width:24px;height:24px;border-radius:50%;background:${color};opacity:0.3;position:absolute;top:-4px;left:-4px;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ''}
          <div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);position:relative;z-index:1;"></div>
        </div>
      `;

      el.addEventListener('click', () => {
        setSelectedId(s.trackingId);
        const mk = markersRef.current.get(s.trackingId);
        const pos = mk?.getLngLat();
        if (pos) map.current?.flyTo({ center: [pos.lng, pos.lat], zoom: 8, duration: 1500 });
      });

      // Origin marker (small green dot)
      if (hasCoords) {
        const originEl = document.createElement('div');
        originEl.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:#10b981;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2);"></div>`;
        const om = new mapboxgl.Marker({ element: originEl }).setLngLat([fullData.origin_lng, fullData.origin_lat]).addTo(m);
        auxMarkersRef.current.push(om);

        const destEl = document.createElement('div');
        destEl.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2);"></div>`;
        const dm = new mapboxgl.Marker({ element: destEl }).setLngLat([fullData.dest_lng, fullData.dest_lat]).addTo(m);
        auxMarkersRef.current.push(dm);
      }

      // Popup with ETA
      const eta = liveEta[s.trackingId] || '';
      const popup = new mapboxgl.Popup({ offset: 20, closeButton: false, className: 'shipment-popup' }).setHTML(`
        <div style="padding:8px;min-width:180px;">
          <div style="font-weight:700;font-size:13px;color:#0a192f;font-family:monospace;">${s.trackingId}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;">${s.origin} → ${s.destination}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
            <span style="width:8px;height:8px;border-radius:50%;background:${color};"></span>
            <span style="font-size:11px;font-weight:600;color:${color};text-transform:uppercase;">${s.isPaused ? 'Paused' : s.status.replace('-', ' ')}</span>
          </div>
          <div style="width:100%;height:4px;background:#e5e7eb;border-radius:4px;margin-top:8px;">
            <div style="width:${Math.round(progress)}%;height:4px;background:${color};border-radius:4px;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;margin-top:4px;">
            <span>${Math.round(progress)}% complete</span>
            <span>${eta}</span>
          </div>
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([markerLng, markerLat])
        .setPopup(popup)
        .addTo(m);

      markersRef.current.set(s.trackingId, marker);
    });
  }, [activeShipments, mapReady, fullShipmentData]);

  // Smoothly update marker positions when liveProgress changes (lightweight — no route/marker rebuild)
  useEffect(() => {
    if (!map.current || !mapReady) return;
    activeShipments.forEach(s => {
      const marker = markersRef.current.get(s.trackingId);
      if (!marker) return;
      const fullData = fullShipmentData[s.trackingId];
      if (!fullData) return;
      const hasRoute = fullData?.route_data?.coordinates?.length > 0;
      const hasCoords = fullData.origin_lat && fullData.origin_lng && fullData.dest_lat && fullData.dest_lng;
      const progress = liveProgress[s.trackingId] ?? s.progress;

      let lng: number, lat: number;
      if (hasRoute) {
        const pos = interpolateAlongRoute(fullData.route_data.coordinates, progress);
        lng = pos[0];
        lat = pos[1];
      } else if (hasCoords) {
        const p = progress / 100;
        lng = fullData.origin_lng + (fullData.dest_lng - fullData.origin_lng) * p;
        lat = fullData.origin_lat + (fullData.dest_lat - fullData.origin_lat) * p;
      } else {
        return;
      }
      marker.setLngLat([lng, lat]);
    });
  }, [liveProgress]);

  // Pause reason categories with icons
  const pauseCategories = [
    { id: 'in-transit-delay', label: 'Transit Delay', icon: <Route size={18} />, desc: 'Route delay or traffic congestion' },
    { id: 'driver-break', label: 'Driver Break', icon: <Coffee size={18} />, desc: 'Mandatory driver rest period' },
    { id: 'customs-control', label: 'Customs Control', icon: <ShieldCheck size={18} />, desc: 'Held at customs checkpoint' },
    { id: 'weather-hazard', label: 'Weather Hazard', icon: <AlertTriangle size={18} />, desc: 'Adverse weather conditions' },
    { id: 'vehicle-issue', label: 'Vehicle Issue', icon: <Truck size={18} />, desc: 'Mechanical issue or maintenance' },
    { id: 'other', label: 'Other', icon: <FileText size={18} />, desc: 'Specify a custom reason below' },
  ];

  const handlePauseClick = (shipment: Shipment) => {
    if (shipment.isPaused) {
      // Resume immediately
      handleResume(shipment);
    } else {
      // Open pause modal
      setPauseModalShipment(shipment);
      setPauseCategory('');
      setPauseCustomReason('');
    }
  };

  const handleResume = async (shipment: Shipment) => {
    try {
      await api.shipments.togglePause(shipment.trackingId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to resume.');
    }
  };

  const handlePauseSubmit = async () => {
    if (!pauseModalShipment || !pauseCategory) return;
    try {
      setPauseSubmitting(true);
      const categoryLabel = pauseCategories.find(c => c.id === pauseCategory)?.label || pauseCategory;
      await api.shipments.togglePause(pauseModalShipment.trackingId, {
        pause_category: categoryLabel,
        pause_reason: pauseCustomReason.trim() || undefined,
      });
      setPauseModalShipment(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to pause.');
    } finally {
      setPauseSubmitting(false);
    }
  };

  const focusShipment = (s: Shipment) => {
    setSelectedId(s.trackingId);
    const marker = markersRef.current.get(s.trackingId);
    if (marker && map.current) {
      const lngLat = marker.getLngLat();
      map.current.flyTo({ center: [lngLat.lng, lngLat.lat], zoom: 15.5, pitch: 60, bearing: -20, duration: 1500 });
      marker.togglePopup();
    }
  };

  const fitAllMarkers = () => {
    if (!map.current || markersRef.current.size === 0) return;
    const bounds = new mapboxgl.LngLatBounds();
    markersRef.current.forEach(marker => bounds.extend(marker.getLngLat()));
    map.current.fitBounds(bounds, { padding: 80, duration: 1500 });
  };

  const selected = selectedId ? activeShipments.find(s => s.trackingId === selectedId) : null;
  const selectedFull = selectedId ? fullShipmentData[selectedId] : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0a192f]">Live Tracking Map</h2>
          <p className="text-sm text-gray-500">{activeShipments.length} active shipments being tracked</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fitAllMarkers} className="flex items-center gap-1.5 text-xs bg-white px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium transition-colors">
            <LocateFixed size={14} /> Fit All
          </button>
          <button onClick={onRefresh} className="flex items-center gap-1.5 text-xs bg-white px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <span className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 font-medium">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" /> Live
          </span>
        </div>
      </div>

      {!MAPBOX_TOKEN ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-800 font-medium mb-2">Mapbox Token Required</p>
          <p className="text-amber-600 text-sm">Add your Mapbox access token to <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">.env.local</code> as <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">MAPBOX_TOKEN=pk.your_token_here</code></p>
          <p className="text-amber-500 text-xs mt-2">Get a free token at <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noreferrer" className="underline">mapbox.com</a></p>
        </div>
      ) : (
        <div className="relative rounded-lg overflow-hidden border border-gray-200 shadow-sm" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
          {/* Mapbox container */}
          <div ref={mapContainer} className="absolute inset-0" />

          {/* Sidebar Toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute top-4 left-4 z-10 w-8 h-8 bg-white rounded-lg shadow-lg flex items-center justify-center text-gray-600 hover:text-[#0a192f] transition-colors"
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          {/* Animated Sidebar */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ x: -340, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -340, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute top-0 left-0 bottom-0 w-80 bg-white/95 backdrop-blur-md z-10 border-r border-gray-200 shadow-xl flex flex-col"
              >
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-[#0a192f] text-sm">Active Shipments</h3>
                    <p className="text-xs text-gray-400">{activeShipments.length} being tracked</p>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">
                      <Truck size={10} /> {activeShipments.filter(s => !s.isPaused).length}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-amber-50 text-amber-600 font-medium">
                      <Pause size={10} /> {activeShipments.filter(s => s.isPaused).length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <AnimatePresence>
                    {activeShipments.length === 0 ? (
                      <div className="p-8 text-center text-sm text-gray-400">No active shipments.</div>
                    ) : (
                      activeShipments.map((s, i) => {
                        const isSelected = selectedId === s.trackingId;
                        const full = fullShipmentData[s.trackingId];
                        return (
                          <motion.div
                            key={s.trackingId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ delay: i * 0.05 }}
                            className={`p-4 border-b border-gray-50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/80 border-l-4 border-l-blue-500' : 'hover:bg-gray-50/50'}`}
                            onClick={() => focusShipment(s)}
                          >
                            <div className="flex items-start justify-between mb-1.5">
                              <div>
                                <p className="text-xs font-mono font-bold text-[#0a192f]">{s.trackingId}</p>
                                <p className="text-[11px] text-gray-400">{s.courierName}</p>
                              </div>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                                s.isPaused ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {s.isPaused ? <Pause size={9} /> : <Navigation size={9} />}
                                {s.isPaused ? 'Paused' : s.status.replace('-', ' ')}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 text-[11px] text-gray-500 mb-2">
                              <MapPin size={10} className="text-green-500 flex-shrink-0" />
                              <span className="truncate">{s.origin}</span>
                              <span className="text-gray-300 mx-0.5">→</span>
                              <MapPin size={10} className="text-red-500 flex-shrink-0" />
                              <span className="truncate">{s.destination}</span>
                            </div>

                            {full?.route_distance && (
                              <div className="flex gap-3 text-[10px] text-gray-400 mb-1">
                                <span>{formatDistance(full.route_distance)}</span>
                                <span>{formatDuration(full.route_duration || 0)}</span>
                              </div>
                            )}

                            {liveEta[s.trackingId] && (
                              <div className="flex items-center gap-1 text-[10px] text-blue-600 font-medium mb-2">
                                <Clock size={10} />
                                <span>{liveEta[s.trackingId]}</span>
                              </div>
                            )}

                            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                              <motion.div
                                className={`h-1.5 rounded-full ${s.isPaused ? 'bg-amber-500' : 'bg-blue-600'}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.round(liveProgress[s.trackingId] ?? s.progress)}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                              />
                            </div>

                            {/* Pause reason badge */}
                            {s.isPaused && s.pauseCategory && (
                              <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-amber-50 border border-amber-200/60 rounded-md">
                                <MessageSquare size={10} className="text-amber-600 flex-shrink-0" />
                                <span className="text-[10px] text-amber-700 font-medium truncate">
                                  {s.pauseCategory}{s.pauseReason ? `: ${s.pauseReason}` : ''}
                                </span>
                              </div>
                            )}

                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handlePauseClick(s); }}
                                className={`flex-1 px-2 py-1.5 text-[11px] font-medium rounded-md flex items-center justify-center gap-1 transition-colors ${
                                  s.isPaused
                                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                }`}
                              >
                                {s.isPaused ? <><Play size={11} /> Resume</> : <><Pause size={11} /> Pause</>}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); focusShipment(s); }}
                                className="px-2 py-1.5 text-[11px] font-medium rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100 flex items-center gap-1"
                              >
                                <Eye size={11} /> View
                              </button>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Selected shipment detail overlay */}
          <AnimatePresence>
            {selected && selectedFull && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute bottom-4 right-4 w-80 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 z-10 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="font-mono font-bold text-sm text-[#0a192f]">{selected.trackingId}</p>
                    <p className="text-[11px] text-gray-400">{selected.courierName}</p>
                  </div>
                  <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600 text-xs font-medium">Close</button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><p className="text-gray-400 text-[10px] uppercase">Origin</p><p className="font-medium text-[#0a192f]">{selected.origin}</p></div>
                    <div><p className="text-gray-400 text-[10px] uppercase">Destination</p><p className="font-medium text-[#0a192f]">{selected.destination}</p></div>
                    {selectedFull.route_distance && (
                      <>
                        <div><p className="text-gray-400 text-[10px] uppercase">Distance</p><p className="font-medium text-[#0a192f]">{formatDistance(selectedFull.route_distance)}</p></div>
                        <div><p className="text-gray-400 text-[10px] uppercase">Est. Duration</p><p className="font-medium text-[#0a192f]">{formatDuration(selectedFull.route_duration || 0)}</p></div>
                      </>
                    )}
                    <div><p className="text-gray-400 text-[10px] uppercase">Cargo</p><p className="font-medium text-[#0a192f]">{selected.type}</p></div>
                    <div><p className="text-gray-400 text-[10px] uppercase">Weight</p><p className="font-medium text-[#0a192f]">{selected.weight || 'N/A'}</p></div>
                  </div>
                  {selectedFull.transport_modes && (
                    <div>
                      <p className="text-gray-400 text-[10px] uppercase mb-1.5">Transport Modes</p>
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(selectedFull.transport_modes) ? selectedFull.transport_modes : []).map((mode: string, i: number) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{mode}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${selected.isPaused ? 'bg-amber-500' : 'bg-blue-600'}`} style={{ width: `${Math.round(liveProgress[selected.trackingId] ?? selected.progress)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>{Math.round(liveProgress[selected.trackingId] ?? selected.progress)}% complete{selected.isPaused ? ' (PAUSED)' : ''}</span>
                    {liveEta[selected.trackingId] && (
                      <span className="text-blue-600 font-medium">{liveEta[selected.trackingId]}</span>
                    )}
                  </div>
                  {/* Pause reason in detail overlay */}
                  {selected.isPaused && selected.pauseCategory && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Pause size={12} className="text-amber-600" />
                        <span className="text-[11px] font-semibold text-amber-800">Pause Reason</span>
                      </div>
                      <p className="text-[11px] font-medium text-amber-700">{selected.pauseCategory}</p>
                      {selected.pauseReason && (
                        <p className="text-[10px] text-amber-600 leading-relaxed">{selected.pauseReason}</p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pause Modal Overlay */}
          <AnimatePresence>
            {pauseModalShipment && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                onClick={() => !pauseSubmitting && setPauseModalShipment(null)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md mx-4 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Pause size={18} className="text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#0a192f] text-sm">Pause Shipment</h3>
                        <p className="text-[11px] text-gray-500 font-mono">{pauseModalShipment.trackingId}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => !pauseSubmitting && setPauseModalShipment(null)}
                      className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="px-6 py-5 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">Select Pause Reason</label>
                      <div className="grid grid-cols-2 gap-2">
                        {pauseCategories.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => setPauseCategory(cat.id)}
                            className={`flex items-start gap-2.5 p-3 rounded-lg border-2 text-left transition-all ${
                              pauseCategory === cat.id
                                ? 'border-amber-500 bg-amber-50 shadow-sm'
                                : 'border-gray-150 bg-white hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className={`flex-shrink-0 mt-0.5 ${
                              pauseCategory === cat.id ? 'text-amber-600' : 'text-gray-400'
                            }`}>
                              {cat.icon}
                            </div>
                            <div>
                              <p className={`text-xs font-semibold ${
                                pauseCategory === cat.id ? 'text-amber-800' : 'text-gray-700'
                              }`}>{cat.label}</p>
                              <p className="text-[10px] text-gray-400 leading-snug mt-0.5">{cat.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom reason text */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Additional Details <span className="text-gray-300 normal-case">(optional)</span>
                      </label>
                      <textarea
                        rows={3}
                        value={pauseCustomReason}
                        onChange={(e) => setPauseCustomReason(e.target.value)}
                        placeholder="Provide more details about the pause reason..."
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none resize-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setPauseModalShipment(null)}
                      disabled={pauseSubmitting}
                      className="px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePauseSubmit}
                      disabled={!pauseCategory || pauseSubmitting}
                      className="px-5 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      {pauseSubmitting ? (
                        <><Loader2 size={13} className="animate-spin" /> Pausing...</>
                      ) : (
                        <><Pause size={13} /> Confirm Pause</>
                      )}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg border border-gray-200">
            <div className="flex items-center gap-4 text-[11px] text-gray-600 font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-500 rounded-full" /> In Transit</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-500 rounded-full" /> Paused</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-green-500 rounded-full" /> Origin</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 rounded-full" /> Destination</span>
            </div>
          </div>
        </div>
      )}

      {/* CSS for ping animation */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2.5); opacity: 0; }
        }
        .shipment-popup .mapboxgl-popup-content {
          border-radius: 12px;
          padding: 0;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
          border: 1px solid #e5e7eb;
        }
        .shipment-popup .mapboxgl-popup-tip {
          border-top-color: white;
        }
      `}</style>
    </div>
  );
};

export default TrackMap;
