import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Navigation, Trash2, AlertTriangle } from 'lucide-react';
import * as api from '../../../services/api';
import { Courier, PetDetails } from '../types';
import { MAPBOX_TOKEN, geocodeAddress } from '../../../utils/mapbox';
import { PlanSegment, PlanStop, formatHours, unwrapLine } from '../../../utils/shipmentTimeline';
import PlaceInput, { Place } from './PlaceInput';
import useEscapeKey from './useEscapeKey';
import AirportPicker, { Airport } from './AirportPicker';
import RoutePreviewMap from './RoutePreviewMap';

interface PlanLeg { mode: string; icon: string; label: string; from: string; to: string; distanceKm: number; durationHours: number; speedKmh: number }
interface Plan {
  id: 'road' | 'air' | 'sea';
  planName: string;
  icon: string;
  legs: PlanLeg[];
  segments: PlanSegment[];
  transitStops: PlanStop[];
  totalDistanceKm: number;
  totalDurationHours: number;
  estimatedDeliveryDate: string;
  isRecommended?: boolean;
  approximate?: boolean;
}

interface Props {
  open: boolean;
  couriers: Courier[];
  onClose: () => void;
  onCreated: (trackingId: string) => void;
}

const CARGO_TYPES = ['General', 'Electronics', 'Pharmaceuticals', 'Perishables', 'Auto Parts', 'Documents', 'Fragile', 'Hazardous', 'Live Animals'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyForm = {
  customerId: '',
  sender: '', senderEmail: '', senderPhone: '',
  receiver: '', receiverEmail: '', receiverPhone: '',
  weight: '', type: 'General', courierId: '',
  description: '', specialInstructions: '',
};

const emptyPet: PetDetails = {
  species: '', breed: '', gender: '', age: '', color: '', weight: '', microchipId: '',
  vaccinationStatus: 'up-to-date', medications: '', vetName: '', vetPhone: '', vetClinic: '',
  crateType: 'standard', tempMin: '', tempMax: '', feedingSchedule: '', specialCare: '', ownerConsent: false,
};

const input = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none';
const labelCls = 'block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide';

const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const CreateShipmentModal: React.FC<Props> = ({ open, couriers, onClose, onCreated }) => {
  const [form, setForm] = useState(emptyForm);
  const [pet, setPet] = useState<PetDetails>(emptyPet);
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<Plan['id'] | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState('');
  const [roadNetwork, setRoadNetwork] = useState(true);
  const [vias, setVias] = useState<Airport[]>([]);
  const [showStopPicker, setShowStopPicker] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [fixedArrival, setFixedArrival] = useState(false);
  const [arrival, setArrival] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    api.customers.list({ limit: 200 }).then((r) => setCustomers(r.customers || [])).catch(() => setCustomers([]));
  }, [open]);

  const reset = () => {
    setForm(emptyForm); setPet(emptyPet);
    setOriginText(''); setDestText(''); setOrigin(null); setDestination(null);
    setPlans([]); setPlanId(null); setPlanError(''); setVias([]); setShowStopPicker(false);
    setTargetDate(''); setFixedArrival(false); setArrival(''); setError('');
  };

  const close = () => { reset(); onClose(); };

  const set = (k: keyof typeof emptyForm, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const setP = (k: keyof PetDetails, v: string | boolean) => setPet((p) => ({ ...p, [k]: v }));

  // Changing the route invalidates the plans.
  const invalidate = () => { setPlans([]); setPlanId(null); setVias([]); };

  const resolve = async (place: Place | null, text: string): Promise<Place | null> => {
    if (place && place.name === text) return place;
    if (!text.trim()) return null;
    const g = await geocodeAddress(text.trim());
    return g ? { name: g.place_name, lat: g.lat, lng: g.lng } : null;
  };

  const plan = async (viaList: Airport[] = vias) => {
    setPlanning(true);
    setPlanError('');
    try {
      const [o, d] = await Promise.all([resolve(origin, originText), resolve(destination, destText)]);
      if (!o || !d) throw new Error('Could not locate the origin or destination. Pick them from the suggestions.');
      setOrigin(o); setOriginText(o.name);
      setDestination(d); setDestText(d.name);
      const res = await api.routing.plans({
        origin: o, destination: d, cargoType: form.type, mapboxToken: MAPBOX_TOKEN || undefined,
        vias: viaList.map((v) => ({ name: v.name, lat: v.lat, lng: v.lng })),
      });
      const list: Plan[] = res.plans || [];
      setRoadNetwork(!!res.roadNetwork);
      setPlans(list);
      if (list.length === 0) throw new Error('No transport option found between these places.');
      setPlanId((prev) => (prev && list.some((p) => p.id === prev) ? prev : (list.find((p) => p.isRecommended) || list[0]).id));
    } catch (e: any) {
      setPlanError(e.message || 'Route planning failed.');
    } finally {
      setPlanning(false);
    }
  };

  const selected = plans.find((p) => p.id === planId) || null;

  const addVia = (a: Airport) => {
    if (vias.some((v) => v.name === a.name)) return;
    const next = [...vias, a];
    setVias(next);
    setShowStopPicker(false);
    plan(next);
  };
  const removeVia = (i: number) => {
    const next = vias.filter((_, k) => k !== i);
    setVias(next);
    plan(next);
  };

  const planDurationMs = selected ? selected.totalDurationHours * 3.6e6 : 0;
  const arrivalMs = arrival ? new Date(arrival).getTime() : NaN;
  const arrivalWarning = fixedArrival && selected && !isNaN(arrivalMs) && arrivalMs < Date.now() + planDurationMs
    ? `This is ${formatHours((Date.now() + planDurationMs - arrivalMs) / 3.6e6)} earlier than the ${selected.planName.toLowerCase()} can realistically arrive — vehicles will be sped up to fit.`
    : '';

  const isAnimal = form.type === 'Live Animals';
  const problems = useMemo(() => {
    const list: string[] = [];
    if (!form.sender.trim()) list.push('Sender name is required.');
    if (!form.receiver.trim()) list.push('Receiver name is required.');
    if (form.senderEmail && !EMAIL_RE.test(form.senderEmail)) list.push('Sender email is not valid.');
    if (form.receiverEmail && !EMAIL_RE.test(form.receiverEmail)) list.push('Receiver email is not valid.');
    if (form.weight && !(Number(form.weight) > 0)) list.push('Weight must be a positive number.');
    if (MAPBOX_TOKEN && !selected) list.push('Plan the route and choose a transport option.');
    if (!MAPBOX_TOKEN && (!originText.trim() || !destText.trim())) list.push('Origin and destination are required.');
    if (fixedArrival && (isNaN(arrivalMs) || arrivalMs <= Date.now())) list.push('The fixed arrival time must be in the future.');
    if (isAnimal && !pet.species) list.push('Select the animal species.');
    if (isAnimal && !pet.ownerConsent) list.push('Confirm the owner’s consent for live animal transport.');
    return list;
  }, [form, selected, originText, destText, fixedArrival, arrivalMs, isAnimal, pet]);

  const create = async () => {
    if (problems.length) { setError(problems[0]); return; }
    setCreating(true);
    setError('');
    try {
      const coords: [number, number][] = [];
      selected?.segments.forEach((s) => coords.push(...s.coordinates));
      const res = await api.shipments.create({
        customer_id: form.customerId || undefined,
        sender_name: form.sender.trim(),
        sender_email: form.senderEmail.trim() || undefined,
        sender_phone: form.senderPhone.trim() || undefined,
        receiver_name: form.receiver.trim(),
        receiver_email: form.receiverEmail.trim() || undefined,
        receiver_phone: form.receiverPhone.trim() || undefined,
        origin: origin?.name || originText.trim(),
        destination: destination?.name || destText.trim(),
        origin_lat: origin?.lat, origin_lng: origin?.lng,
        dest_lat: destination?.lat, dest_lng: destination?.lng,
        weight: form.weight ? `${form.weight} kg` : undefined,
        cargo_type: form.type,
        description: form.description.trim() || undefined,
        special_instructions: form.specialInstructions.trim() || undefined,
        courier_id: form.courierId || undefined,
        estimated_delivery: fixedArrival ? new Date(arrival).toISOString() : undefined,
        eta_overridden: fixedArrival,
        ...(selected ? {
          route_data: { type: 'LineString', coordinates: unwrapLine(coords) },
          transport_modes: selected.legs.map((l) => `${l.icon} ${l.label}`),
          route_distance: selected.totalDistanceKm * 1000,
          route_duration: Math.round(selected.totalDurationHours * 3600),
          route_summary: selected.planName,
          route_mode: selected.id,
          multi_modal_segments: selected.segments,
          multi_modal_stops: selected.transitStops,
          scheduled_transit_stops: selected.id === 'air' ? vias.map((v) => ({ name: v.name, lat: v.lat, lng: v.lng })) : [],
        } : {}),
        pet_details: isAnimal ? pet : undefined,
      });
      const id = res.shipment?.tracking_id;
      reset();
      onCreated(id);
    } catch (e: any) {
      setError(e.message || 'Failed to create the shipment.');
    } finally {
      setCreating(false);
    }
  };

  useEscapeKey(close, open);

  if (!open) return null;

  const activeCouriers = couriers.filter((c) => c.status === 'active' || c.status === 'on-delivery');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-lg font-bold text-[#0a192f]">Create New Shipment</h3>
          <button onClick={close} className="p-1 hover:bg-gray-100 rounded-lg" aria-label="Close"><X size={20} className="text-gray-500" /></button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Parties */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xs font-bold text-[#0a192f] uppercase tracking-wide">Sender & receiver</h4>
              {customers.length > 0 && (
                <select value={form.customerId}
                  onChange={(e) => {
                    const c = customers.find((x) => x.customer_id === e.target.value);
                    setForm((p) => ({
                      ...p,
                      customerId: e.target.value,
                      ...(c ? { sender: c.company_name || c.contact_name, senderEmail: c.email || '', senderPhone: c.phone || '' } : {}),
                    }));
                  }}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white max-w-[55%]">
                  <option value="">Link a customer (optional)…</option>
                  {customers.map((c) => <option key={c.customer_id} value={c.customer_id}>{c.company_name || c.contact_name} ({c.customer_id})</option>)}
                </select>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Sender name *</label><input className={input} value={form.sender} onChange={(e) => set('sender', e.target.value)} placeholder="Company or full name" /></div>
              <div><label className={labelCls}>Receiver name *</label><input className={input} value={form.receiver} onChange={(e) => set('receiver', e.target.value)} placeholder="Company or full name" /></div>
              <div><label className={labelCls}>Sender email</label><input type="email" className={input} value={form.senderEmail} onChange={(e) => set('senderEmail', e.target.value)} placeholder="sender@company.com" /></div>
              <div><label className={labelCls}>Receiver email</label><input type="email" className={input} value={form.receiverEmail} onChange={(e) => set('receiverEmail', e.target.value)} placeholder="receiver@company.com" /></div>
              <div><label className={labelCls}>Sender phone</label><input type="tel" className={input} value={form.senderPhone} onChange={(e) => set('senderPhone', e.target.value)} /></div>
              <div><label className={labelCls}>Receiver phone</label><input type="tel" className={input} value={form.receiverPhone} onChange={(e) => set('receiverPhone', e.target.value)} /></div>
            </div>
          </section>

          {/* Cargo */}
          <section className="space-y-3">
            <h4 className="text-xs font-bold text-[#0a192f] uppercase tracking-wide">Cargo</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={labelCls}>Weight (kg)</label><input type="number" min="0" step="0.1" className={input} value={form.weight} onChange={(e) => set('weight', e.target.value)} /></div>
              <div>
                <label className={labelCls}>Cargo type</label>
                <select className={`${input} bg-white`} value={form.type} onChange={(e) => { set('type', e.target.value); if (plans.length) invalidate(); }}>
                  {CARGO_TYPES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Courier</label>
                <select className={`${input} bg-white`} value={form.courierId} onChange={(e) => set('courierId', e.target.value)}>
                  <option value="">Unassigned — assign later</option>
                  {activeCouriers.map((c) => <option key={c.courierId} value={c.courierId}>{c.name} ({c.courierId}){c.zone ? ` — ${c.zone}` : ''}{c.status === 'on-delivery' ? ' · busy' : ''}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2"><label className={labelCls}>Description</label><input className={input} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What is being shipped" /></div>
              <div><label className={labelCls}>Special instructions</label><input className={input} value={form.specialInstructions} onChange={(e) => set('specialInstructions', e.target.value)} placeholder="Fragile, keep upright…" /></div>
            </div>
            <p className="text-[11px] text-gray-400">{form.courierId ? 'With a courier the shipment is picked up and starts moving as soon as it is created.' : 'Without a courier the shipment waits as "pending"; the journey starts when a courier is assigned or it is marked picked up.'}</p>
          </section>

          {isAnimal && (
            <section className="bg-amber-50/50 border border-amber-200 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-bold text-[#0a192f] uppercase tracking-wide">🐾 Live animal details</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Species *</label>
                  <select className={`${input} bg-white`} value={pet.species} onChange={(e) => setP('species', e.target.value)}>
                    <option value="">Select…</option>
                    {['Dog', 'Cat', 'Bird', 'Rabbit', 'Reptile', 'Fish', 'Horse', 'Livestock', 'Exotic', 'Other'].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Breed</label><input className={input} value={pet.breed} onChange={(e) => setP('breed', e.target.value)} /></div>
                <div>
                  <label className={labelCls}>Gender</label>
                  <select className={`${input} bg-white`} value={pet.gender} onChange={(e) => setP('gender', e.target.value)}>
                    <option value="">Select…</option><option>Male</option><option>Female</option><option>Unknown</option>
                  </select>
                </div>
                <div><label className={labelCls}>Age</label><input className={input} value={pet.age} onChange={(e) => setP('age', e.target.value)} placeholder="e.g. 3 years" /></div>
                <div><label className={labelCls}>Colour / markings</label><input className={input} value={pet.color} onChange={(e) => setP('color', e.target.value)} /></div>
                <div><label className={labelCls}>Animal weight (kg)</label><input type="number" min="0" className={input} value={pet.weight} onChange={(e) => setP('weight', e.target.value)} /></div>
                <div>
                  <label className={labelCls}>Vaccination</label>
                  <select className={`${input} bg-white`} value={pet.vaccinationStatus} onChange={(e) => setP('vaccinationStatus', e.target.value)}>
                    <option value="up-to-date">Up to date</option><option value="partial">Partially vaccinated</option>
                    <option value="not-vaccinated">Not vaccinated</option><option value="unknown">Unknown</option>
                  </select>
                </div>
                <div><label className={labelCls}>Microchip ID</label><input className={input} value={pet.microchipId} onChange={(e) => setP('microchipId', e.target.value)} /></div>
                <div><label className={labelCls}>Medications</label><input className={input} value={pet.medications} onChange={(e) => setP('medications', e.target.value)} /></div>
                <div><label className={labelCls}>Vet name</label><input className={input} value={pet.vetName} onChange={(e) => setP('vetName', e.target.value)} /></div>
                <div><label className={labelCls}>Vet phone</label><input className={input} value={pet.vetPhone} onChange={(e) => setP('vetPhone', e.target.value)} /></div>
                <div><label className={labelCls}>Clinic</label><input className={input} value={pet.vetClinic} onChange={(e) => setP('vetClinic', e.target.value)} /></div>
                <div>
                  <label className={labelCls}>Crate type</label>
                  <select className={`${input} bg-white`} value={pet.crateType} onChange={(e) => setP('crateType', e.target.value)}>
                    <option value="standard">Standard crate</option><option value="airline-approved">Airline approved</option>
                    <option value="soft-sided">Soft-sided carrier</option><option value="heavy-duty">Heavy duty</option>
                    <option value="custom">Custom enclosure</option><option value="open-transport">Open transport (livestock)</option>
                  </select>
                </div>
                <div><label className={labelCls}>Min temp (°C)</label><input type="number" className={input} value={pet.tempMin} onChange={(e) => setP('tempMin', e.target.value)} /></div>
                <div><label className={labelCls}>Max temp (°C)</label><input type="number" className={input} value={pet.tempMax} onChange={(e) => setP('tempMax', e.target.value)} /></div>
                <div className="col-span-2 sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Feeding schedule</label><input className={input} value={pet.feedingSchedule} onChange={(e) => setP('feedingSchedule', e.target.value)} /></div>
                  <div><label className={labelCls}>Special care</label><input className={input} value={pet.specialCare} onChange={(e) => setP('specialCare', e.target.value)} /></div>
                </div>
              </div>
              <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-600">
                <input type="checkbox" checked={!!pet.ownerConsent} onChange={(e) => setP('ownerConsent', e.target.checked)} className="mt-0.5" />
                The owner has given written consent, health certificates are on file and a licensed vet cleared the animal for travel within the last 10 days. *
              </label>
            </section>
          )}

          {/* Route */}
          <section className="space-y-3">
            <h4 className="text-xs font-bold text-[#0a192f] uppercase tracking-wide">Route & transport</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PlaceInput label="Origin *" placeholder="Search address or city" value={origin} text={originText}
                onTextChange={(t) => { setOriginText(t); if (origin && t !== origin.name) { setOrigin(null); invalidate(); } }}
                onSelect={(p) => { setOrigin(p); setOriginText(p.name); invalidate(); }} />
              <PlaceInput label="Destination *" placeholder="Search address or city" value={destination} text={destText}
                onTextChange={(t) => { setDestText(t); if (destination && t !== destination.name) { setDestination(null); invalidate(); } }}
                onSelect={(p) => { setDestination(p); setDestText(p.name); invalidate(); }} />
            </div>

            {!MAPBOX_TOKEN && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> Map services are not configured (VITE_MAPBOX_TOKEN). You can still create the shipment, but it will have no route or live tracking.
              </p>
            )}

            {MAPBOX_TOKEN && (
              <button type="button" onClick={() => plan()} disabled={planning || !originText.trim() || !destText.trim()}
                className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 flex items-center gap-2 disabled:opacity-50">
                {planning ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                {planning ? 'Planning route…' : plans.length ? 'Re-plan route' : 'Plan route'}
              </button>
            )}
            {planError && <p className="text-xs text-red-600">{planError}</p>}
            {plans.length > 0 && !roadNetwork && (
              <p className="text-[11px] text-amber-700">Road routing is unavailable on the server, so truck legs are approximate.</p>
            )}

            {plans.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-[11px] text-gray-500">Need it by</label>
                  <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="px-2 py-1 border border-gray-200 rounded-lg text-xs" />
                  {targetDate && <button type="button" className="text-[11px] text-blue-600" onClick={() => setTargetDate('')}>clear</button>}
                </div>
                {plans.map((p) => {
                  const deadline = targetDate ? new Date(`${targetDate}T23:59:59`).getTime() : null;
                  const tooSlow = deadline !== null && new Date(p.estimatedDeliveryDate).getTime() > deadline;
                  const isSel = p.id === planId;
                  const visibleStops = p.transitStops.filter((s) => s.role === 'transit' || s.role === 'rest');
                  const rests = visibleStops.filter((s) => s.role === 'rest').length;
                  return (
                    <button key={p.id} type="button" onClick={() => setPlanId(p.id)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${isSel ? 'border-blue-600 bg-blue-50' : tooSlow ? 'border-gray-100 opacity-60' : 'border-gray-200 hover:border-blue-300 bg-white'}`}>
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base">{p.icon}</span>
                          <span className="text-sm font-semibold text-[#0a192f]">{p.planName}</span>
                          {p.isRecommended && <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-bold uppercase">★ Recommended</span>}
                          {tooSlow && <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-bold">Too slow</span>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-bold text-[#0a192f]">{formatHours(p.totalDurationHours)} · {p.totalDistanceKm.toLocaleString()} km</p>
                          <p className="text-[10px] text-gray-400">Arrives {fmtDate(p.estimatedDeliveryDate)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {p.legs.map((l, i) => (
                          <React.Fragment key={i}>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600" title={`${l.from} → ${l.to} · ${l.distanceKm} km · ${l.speedKmh} km/h`}>
                              {l.icon} {l.label} · {formatHours(l.durationHours)}
                            </span>
                            {i < p.legs.length - 1 && <span className="text-[10px] text-gray-300">→</span>}
                          </React.Fragment>
                        ))}
                      </div>
                      {(visibleStops.length > 0) && (
                        <p className="text-[10px] text-gray-500 mt-1">
                          {p.transitStops.filter((s) => s.role === 'transit').map((s) => `${s.icon} ${s.name}`).join(' · ')}
                          {rests > 0 ? `${p.transitStops.some((s) => s.role === 'transit') ? ' · ' : ''}🛌 ${rests} driver rest break${rests > 1 ? 's' : ''}` : ''}
                        </p>
                      )}
                    </button>
                  );
                })}

                {selected && (
                  <RoutePreviewMap segments={selected.segments} stops={selected.transitStops} height={230} />
                )}

                {selected?.id === 'air' && (
                  <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-[#0a192f] uppercase">✈️ Scheduled transit stops (optional)</p>
                      <button type="button" onClick={() => setShowStopPicker((v) => !v)} className="text-[11px] font-semibold text-sky-600">
                        {showStopPicker ? 'Close' : '+ Add stop'}
                      </button>
                    </div>
                    {vias.length === 0 && <p className="text-[11px] text-gray-400">Direct flight{selected.transitStops.some((s) => s.role === 'transit') ? ' with automatic refuelling stops' : ''}.</p>}
                    {vias.map((v, i) => (
                      <div key={v.name} className="flex items-center justify-between text-xs bg-sky-50 border border-sky-100 rounded px-2 py-1">
                        <span>🔄 {v.name}</span>
                        <button type="button" onClick={() => removeVia(i)} className="text-red-500 p-0.5" aria-label="Remove"><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {showStopPicker && <AirportPicker actionLabel="Add" busy={planning} onPick={addVia} />}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={fixedArrival} onChange={(e) => setFixedArrival(e.target.checked)} />
                Set a fixed arrival date & time instead of the planned one
              </label>
              {fixedArrival && (
                <>
                  <input type="datetime-local" value={arrival} onChange={(e) => setArrival(e.target.value)} className={`${input} max-w-xs`} />
                  {arrivalWarning && <p className="text-[11px] text-amber-700">{arrivalWarning}</p>}
                  <p className="text-[11px] text-gray-400">Extra time is spent at hubs (handling), so vehicles still move at realistic speeds.</p>
                </>
              )}
            </div>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 space-y-2">
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3">
            <button onClick={close} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={create} disabled={creating || planning}
              title={problems[0] || undefined}
              className="flex-1 px-4 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] disabled:opacity-40 flex items-center justify-center gap-2">
              {creating ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : 'Create shipment'}
            </button>
          </div>
          {!error && problems.length > 0 && <p className="text-[11px] text-gray-400 text-center">{problems[0]}</p>}
        </div>
      </div>
    </div>
  );
};

export default CreateShipmentModal;
