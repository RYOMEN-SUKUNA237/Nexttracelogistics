import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, MapPin, Clock, CheckCircle, Truck, Pause, RotateCcw,
  ArrowLeft, Phone, User, Star, ChevronDown, ChevronUp, Box,
  Calendar, Weight, Shield, Navigation, Loader2, AlertCircle, Search
} from 'lucide-react';
import mapboxgl from 'mapbox-gl';
// mapbox-gl CSS loaded via index.html <link> to avoid PostCSS conflict
import { MAPBOX_TOKEN, initMapbox, interpolateAlongRoute, formatDistance, formatDuration, getRouteWithFallback, computeTimeBasedProgress, computeTimeRemaining, ROUTE_STYLE } from '../utils/mapbox';

const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  'pending':          { color: 'text-gray-600',   bg: 'bg-gray-100',   icon: <Clock size={16} />,       label: 'Order Confirmed' },
  'picked-up':        { color: 'text-purple-600', bg: 'bg-purple-100', icon: <Package size={16} />,     label: 'Picked Up' },
  'in-transit':       { color: 'text-blue-600',   bg: 'bg-blue-100',   icon: <Truck size={16} />,       label: 'In Transit' },
  'out-for-delivery': { color: 'text-cyan-600',   bg: 'bg-cyan-100',   icon: <Navigation size={16} />,  label: 'Out for Delivery' },
  'delivered':        { color: 'text-green-600',  bg: 'bg-green-100',  icon: <CheckCircle size={16} />, label: 'Delivered' },
  'returned':         { color: 'text-red-600',    bg: 'bg-red-100',    icon: <RotateCcw size={16} />,   label: 'Returned' },
  'paused':           { color: 'text-amber-600',  bg: 'bg-amber-100',  icon: <Pause size={16} />,       label: 'On Hold' },
};

const statusOrder = ['pending', 'picked-up', 'in-transit', 'out-for-delivery', 'delivered'];

