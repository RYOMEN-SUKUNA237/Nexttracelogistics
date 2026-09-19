import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, MapPin, Clock, CheckCircle, Truck, Pause, RotateCcw,
  ArrowLeft, Phone, User, Star, ChevronDown, ChevronUp, Box,
  Calendar, Weight, Shield, Navigation, Loader2, AlertCircle, Search, Mail, BellRing
} from 'lucide-react';
import { MAPBOX_TOKEN, formatDistance, formatDuration } from '../utils/mapbox';
import { liveState, formatHours } from '../utils/shipmentTimeline';
import LiveShipmentMap from '../components/shipment/LiveShipmentMap';
import JourneyTimeline from '../components/shipment/JourneyTimeline';

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
  const [now, setNow] = useState(() => Date.now());
  const [subEmail, setSubEmail] = useState('');
  const [subName, setSubName] = useState('');
  const [subLoading, setSubLoading] = useState(false);
  const [subMessage, setSubMessage] = useState('');

  const fetchTracking = async (id: string, quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError('');
      setData(null);
    }
    try {
      const res = await fetch(`/api/shipments/${id}/track`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Shipment not found.');
      setData(json);
    } catch (err: any) {
      if (!quiet) setError(err.message || 'Could not find shipment.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    if (trackingId) fetchTracking(trackingId);
  }, [trackingId]);

  // Live clock for the vehicle position, and a periodic refresh for status updates.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!trackingId) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') fetchTracking(trackingId, true);
    }, 60000);
    return () => clearInterval(t);
  }, [trackingId]);

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

  const live = shipment ? liveState(shipment, now) : null;
  const finished = shipment?.status === 'delivered' || shipment?.status === 'returned';
  const started = !!shipment?.departed_at && shipment?.status !== 'pending';
  const liveProgress = !shipment ? 0 : finished ? 100 : live ? live.progress : Number(shipment.computed_progress ?? shipment.progress ?? 0);
  const remainingHours = live ? Math.max(0, live.tl.totalHours - live.elapsed) : 0;
  const pet = shipment?.pet_details && Object.keys(shipment.pet_details).length ? shipment.pet_details : null;
  const heldAtAirport = !!shipment?.is_paused && shipment?.pause_category === 'Transit Stop';

  // While on hold, the step tracker shows the stage the shipment was in.
  const stepStatus = shipment?.status === 'paused' ? (shipment.status_before_pause || (started ? 'in-transit' : 'pending')) : shipment?.status;
  const currentStatusIdx = shipment ? statusOrder.indexOf(stepStatus) : -1;

  let etaText = '';
  if (shipment) {
    if (finished) etaText = shipment.status === 'delivered' ? 'Delivered' : 'Returned';
    else if (!started) etaText = 'Awaiting pickup';
    else if (shipment.is_paused) etaText = `On hold · ${formatHours(remainingHours)} to go after release`;
    else etaText = remainingHours > 0 ? `${formatHours(remainingHours)} remaining` : 'Arriving now';
  }

  const arrivalText = (() => {
    if (!shipment) return '';
    if (shipment.status === 'delivered' && shipment.actual_delivery) {
      return new Date(`${String(shipment.actual_delivery).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' });
    }
    let ms = new Date(String(shipment.estimated_delivery)).getTime();
    if (isNaN(ms)) return String(shipment.estimated_delivery || '—');
    if (shipment.is_paused && shipment.paused_at) ms += Math.max(0, now - new Date(shipment.paused_at).getTime());
    return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  })();

  // What is happening right now, in words.
  let stage: { icon: string; title: string; detail: string; tone: 'blue' | 'sky' | 'amber' | 'green' | 'gray' } | null = null;
  if (shipment && live) {
    const st = live.state;
    if (finished) stage = { icon: shipment.status === 'delivered' ? '✅' : '↩️', title: shipment.status === 'delivered' ? 'Delivered' : 'Returned to sender', detail: shipment.destination, tone: 'green' };
    else if (!started) stage = { icon: '📋', title: 'Order confirmed — awaiting pickup', detail: `Planned journey time: ${formatHours(live.tl.totalHours)}`, tone: 'gray' };
    else if (heldAtAirport) stage = { icon: '✈️', title: `Cargo held at ${st.name || 'the airport'}`, detail: shipment.pause_reason || 'Airport processing is under way. Your shipment will continue shortly.', tone: 'sky' };
    else if (shipment.is_paused) stage = { icon: '⏸', title: `On hold${shipment.pause_category ? ` — ${shipment.pause_category}` : ''}`, detail: shipment.pause_reason || 'Our team is working to release your shipment as soon as possible.', tone: 'amber' };
    else if (st.kind === 'move') {
      const verb = st.mode === 'air' ? 'In flight' : st.mode === 'sea' ? 'At sea' : 'On the road';
      stage = { icon: st.icon, title: `${verb}: ${st.label}`, detail: `${st.segment?.from.name} → ${st.segment?.to.name} · arrives there in ${formatHours(st.remainingInPhaseHours)}`, tone: 'blue' };
    } else {
      stage = { icon: st.icon, title: st.label, detail: `${st.name} · next leg in ${formatHours(st.remainingInPhaseHours)}`, tone: st.role === 'transit' ? 'sky' : 'blue' };
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#0a192f] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package size={18} />
            </div>
            <span className="text-lg font-bold tracking-tight">Next Trace Logistics</span>
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
                  {heldAtAirport ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-sky-500 text-white shadow-lg shadow-sky-500/20">
                      ✈️ Held at transit airport
                    </div>
                  ) : (
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${
                      statusConfig[shipment.status]?.bg || 'bg-gray-100'
                    } ${statusConfig[shipment.status]?.color || 'text-gray-600'}`}>
                      {statusConfig[shipment.status]?.icon}
                      {statusConfig[shipment.status]?.label || shipment.status}
                    </div>
                  )}
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
                      {etaText && <span className="text-blue-600 font-medium">{etaText}</span>}
                      <span className="font-semibold text-[#0a192f]">{Math.round(liveProgress)}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <motion.div
                      className={`h-2.5 rounded-full ${shipment.is_paused ? (heldAtAirport ? 'bg-sky-500' : 'bg-amber-500') : finished ? 'bg-green-500' : 'bg-blue-600'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, liveProgress)}%` }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* What is happening now */}
            {stage && (
              <div className={`rounded-xl border p-4 sm:p-5 flex items-start sm:items-center gap-4 shadow-sm ${
                stage.tone === 'sky' ? 'bg-sky-50 border-sky-200'
                  : stage.tone === 'amber' ? 'bg-amber-50 border-amber-200'
                  : stage.tone === 'green' ? 'bg-green-50 border-green-200'
                  : stage.tone === 'gray' ? 'bg-gray-50 border-gray-200'
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="w-11 h-11 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0 text-xl">{stage.icon}</div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Current stage</p>
                  <h4 className="text-sm sm:text-base font-bold text-[#0a192f]">{stage.title}</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">{stage.detail}</p>
                </div>
              </div>
            )}

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Map */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                  <h3 className="font-bold text-[#0a192f] text-sm">Live Route Map</h3>
                  {shipment.route_distance && (
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><MapPin size={12} /> {formatDistance(Number(shipment.route_distance))}</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {live ? formatHours(live.tl.totalHours) : formatDuration(Number(shipment.route_duration) || 0)}</span>
                    </div>
                  )}
                </div>
                {MAPBOX_TOKEN && live ? (
                  <LiveShipmentMap shipment={shipment} nowMs={now} />
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
                            <p className="text-[10px] text-gray-400 uppercase">Est. Arrival</p>
                            <p className="font-medium text-[#0a192f]">{arrivalText}</p>
                            {etaText && <p className="text-[10px] text-blue-600 font-medium mt-0.5">{etaText}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Live animal */}
                {pet && (
                  <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-amber-100 bg-amber-50/60">
                      <h3 className="font-bold text-[#0a192f] text-sm">🐾 Animal on board</h3>
                    </div>
                    <div className="p-5 space-y-3">
                      <p className="text-base font-semibold text-[#0a192f]">
                        {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}
                      </p>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {[
                          ['Age', pet.age],
                          ['Gender', pet.gender],
                          ['Colour', pet.color],
                          ['Weight', pet.weight ? `${pet.weight} kg` : ''],
                          ['Vaccinations', pet.vaccinationStatus ? String(pet.vaccinationStatus).replace(/-/g, ' ') : ''],
                          ['Crate', pet.crateType ? String(pet.crateType).replace(/-/g, ' ') : ''],
                          ['Temperature', pet.tempMin || pet.tempMax ? `${pet.tempMin || '?'}–${pet.tempMax || '?'} °C` : ''],
                        ].filter(([, v]) => v).map(([k, v]) => (
                          <div key={k as string}>
                            <dt className="text-[10px] text-gray-400 uppercase">{k}</dt>
                            <dd className="font-medium text-[#0a192f] capitalize">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      {pet.feedingSchedule && (
                        <p className="text-xs text-gray-600"><span className="font-semibold text-gray-700">Feeding:</span> {pet.feedingSchedule}</p>
                      )}
                      {pet.specialCare && (
                        <p className="text-xs text-gray-600"><span className="font-semibold text-gray-700">Special care:</span> {pet.specialCare}</p>
                      )}
                      <p className="text-[10px] text-gray-400">Our handlers check on the animal at every hub. Care stops appear as holds on this page.</p>
                    </div>
                  </div>
                )}

                {/* Journey stages */}
                {live && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="font-bold text-[#0a192f] text-sm">Journey</h3>
                      {shipment.route_summary && <span className="text-[10px] text-gray-500">{shipment.route_summary}</span>}
                    </div>
                    <div className="p-5 max-h-[420px] overflow-y-auto">
                      <JourneyTimeline live={live} paused={!!shipment.is_paused} started={started && !finished ? true : finished} nowMs={now} />
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
                        const when = new Date(entry.created_at);
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
                              <p className="text-sm font-semibold text-[#0a192f]">{cfg.label}</p>
                              {entry.location && <p className="text-xs text-gray-500 mt-0.5">{entry.location}</p>}
                              {entry.notes && <p className="text-xs text-gray-600 mt-0.5">{entry.notes}</p>}
                              <p className="text-[10px] text-gray-400 mt-1 font-mono">
                                {isNaN(when.getTime()) ? entry.created_at : when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
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

            {/* Email Subscription */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 sm:px-8 py-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BellRing size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#0a192f] text-sm">Get Email Updates</h3>
                    <p className="text-xs text-gray-500">Receive notifications when this shipment's status changes</p>
                  </div>
                </div>

                {subMessage ? (
                  <div className={`p-4 rounded-lg text-sm font-medium ${
                    subMessage.includes('Success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {subMessage}
                  </div>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!subEmail || !subEmail.includes('@')) return;
                    setSubLoading(true);
                    try {
                      const { emails } = await import('../services/api');
                      const res = await emails.subscribe({
                        tracking_id: shipment.tracking_id,
                        email: subEmail,
                        name: subName || undefined,
                      });
                      if (res.error) throw new Error(res.error);
                      setSubMessage('Success! You\'ll receive email updates for this shipment.');
                    } catch (err: any) {
                      setSubMessage(err.message || 'Failed to subscribe.');
                    } finally {
                      setSubLoading(false);
                    }
                  }} className="space-y-3">
                    <input
                      type="text"
                      value={subName}
                      onChange={(e) => setSubName(e.target.value)}
                      placeholder="Your name (optional)"
                      className="w-full h-10 px-4 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={subEmail}
                        onChange={(e) => setSubEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="flex-1 h-10 px-4 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <button
                        type="submit"
                        disabled={subLoading || !subEmail.includes('@')}
                        className="px-5 h-10 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {subLoading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                        Subscribe
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400">We'll only send updates about this specific shipment.</p>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#0a192f] text-gray-400 text-center py-6 mt-12">
        <p className="text-xs">&copy; 2026 Next Trace Logistics. All rights reserved.</p>
      </footer>

    </div>
  );
};

export default TrackingDashboard;
