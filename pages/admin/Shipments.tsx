import React, { useState } from 'react';
import {
  Package, Search, Plus, Pause, Play, Eye, MapPin, Edit2,
  CheckCircle, Clock, Truck, RotateCcw, X, ArrowRight, Loader2, Navigation
} from 'lucide-react';
import { Shipment, Courier } from './types';
import * as api from '../../services/api';
import { geocodeAddress, geocodeSearch, getRoute, determineTransportModes, formatDistance, MAPBOX_TOKEN } from '../../utils/mapbox';
import { buildTransportPlans, formatPlanDuration, TransportPlan } from '../../utils/transportPlanner';

interface ShipmentsProps {
  shipments: Shipment[];
  setShipments: React.Dispatch<React.SetStateAction<Shipment[]>>;
  couriers: Courier[];
  onNavigate: (page: string) => void;
  onRefresh: () => void;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  pending: { color: 'bg-gray-100 text-gray-700', icon: <Clock size={12} /> },
  'picked-up': { color: 'bg-purple-100 text-purple-700', icon: <Package size={12} /> },
  'in-transit': { color: 'bg-blue-100 text-blue-700', icon: <Truck size={12} /> },
  'out-for-delivery': { color: 'bg-cyan-100 text-cyan-700', icon: <MapPin size={12} /> },
  delivered: { color: 'bg-green-100 text-green-700', icon: <CheckCircle size={12} /> },
  returned: { color: 'bg-red-100 text-red-700', icon: <RotateCcw size={12} /> },
  paused: { color: 'bg-amber-100 text-amber-700', icon: <Pause size={12} /> },
};