const TrackingDashboard: React.FC = () => {
  const { trackingId } = useParams<{ trackingId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(trackingId || '');
  const [showHistory, setShowHistory] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const currentMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeCoordsRef = useRef<[number, number][] | null>(null);
  const [liveProgress, setLiveProgress] = useState<number>(0);
  const [liveEta, setLiveEta] = useState<string>('');

  const fetchTracking = async (id: string) => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch(`/api/shipments/${id}/track`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Shipment not found.');
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Could not find shipment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (trackingId) fetchTracking(trackingId);
  }, [trackingId]);

  // Live progress + ETA ticker — recomputes every 2 seconds
  useEffect(() => {
    if (!data?.shipment) return;
    const tick = () => {
      const s = data.shipment;
      const progress = computeTimeBasedProgress(s);
      setLiveProgress(progress);
      setLiveEta(computeTimeRemaining(s));

      // Animate marker position along route
      if (currentMarkerRef.current && s.status !== 'delivered' && s.status !== 'returned') {
        if (routeCoordsRef.current && routeCoordsRef.current.length > 2) {
          const pos = interpolateAlongRoute(routeCoordsRef.current, progress);
          currentMarkerRef.current.setLngLat(pos);
        } else if (s.origin_lat && s.origin_lng && s.dest_lat && s.dest_lng) {
          const p = progress / 100;
          currentMarkerRef.current.setLngLat([
            s.origin_lng + (s.dest_lng - s.origin_lng) * p,
            s.origin_lat + (s.dest_lat - s.origin_lat) * p,
          ]);
        }
      }
    };
    tick();
    const interval = setInterval(tick, 2000);
    return () => clearInterval(interval);
  }, [data]);

  // Init map when data loads
  useEffect(() => {
    if (!data?.shipment || !mapContainer.current || !MAPBOX_TOKEN) return;
    initMapbox();

    const s = data.shipment;
    const hasCoords = s.origin_lat && s.origin_lng && s.dest_lat && s.dest_lng;
    if (!hasCoords) return;

    if (map.current) { map.current.remove(); map.current = null; }

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [(s.origin_lng + s.dest_lng) / 2, (s.origin_lat + s.dest_lat) / 2],
      zoom: 4,
    });

    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    const addRouteAndMarkers = (routeGeometry: any | null) => {
      // Route line — draw from fetched or stored route, or fallback to straight line
      const geometry = routeGeometry || {
        type: 'LineString',
        coordinates: [[s.origin_lng, s.origin_lat], [s.dest_lng, s.dest_lat]],
      };

      m.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry },
      });
      m.addLayer({
        id: 'route-line-glow',
        type: 'line',
        source: 'route',
        layout: { 'line-join': ROUTE_STYLE.lineJoin, 'line-cap': ROUTE_STYLE.lineCap },
        paint: { 'line-color': ROUTE_STYLE.glowColor, 'line-width': ROUTE_STYLE.glowWidth, 'line-opacity': ROUTE_STYLE.glowOpacity },
      });
      m.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': ROUTE_STYLE.lineJoin, 'line-cap': ROUTE_STYLE.lineCap },
        paint: { 'line-color': ROUTE_STYLE.color, 'line-width': ROUTE_STYLE.width, 'line-opacity': ROUTE_STYLE.opacity },
      });

      // Origin marker
      const originEl = document.createElement('div');
      originEl.innerHTML = `<div style="width:14px;height:14px;border-radius:50%;background:#10b981;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);"></div>`;
      new mapboxgl.Marker({ element: originEl })
        .setLngLat([s.origin_lng, s.origin_lat])
        .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(`<div style="padding:6px;font-size:12px;"><strong>Origin</strong><br/>${s.origin}</div>`))
        .addTo(m);

      // Destination marker
      const destEl = document.createElement('div');
      destEl.innerHTML = `<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);"></div>`;
      new mapboxgl.Marker({ element: destEl })
        .setLngLat([s.dest_lng, s.dest_lat])
        .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(`<div style="padding:6px;font-size:12px;"><strong>Destination</strong><br/>${s.destination}</div>`))
        .addTo(m);

      // Current position marker — use time-based progress
      const coords = geometry?.coordinates;
      routeCoordsRef.current = coords?.length > 2 ? coords : null;
      const initialProgress = computeTimeBasedProgress(s);
      let currentPos: [number, number];
      if (coords?.length > 2) {
        currentPos = interpolateAlongRoute(coords, initialProgress);
      } else {
        const p = initialProgress / 100;
        currentPos = [
          s.origin_lng + (s.dest_lng - s.origin_lng) * p,
          s.origin_lat + (s.dest_lat - s.origin_lat) * p,
        ];
      }

      if (s.status !== 'delivered' && s.status !== 'returned') {
        const curEl = document.createElement('div');
        curEl.innerHTML = `
          <div style="position:relative;">
            <div style="width:28px;height:28px;border-radius:50%;background:#3b82f6;opacity:0.2;position:absolute;top:-6px;left:-6px;animation:ping 2s ease-in-out infinite;"></div>
            <div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 12px rgba(59,130,246,0.4);position:relative;z-index:1;"></div>
          </div>
        `;
        const marker = new mapboxgl.Marker({ element: curEl })
          .setLngLat(currentPos)
          .addTo(m);
        currentMarkerRef.current = marker;
      }

      // Fit bounds
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([s.origin_lng, s.origin_lat]);
      bounds.extend([s.dest_lng, s.dest_lat]);
      m.fitBounds(bounds, { padding: 60, duration: 1000 });
    };

    m.on('load', async () => {
      // Use stored route_data if available, otherwise fetch it live
      if (s.route_data?.coordinates?.length > 0) {
        addRouteAndMarkers(s.route_data);
      } else {
        // Try to fetch route dynamically (road route with great circle arc fallback)
        try {
          const result = await getRouteWithFallback(
            [s.origin_lng, s.origin_lat],
            [s.dest_lng, s.dest_lat]
          );
          addRouteAndMarkers(result?.geometry || null);
        } catch {
          addRouteAndMarkers(null);
        }
      }
    });

    map.current = m;

    return () => { m.remove(); map.current = null; };
  }, [data]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      window.location.hash = `/track/${searchInput.trim()}`;
      fetchTracking(searchInput.trim());
    }
  };

  const shipment = data?.shipment;
  const history = data?.history || [];
  const courier = data?.courier;
  const currentStatusIdx = shipment ? statusOrder.indexOf(shipment.status) : -1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#0a192f] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package size={18} />
            </div>
            <span className="text-lg font-bold tracking-tight">NexusRoute Global Logistics</span>
          </Link>
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Enter tracking ID..."
                className="w-48 sm:w-64 h-10 pl-4 pr-10 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:bg-white/15 font-mono"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">
                <Search size={16} />
              </button>
            </div>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0a192f] mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Home
        </Link>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        )}

        {error && !loading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-[#0a192f] mb-2">Shipment Not Found</h2>
            <p className="text-gray-500 mb-6">{error}</p>
            <form onSubmit={handleSearch} className="max-w-md mx-auto flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Try another tracking ID..."
                className="flex-1 h-12 pl-4 border border-gray-200 rounded-lg text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <button type="submit" className="px-6 h-12 bg-[#0a192f] text-white rounded-lg text-sm font-medium hover:bg-[#112d57] transition-colors">Track</button>
            </form>
          </motion.div>
        )}

        {shipment && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="space-y-6">
            {/* Hero Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#0a192f] to-[#112d57] text-white px-6 sm:px-8 py-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-blue-300 text-xs font-medium uppercase tracking-wider mb-1">Tracking Number</p>
                    <h1 className="text-2xl sm:text-3xl font-bold font-mono">{shipment.tracking_id}</h1>
                  </div>
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${
                    statusConfig[shipment.status]?.bg || 'bg-gray-100'
                  } ${statusConfig[shipment.status]?.color || 'text-gray-600'}`}>
                    {statusConfig[shipment.status]?.icon}
                    {statusConfig[shipment.status]?.label || shipment.status}
                    {shipment.is_paused ? ' (On Hold)' : ''}
                  </div>
                </div>
              </div>

              {/* Progress Steps */}
              <div className="px-6 sm:px-8 py-6">
                <div className="flex items-center justify-between mb-2">
                  {statusOrder.map((status, i) => {
                    const cfg = statusConfig[status];
                    const isDone = i <= currentStatusIdx;
                    const isCurrent = i === currentStatusIdx;
                    return (
                      <React.Fragment key={status}>
                        <div className="flex flex-col items-center flex-shrink-0">
                          <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: isCurrent ? 1.1 : 1 }}
                            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors ${
                              isDone ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                            } ${isCurrent ? 'ring-4 ring-blue-200' : ''}`}
                          >
                            {cfg?.icon || <Clock size={16} />}
                          </motion.div>
                          <p className={`text-[10px] sm:text-xs mt-2 font-medium text-center max-w-[70px] ${isDone ? 'text-[#0a192f]' : 'text-gray-400'}`}>
                            {cfg?.label}
                          </p>
                        </div>
                        {i < statusOrder.length - 1 && (
                          <div className={`flex-1 h-1 mx-1 sm:mx-2 rounded-full ${i < currentStatusIdx ? 'bg-blue-600' : 'bg-gray-200'}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span>
                    <div className="flex items-center gap-3">
                      {liveEta && <span className="text-blue-600 font-medium">{liveEta}</span>}
                      <span className="font-semibold text-[#0a192f]">{Math.round(liveProgress)}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <motion.div
                      className={`h-2.5 rounded-full ${shipment.is_paused ? 'bg-amber-500' : 'bg-blue-600'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(liveProgress)}%` }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Map */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-[#0a192f] text-sm">Route Map</h3>
                  {shipment.route_distance && (
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><MapPin size={12} /> {formatDistance(shipment.route_distance)}</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {formatDuration(shipment.route_duration || 0)}</span>
                    </div>
                  )}
                </div>
                {MAPBOX_TOKEN && shipment.origin_lat ? (
                  <div ref={mapContainer} style={{ height: '380px' }} />
                ) : (
                  <div className="h-[380px] bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <MapPin size={40} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">{!MAPBOX_TOKEN ? 'Map unavailable' : 'Location data not available'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar Info */}
              <div className="space-y-6">
                {/* Shipment Details */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <h3 className="font-bold text-[#0a192f] text-sm">Shipment Details</h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">From</p>
                        <p className="text-sm font-medium text-[#0a192f]">{shipment.origin}</p>
                        <p className="text-xs text-gray-500">{shipment.sender_name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">To</p>
                        <p className="text-sm font-medium text-[#0a192f]">{shipment.destination}</p>
                        <p className="text-xs text-gray-500">{shipment.receiver_name}</p>
                      </div>
                    </div>
                    <hr className="border-gray-100" />
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-start gap-2">
                        <Box size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase">Cargo Type</p>
                          <p className="font-medium text-[#0a192f]">{shipment.cargo_type}</p>
                        </div>
                      </div>
                      {shipment.weight && (
                        <div className="flex items-start gap-2">
                          <Weight size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase">Weight</p>
                            <p className="font-medium text-[#0a192f]">{shipment.weight}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Calendar size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase">Created</p>
                          <p className="font-medium text-[#0a192f]">{shipment.created_at?.split('T')[0]}</p>
                        </div>
                      </div>
                      {shipment.estimated_delivery && (
                        <div className="flex items-start gap-2">
                          <Clock size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase">Est. Delivery</p>
                            <p className="font-medium text-[#0a192f]">{shipment.estimated_delivery}</p>
                            {liveEta && <p className="text-[10px] text-blue-600 font-medium mt-0.5">{liveEta}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Transport Modes */}
                {shipment.transport_modes && Array.isArray(shipment.transport_modes) && shipment.transport_modes.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100">
                      <h3 className="font-bold text-[#0a192f] text-sm">Transport Chain</h3>
                    </div>
                    <div className="p-5">
                      <div className="space-y-3">
                        {shipment.transport_modes.map((mode: string, i: number) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-center gap-3"
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                              i === 0 ? 'bg-blue-600' : i === shipment.transport_modes.length - 1 ? 'bg-green-600' : 'bg-gray-500'
                            }`}>
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-[#0a192f]">{mode}</p>
                            </div>
                            {i < shipment.transport_modes.length - 1 && (
                              <div className="w-px h-4 bg-gray-200 ml-4 absolute" />
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Courier Info */}
                {courier && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100">
                      <h3 className="font-bold text-[#0a192f] text-sm">Assigned Courier</h3>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold text-lg">
                          {courier.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-[#0a192f]">{courier.name}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                            <span className="flex items-center gap-1"><Truck size={12} /> {courier.vehicle_type}</span>
                            <span className="flex items-center gap-1"><Star size={12} className="text-amber-500" /> {courier.rating}</span>
                          </div>
                        </div>
                      </div>
                      {courier.phone && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                          <Phone size={14} className="text-gray-400" />
                          <span>{courier.phone}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-gray-400 mt-2 font-mono">{courier.courier_id}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tracking History */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <h3 className="font-bold text-[#0a192f] text-sm">Tracking History ({history.length} updates)</h3>
                {showHistory ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </button>
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 space-y-0">
                      {history.map((entry: any, i: number) => {
                        const cfg = statusConfig[entry.status] || statusConfig['pending'];
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex gap-4"
                          >
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                                {cfg.icon}
                              </div>
                              {i < history.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 min-h-[20px]" />}
                            </div>
                            <div className="pb-6 flex-1">
                              <p className="text-sm font-semibold text-[#0a192f] capitalize">{entry.status.replace('-', ' ')}</p>
                              {entry.location && <p className="text-xs text-gray-500 mt-0.5">{entry.location}</p>}
                              {entry.notes && <p className="text-xs text-gray-400 mt-0.5">{entry.notes}</p>}
                              <p className="text-[10px] text-gray-400 mt-1 font-mono">
                                {entry.created_at?.replace('T', ' ').slice(0, 19)}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Route Summary */}
            {shipment.route_summary && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-4 flex items-center gap-3">
                <Navigation size={18} className="text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Route: {shipment.route_summary}</p>
                  {shipment.route_distance && (
                    <p className="text-xs text-blue-600 mt-0.5">
                      {formatDistance(shipment.route_distance)} • Est. {formatDuration(shipment.route_duration || 0)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#0a192f] text-gray-400 text-center py-6 mt-12">
        <p className="text-xs">&copy; 2026 NexusRoute Global Logistics. All rights reserved.</p>
      </footer>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default TrackingDashboard;