// City autocomplete component
const CityAutocomplete: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  label: string;
}> = ({ value, onChange, placeholder, label }) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Array<{ lng: number; lat: number; place_name: string }>>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { setQuery(value); }, [value]);

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await geocodeSearch(val);
      setSuggestions(results);
      setOpen(results.length > 0);
      setLoading(false);
    }, 300);
  };

  const handleSelect = (place: { place_name: string }) => {
    setQuery(place.place_name);
    onChange(place.place_name);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 pr-8 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none"
        />
        {loading ? (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
        ) : (
          <MapPin size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(s)}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#0a192f] transition-colors flex items-start gap-2 border-b border-gray-50 last:border-0"
            >
              <MapPin size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{s.place_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Shipments: React.FC<ShipmentsProps> = ({ shipments, setShipments, couriers, onNavigate, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  const [form, setForm] = useState({
    sender: '', senderEmail: '',
    receiver: '', receiverEmail: '',
    origin: '', destination: '',
    weight: '', type: 'General', courierId: '',
    estimatedDelivery: '',
  });
  const [creating, setCreating] = useState(false);
  const [routePreview, setRoutePreview] = useState<{ distance: number; duration: number; modes: string[]; summary: string } | null>(null);
  const [transportPlans, setTransportPlans] = useState<TransportPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [pauseModal, setPauseModal] = useState<{ open: boolean; shipment: Shipment | null }>({ open: false, shipment: null });
  const [pauseCategory, setPauseCategory] = useState('');
  const [pauseReason, setPauseReason] = useState('');
  const [editModal, setEditModal] = useState<{ open: boolean; shipment: Shipment | null }>({ open: false, shipment: null });
  const [editForm, setEditForm] = useState({ senderName: '', senderEmail: '', receiverName: '', receiverEmail: '', estimatedDelivery: '', description: '', specialInstructions: '' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.sender || !form.receiver || !form.origin || !form.destination) return;
    setCreating(true);
    try {
      let originCoords: { lng: number; lat: number } | null = null;
      let destCoords: { lng: number; lat: number } | null = null;
      let routeData: any = null;
      let transportModes: string[] | null = null;
      let routeDistance: number | undefined;
      let routeDuration: number | undefined;
      let routeSummary: string | undefined;

      if (MAPBOX_TOKEN) {
        const [oGeo, dGeo] = await Promise.all([geocodeAddress(form.origin), geocodeAddress(form.destination)]);
        originCoords = oGeo;
        destCoords = dGeo;
        if (originCoords && destCoords) {
          const route = await getRoute([originCoords.lng, originCoords.lat], [destCoords.lng, destCoords.lat]);
          if (route) {
            routeData = route.geometry;
            routeDistance = route.distance;
            routeDuration = route.duration;
            routeSummary = route.summary;
            const selPlan = transportPlans.find(p => p.id === selectedPlanId);
            transportModes = selPlan
              ? selPlan.legs.map(l => l.icon + ' ' + l.label)
              : determineTransportModes(route.distance, form.type);
          }
        }
      }

      await api.shipments.create({
        sender_name: form.sender,
        sender_email: form.senderEmail || undefined,
        receiver_name: form.receiver,
        receiver_email: form.receiverEmail || undefined,
        origin: form.origin,
        destination: form.destination,
        origin_lat: originCoords?.lat,
        origin_lng: originCoords?.lng,
        dest_lat: destCoords?.lat,
        dest_lng: destCoords?.lng,
        weight: form.weight ? `${form.weight} kg` : undefined,
        cargo_type: form.type,
        courier_id: form.courierId || undefined,
        estimated_delivery: form.estimatedDelivery || undefined,
        route_data: routeData,
        transport_modes: transportModes,
        route_distance: routeDistance,
        route_duration: routeDuration,
        route_summary: routeSummary,
      } as any);
      setForm({ sender: '', senderEmail: '', receiver: '', receiverEmail: '', origin: '', destination: '', weight: '', type: 'General', courierId: '', estimatedDelivery: '' });
      setRoutePreview(null);
      setTransportPlans([]);
      setSelectedPlanId(null);
      setShowCreate(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to create shipment.');
    } finally {
      setCreating(false);
    }
  };

  const previewRoute = async () => {
    if (!form.origin || !form.destination) return;
    setRoutePreview(null);
    setTransportPlans([]);
    setSelectedPlanId(null);
    setPlanLoading(true);
    try {
      const [oGeo, dGeo] = await Promise.all([geocodeAddress(form.origin), geocodeAddress(form.destination)]);
      if (!oGeo || !dGeo) { console.warn('Could not geocode addresses'); return; }

      // Haversine fallback distance (always works)
      const toRad = (d: number) => (d * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(dGeo.lat - oGeo.lat);
      const dLon = toRad(dGeo.lng - oGeo.lng);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(oGeo.lat)) * Math.cos(toRad(dGeo.lat)) * Math.sin(dLon/2)**2;
      const haversineDist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

      // Try road route for more accurate road distance
      const route = await getRoute([oGeo.lng, oGeo.lat], [dGeo.lng, dGeo.lat]);
      const distKm = (route && route.distance > 0) ? route.distance / 1000 : haversineDist;

      setRoutePreview({
        distance: distKm * 1000,
        duration: route ? route.duration : (distKm / 80) * 3600,
        modes: [],
        summary: route?.summary || '',
      });

      const plans = await buildTransportPlans(form.origin, form.destination, [oGeo.lng, oGeo.lat], [dGeo.lng, dGeo.lat], distKm);
      setTransportPlans(plans);
      const rec = plans.find(p => p.isRecommended) || plans[0];
      if (rec) {
        setSelectedPlanId(rec.id);
        setForm(p => ({ ...p, estimatedDelivery: rec.estimatedDeliveryDate }));
      }
    } catch (err) {
      console.error('Preview route error:', err);
    } finally {
      setPlanLoading(false);
    }
  };

  const handlePauseResume = (shipment: Shipment) => {
    setPauseCategory('');
    setPauseReason('');
    setPauseModal({ open: true, shipment });
  };

  const handleConfirmPause = async () => {
    if (!pauseModal.shipment) return;
    try {
      await api.shipments.togglePause(pauseModal.shipment.trackingId, {
        pause_category: pauseCategory || undefined,
        pause_reason: pauseReason || undefined,
      });
      setPauseModal({ open: false, shipment: null });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to pause/resume shipment.');
    }
  };

  const handleOpenEdit = (shipment: Shipment) => {
    setEditForm({
      senderName: shipment.sender || '',
      senderEmail: (shipment as any).senderEmail || '',
      receiverName: shipment.receiver || '',
      receiverEmail: (shipment as any).receiverEmail || '',
      estimatedDelivery: shipment.estimatedDelivery || '',
      description: (shipment as any).description || '',
      specialInstructions: (shipment as any).specialInstructions || '',
    });
    setEditModal({ open: true, shipment });
  };

  const handleSaveEdit = async () => {
    if (!editModal.shipment) return;
    setSaving(true);
    try {
      await api.shipments.update(editModal.shipment.trackingId, {
        sender_name: editForm.senderName || undefined,
        sender_email: editForm.senderEmail || undefined,
        receiver_name: editForm.receiverName || undefined,
        receiver_email: editForm.receiverEmail || undefined,
        estimated_delivery: editForm.estimatedDelivery || undefined,
        description: editForm.description || undefined,
        special_instructions: editForm.specialInstructions || undefined,
      });
      setEditModal({ open: false, shipment: null });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update shipment.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (shipment: Shipment, newStatus: Shipment['status']) => {
    try {
      await api.shipments.updateStatus(shipment.trackingId, { status: newStatus });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const filtered = shipments.filter(s => {
    const matchesSearch = s.trackingId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.receiver.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0a192f]">Shipment Management</h2>
          <p className="text-sm text-gray-500">{shipments.length} total shipments</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2 self-start sm:self-auto">
          <Plus size={16} /> Create Shipment
        </button>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(['pending', 'picked-up', 'in-transit', 'out-for-delivery', 'delivered', 'paused'] as Shipment['status'][]).map(status => {
          const count = shipments.filter(s => s.status === status).length;
          const conf = statusConfig[status];
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={`p-3 rounded-lg border text-left transition-all ${
                statusFilter === status ? 'border-[#0a192f] bg-[#0a192f]/5 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${conf.color}`}>
                {conf.icon} {status.replace('-', ' ')}
              </span>
              <p className="text-xl font-bold text-[#0a192f] mt-2">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Create Shipment Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-[#0a192f]">Create New Shipment</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Sender Name *</label>
                  <input type="text" value={form.sender} onChange={(e) => setForm(p => ({ ...p, sender: e.target.value }))}
                    placeholder="Company or full name" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Receiver Name *</label>
                  <input type="text" value={form.receiver} onChange={(e) => setForm(p => ({ ...p, receiver: e.target.value }))}
                    placeholder="Company or full name" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Sender Email</label>
                  <input type="email" value={form.senderEmail} onChange={(e) => setForm(p => ({ ...p, senderEmail: e.target.value }))}
                    placeholder="sender@company.com" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Receiver Email</label>
                  <input type="email" value={form.receiverEmail} onChange={(e) => setForm(p => ({ ...p, receiverEmail: e.target.value }))}
                    placeholder="receiver@company.com" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
                </div>
                <CityAutocomplete value={form.origin} onChange={(val) => setForm(p => ({ ...p, origin: val }))} placeholder="Search city, e.g. New York" label="Origin *" />
                <CityAutocomplete value={form.destination} onChange={(val) => setForm(p => ({ ...p, destination: val }))} placeholder="Search city, e.g. Los Angeles" label="Destination *" />
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Weight (kg)</label>
                  <input type="number" value={form.weight} onChange={(e) => setForm(p => ({ ...p, weight: e.target.value }))}
                    placeholder="0.0" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Cargo Type</label>
                  <select value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none bg-white">
                    <option>General</option><option>Electronics</option><option>Pharmaceuticals</option>
                    <option>Perishables</option><option>Auto Parts</option><option>Documents</option>
                    <option>Fragile</option><option>Hazardous</option><option>Live Animals</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Assign Courier (Optional)</label>
                  <select value={form.courierId} onChange={(e) => setForm(p => ({ ...p, courierId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none bg-white">
                    <option value="">Unassigned — Assign Later</option>
                    {couriers.filter(c => c.status === 'active').map(c => (
                      <option key={c.courierId} value={c.courierId}>{c.name} ({c.courierId}) — {c.zone}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Transport Planner */}
              {MAPBOX_TOKEN && form.origin && form.destination && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#0a192f]">
                      <Navigation size={14} className="text-blue-600" /> Transport Planner
                    </div>
                    <button onClick={previewRoute} type="button" disabled={planLoading}
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors flex items-center gap-1 disabled:opacity-50">
                      {planLoading ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
                      {planLoading ? 'Calculating...' : 'Preview Route'}
                    </button>
                  </div>

                  {routePreview && (
                    <p className="text-xs text-gray-500">
                      📏 {formatDistance(routePreview.distance)}
                      {routePreview.summary && <span className="text-gray-400"> · via {routePreview.summary}</span>}
                    </p>
                  )}

                  {transportPlans.length > 0 && (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">🎯 Target delivery date (filters plans)</label>
                        <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
                          className="mt-1 w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-blue-500 outline-none" />
                      </div>

                      <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Select transport plan</p>
                      {transportPlans.map(plan => {
                        const canMeet = !targetDate || plan.estimatedDeliveryDate <= targetDate;
                        const isSelected = selectedPlanId === plan.id;
                        return (
                          <button key={plan.id} type="button"
                            onClick={() => { setSelectedPlanId(plan.id); setForm(p => ({ ...p, estimatedDelivery: plan.estimatedDeliveryDate })); }}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                              isSelected ? 'border-blue-600 bg-blue-50' :
                              !canMeet && targetDate ? 'border-gray-100 opacity-50' :
                              'border-gray-200 hover:border-blue-300 bg-white'
                            }`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{plan.icon}</span>
                                <span className="text-sm font-semibold text-[#0a192f]">{plan.planName}</span>
                                {plan.isRecommended && <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-bold uppercase tracking-wide">★ Recommended</span>}
                                {!canMeet && targetDate && <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-bold">Too slow</span>}
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-bold text-[#0a192f]">{formatPlanDuration(plan.totalDurationHours)}</p>
                                <p className="text-[10px] text-gray-400">Est: {plan.estimatedDeliveryDate}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              {plan.legs.map((leg, i) => (
                                <React.Fragment key={i}>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{leg.icon} {leg.label}</span>
                                  {i < plan.legs.length - 1 && <span className="text-[10px] text-gray-300">→</span>}
                                </React.Fragment>
                              ))}
                            </div>
                          </button>
                        );
                      })}

                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Override delivery date (optional)</label>
                        <input type="date" value={form.estimatedDelivery} onChange={e => setForm(p => ({ ...p, estimatedDelivery: e.target.value }))}
                          className="mt-1 w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-blue-500 outline-none" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowCreate(false); setRoutePreview(null); setTransportPlans([]); setSelectedPlanId(null); setTargetDate(''); }} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleCreate} disabled={!form.sender || !form.receiver || !form.origin || !form.destination || creating}
                  className="flex-1 px-4 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {creating ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : 'Create Shipment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedShipment(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-[#0a192f]">Shipment Details</h3>
              <button onClick={() => setSelectedShipment(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Tracking ID</p>
                <p className="text-xl font-mono font-bold text-[#0a192f]">{selectedShipment.trackingId}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-gray-500">Sender</p><p className="font-medium text-[#0a192f]">{selectedShipment.sender}</p></div>
                <div><p className="text-xs text-gray-500">Receiver</p><p className="font-medium text-[#0a192f]">{selectedShipment.receiver}</p></div>
                <div><p className="text-xs text-gray-500">Origin</p><p className="font-medium text-[#0a192f]">{selectedShipment.origin}</p></div>
                <div><p className="text-xs text-gray-500">Destination</p><p className="font-medium text-[#0a192f]">{selectedShipment.destination}</p></div>
                <div><p className="text-xs text-gray-500">Courier</p><p className="font-medium text-[#0a192f]">{selectedShipment.courierName}</p></div>
                <div><p className="text-xs text-gray-500">Weight</p><p className="font-medium text-[#0a192f]">{selectedShipment.weight}</p></div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">Progress</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full transition-all ${selectedShipment.isPaused ? 'bg-amber-500' : 'bg-blue-600'}`}
                    style={{ width: `${selectedShipment.progress}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{selectedShipment.progress}% complete {selectedShipment.isPaused && '(PAUSED)'}</p>
              </div>
              <div className="flex gap-2 pt-2">
                {selectedShipment.type === 'Live Animals' ? (
                  <div className="w-full space-y-3">
                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wide border-b border-gray-100 pb-1">🐾 Pet Tracking Controls</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { handleUpdateStatus(selectedShipment, 'picked-up'); setSelectedShipment(null); }} className="px-3 py-2 bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg hover:bg-purple-200 transition-colors">Set: Pickup</button>
                      <button onClick={() => { handleUpdateStatus(selectedShipment, 'in-transit'); setSelectedShipment(null); }} className="px-3 py-2 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-200 transition-colors">Set: Transit</button>
                      <button onClick={() => { handleUpdateStatus(selectedShipment, 'out-for-delivery'); setSelectedShipment(null); }} className="px-3 py-2 bg-cyan-100 text-cyan-700 text-xs font-semibold rounded-lg hover:bg-cyan-200 transition-colors">Set: Out for Delivery</button>
                      <button onClick={() => { handleUpdateStatus(selectedShipment, 'delivered'); setSelectedShipment(null); }} className="px-3 py-2 bg-green-100 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-200 transition-colors">Set: Arrived / Delivered</button>
                    </div>
                    <button onClick={() => { handlePauseResume(selectedShipment); setSelectedShipment(null); }}
                      className={`w-full px-4 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
                        selectedShipment.isPaused ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-amber-500 text-white hover:bg-amber-400'
                      }`}>
                      {selectedShipment.isPaused ? <><Play size={14} /> Resume Transport</> : <><Pause size={14} /> Pause for Comfort/Care</>}
                    </button>
                  </div>
                ) : (
                  <>
                    {selectedShipment.status !== 'delivered' && (
                      <button onClick={() => { handlePauseResume(selectedShipment); setSelectedShipment(null); }}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
                          selectedShipment.isPaused ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-amber-500 text-white hover:bg-amber-400'
                        }`}>
                        {selectedShipment.isPaused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
                      </button>
                    )}
                    {selectedShipment.status !== 'delivered' && (
                      <button onClick={() => { handleUpdateStatus(selectedShipment, 'delivered'); setSelectedShipment(null); }}
                        className="flex-1 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 transition-colors flex items-center justify-center gap-2">
                        <CheckCircle size={14} /> Mark Delivered
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by tracking ID, sender, or receiver..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tracking ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Route</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Courier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Progress</th>
                <th className="text-right px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((shipment) => {
                const conf = statusConfig[shipment.status];
                return (
                  <tr key={shipment.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 sm:px-6 py-4">
                      <p className="text-sm font-mono font-medium text-[#0a192f]">{shipment.trackingId}</p>
                      <p className="text-xs text-gray-400">{shipment.type} · {shipment.weight}</p>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <span className="truncate max-w-[100px]">{shipment.origin}</span>
                        <ArrowRight size={12} className="text-gray-400 flex-shrink-0" />
                        <span className="truncate max-w-[100px]">{shipment.destination}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <p className="text-sm text-gray-600">{shipment.courierName}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full capitalize ${conf.color}`}>
                        {conf.icon} {shipment.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${shipment.isPaused ? 'bg-amber-500' : 'bg-blue-600'}`}
                            style={{ width: `${shipment.progress}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-8">{shipment.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setSelectedShipment(shipment)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-[#0a192f]" title="View Details">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => handleOpenEdit(shipment)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600" title="Edit Shipment">
                          <Edit2 size={16} />
                        </button>
                        {shipment.status !== 'delivered' && (
                          <button onClick={() => handlePauseResume(shipment)}
                            className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${shipment.isPaused ? 'text-green-600' : 'text-amber-500'}`}
                            title={shipment.isPaused ? 'Resume' : 'Pause'}>
                            {shipment.isPaused ? <Play size={16} /> : <Pause size={16} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">No shipments found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Edit Shipment Modal ──────────────────────────────────── */}
      {editModal.open && editModal.shipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditModal({ open: false, shipment: null })}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-[#0a192f]">Edit Shipment</h3>
                <p className="text-xs text-gray-400 font-mono">{editModal.shipment.trackingId}</p>
              </div>
              <button onClick={() => setEditModal({ open: false, shipment: null })} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Sender Name</label>
                  <input type="text" value={editForm.senderName} onChange={e => setEditForm(p => ({ ...p, senderName: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Sender Email</label>
                  <input type="email" value={editForm.senderEmail} onChange={e => setEditForm(p => ({ ...p, senderEmail: e.target.value }))}
                    placeholder="sender@example.com" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Receiver Name</label>
                  <input type="text" value={editForm.receiverName} onChange={e => setEditForm(p => ({ ...p, receiverName: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Receiver Email</label>
                  <input type="email" value={editForm.receiverEmail} onChange={e => setEditForm(p => ({ ...p, receiverEmail: e.target.value }))}
                    placeholder="receiver@example.com" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Estimated Delivery Date</label>
                <input type="date" value={editForm.estimatedDelivery} onChange={e => setEditForm(p => ({ ...p, estimatedDelivery: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Description</label>
                <input type="text" value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Cargo description..." className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Special Instructions</label>
                <textarea value={editForm.specialInstructions} onChange={e => setEditForm(p => ({ ...p, specialInstructions: e.target.value }))}
                  rows={2} placeholder="Handle with care, temperature-sensitive, etc..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditModal({ open: false, shipment: null })}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleSaveEdit} disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : '💾 Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Pause / Resume Modal ─────────────────────────────────── */}
      {pauseModal.open && pauseModal.shipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPauseModal({ open: false, shipment: null })}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-[#0a192f]">
                {pauseModal.shipment.isPaused ? '▶ Resume Shipment' : '⏸ Pause Shipment'}
              </h3>
              <button onClick={() => setPauseModal({ open: false, shipment: null })} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 px-4 py-3 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Shipment</p>
                  <p className="font-mono font-bold text-[#0a192f]">{pauseModal.shipment.trackingId}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{pauseModal.shipment.origin}</p>
                  <p className="text-xs text-gray-400">→ {pauseModal.shipment.destination}</p>
                </div>
              </div>

              {!pauseModal.shipment.isPaused && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Hold Category *</label>
                    <select value={pauseCategory} onChange={e => setPauseCategory(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none bg-white">
                      <option value="">Select a category...</option>
                      {pauseModal.shipment.type === 'Live Animals' ? (
                        ['Veterinary Check', 'Feeding & Walking', 'Rest Period', 'Temperature Control', 'Document Issue', 'Other'].map(c => (
                          <option key={c}>{c}</option>
                        ))
                      ) : (
                        ['Customs Hold', 'Weather Delay', 'Port Congestion', 'Document Issue', 'Transit Change', 'Recipient Unavailable', 'Security Check', 'Other'].map(c => (
                          <option key={c}>{c}</option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Reason / Details</label>
                    <textarea value={pauseReason} onChange={e => setPauseReason(e.target.value)} rows={3}
                      placeholder="Brief explanation — this will be included in the customer email..."
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none resize-none" />
                  </div>
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-lg">
                    <span className="text-amber-500 mt-0.5">⚡</span>
                    <p className="text-xs text-amber-700">An email notification will be sent <strong>directly to the customer</strong> with the hold reason as soon as you confirm.</p>
                  </div>
                </>
              )}

              {pauseModal.shipment.isPaused && (
                <div className="flex items-start gap-2 bg-green-50 border border-green-200 px-3 py-2.5 rounded-lg">
                  <span className="text-green-500 mt-0.5">✅</span>
                  <p className="text-xs text-green-700">Resuming will <strong>automatically email the customer</strong> that their shipment is back in transit.</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setPauseModal({ open: false, shipment: null })}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleConfirmPause}
                  disabled={!pauseModal.shipment.isPaused && !pauseCategory}
                  className={`flex-1 px-4 py-2.5 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    pauseModal.shipment.isPaused ? 'bg-green-600 hover:bg-green-500' : 'bg-amber-500 hover:bg-amber-400'
                  }`}>
                  {pauseModal.shipment.isPaused
                    ? <><Play size={14} /> Resume & Notify Customer</>
                    : <><Pause size={14} /> Pause & Notify Customer</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shipments;
