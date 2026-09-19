import React, { useEffect, useMemo, useState } from 'react';
import { X, Edit2, Trash2, Pause, Play, CheckCircle, Loader2, UserPlus } from 'lucide-react';
import * as api from '../../../services/api';
import { Courier, Shipment, ShipmentStatus, STATUS_LABELS, formatDateTime, petDetailsOf } from '../types';
import { liveState, formatHours } from '../../../utils/shipmentTimeline';
import JourneyTimeline from '../../../components/shipment/JourneyTimeline';
import PositionEditor from './PositionEditor';
import useEscapeKey from './useEscapeKey';
import StopControls from './StopControls';
import RoutePreviewMap from './RoutePreviewMap';

interface Props {
  shipment: Shipment | null;
  couriers: Courier[];
  onClose: () => void;
  onChanged: (message: string) => void;
  onEdit: (s: Shipment) => void;
  onPause: (s: Shipment) => void;
  onStatus: (s: Shipment, status: ShipmentStatus) => void;
  onDelete: (s: Shipment) => void;
}

type Tab = 'overview' | 'journey' | 'move' | 'transit' | 'history';

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-[10px] text-gray-400 uppercase">{label}</p>
    <p className="text-sm font-medium text-[#0a192f] break-words">{value || '—'}</p>
  </div>
);

const ShipmentDetailModal: React.FC<Props> = ({ shipment, couriers, onClose, onChanged, onEdit, onPause, onStatus, onDelete }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [now, setNow] = useState(Date.now());
  const [history, setHistory] = useState<any[] | null>(null);
  const [courierId, setCourierId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  useEffect(() => { setTab('overview'); setCourierId(''); setAssignError(''); }, [shipment?.id]);

  useEffect(() => {
    if (!shipment) return;
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, [shipment?.id]);

  useEffect(() => {
    if (!shipment || tab !== 'history') return;
    let cancelled = false;
    setHistory(null);
    api.shipments.get(shipment.trackingId)
      .then((r) => { if (!cancelled) setHistory(r.history || []); })
      .catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, [shipment?.raw, tab]);

  const live = useMemo(() => (shipment ? liveState(shipment.raw, now) : null), [shipment?.raw, now]);

  useEscapeKey(onClose, !!shipment);

  if (!shipment) return null;
  const r = shipment.raw;
  const pet = petDetailsOf(r);
  const started = !!r.departed_at && shipment.status !== 'pending';
  const finished = ['delivered', 'returned'].includes(shipment.status);
  const isAir = !!live?.plan.segments.some((s) => s.mode === 'air');
  const airborne = !!(live && started && !shipment.isPaused && live.state.kind === 'move' && live.state.mode === 'air');
  const progress = live ? live.progress : shipment.progress;
  const remaining = live ? live.tl.totalHours - live.elapsed : 0;

  const assign = async () => {
    if (!courierId) return;
    setAssigning(true);
    setAssignError('');
    try {
      await api.shipments.assignCourier(shipment.trackingId, courierId);
      onChanged(`🚚 Courier assigned to ${shipment.trackingId}`);
      setCourierId('');
    } catch (e: any) {
      setAssignError(e.message || 'Could not assign the courier.');
    } finally {
      setAssigning(false);
    }
  };

  let phase = '';
  if (live) {
    const st = live.state;
    if (finished) phase = shipment.status === 'delivered' ? `✅ Delivered ${formatDateTime(r.actual_delivery)}` : '↩️ Returned to sender';
    else if (!started) phase = `Awaiting pickup · journey takes ${formatHours(live.tl.totalHours)}`;
    else if (shipment.isPaused) phase = `⏸ On hold${shipment.pauseCategory ? ` — ${shipment.pauseCategory}` : ''}${shipment.pauseReason ? `: ${shipment.pauseReason}` : ''}`;
    else if (st.kind === 'move') phase = `${st.icon} ${st.label}: ${st.segment?.from.name} → ${st.segment?.to.name}`;
    else phase = `${st.icon} ${st.label} · ${st.name}`;
  }

  const tabs: [Tab, string][] = [
    ['overview', 'Overview'],
    ['journey', 'Journey'],
    // A finished shipment can still be moved — that re-opens it (see PositionEditor).
    ...(started && live ? [['move', finished ? 'Re-open' : 'Move'] as [Tab, string]] : []),
    ...(live && !finished ? [['transit', isAir ? 'Stops & layovers' : 'Scheduled stops'] as [Tab, string]] : []),
    ['history', 'History'],
  ];

  const selectable = couriers.filter((c) => (c.status === 'active' || c.status === 'on-delivery') && c.courierId !== shipment.courierId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Shipment</p>
            <p className="text-xl font-mono font-bold text-[#0a192f]">{shipment.trackingId}</p>
            <p className="text-xs text-gray-500 truncate">{shipment.origin} → {shipment.destination}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onEdit(shipment)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title="Edit"><Edit2 size={16} /></button>
            <button onClick={() => onDelete(shipment)} className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600" title="Delete"><Trash2 size={16} /></button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Close"><X size={18} className="text-gray-500" /></button>
          </div>
        </div>

        <div className={`px-6 py-2 text-xs font-semibold ${shipment.isPaused ? 'bg-amber-50 text-amber-800' : finished ? 'bg-green-50 text-green-800' : 'bg-slate-50 text-slate-700'}`}>
          {phase || 'This shipment has no route data.'}
        </div>

        <div className="px-6 pt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">{STATUS_LABELS[shipment.status]} · {progress.toFixed(1)}%</span>
            <span className="text-blue-600 font-medium">
              {finished ? '' : shipment.isPaused ? `${formatHours(remaining)} left after resume` : `Arrives ${formatDateTime(r.estimated_delivery)}${r.eta_overridden ? ' (fixed)' : ''}`}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all ${shipment.isPaused ? 'bg-amber-500' : finished ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        </div>

        <div className="px-6 mt-3 border-b border-gray-100 flex gap-1 overflow-x-auto">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap ${tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {tab === 'overview' && (
            <>
              {live && (
                <RoutePreviewMap
                  segments={live.plan.segments}
                  stops={live.plan.stops}
                  vehicle={started && !finished ? { position: live.state.position, mode: live.state.mode } : null}
                  height={200}
                />
              )}
              <div className="grid grid-cols-2 gap-4">
                <Row label="Sender" value={<>{r.sender_name}<span className="block text-xs text-gray-500 font-normal">{[r.sender_email, r.sender_phone].filter(Boolean).join(' · ')}</span></>} />
                <Row label="Receiver" value={<>{r.receiver_name}<span className="block text-xs text-gray-500 font-normal">{[r.receiver_email, r.receiver_phone].filter(Boolean).join(' · ')}</span></>} />
                <Row label="Cargo" value={`${shipment.type} · ${shipment.weight}`} />
                <Row label="Transport" value={r.route_summary || '—'} />
                <Row label="Distance" value={r.route_distance ? `${Math.round(Number(r.route_distance) / 1000).toLocaleString()} km` : '—'} />
                <Row label="Courier" value={shipment.courierName} />
                <Row label="Departed" value={formatDateTime(r.departed_at)} />
                <Row label="Created" value={formatDateTime(r.created_at)} />
                {r.description && <Row label="Description" value={r.description} />}
                {r.special_instructions && <Row label="Instructions" value={r.special_instructions} />}
              </div>

              {pet && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <p className="col-span-full font-bold text-[#0a192f]">🐾 {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</p>
                  {pet.age && <p><span className="text-gray-400">Age:</span> {pet.age}</p>}
                  {pet.gender && <p><span className="text-gray-400">Gender:</span> {pet.gender}</p>}
                  {pet.weight && <p><span className="text-gray-400">Weight:</span> {pet.weight} kg</p>}
                  {pet.microchipId && <p><span className="text-gray-400">Chip:</span> {pet.microchipId}</p>}
                  {pet.vaccinationStatus && <p><span className="text-gray-400">Vaccination:</span> {pet.vaccinationStatus}</p>}
                  {(pet.tempMin || pet.tempMax) && <p><span className="text-gray-400">Temp:</span> {pet.tempMin || '?'}–{pet.tempMax || '?'} °C</p>}
                  {pet.medications && <p className="col-span-full"><span className="text-gray-400">Medications:</span> {pet.medications}</p>}
                  {pet.vetName && <p className="col-span-full"><span className="text-gray-400">Vet:</span> {pet.vetName} {pet.vetPhone} {pet.vetClinic}</p>}
                  {pet.feedingSchedule && <p className="col-span-full"><span className="text-gray-400">Feeding:</span> {pet.feedingSchedule}</p>}
                  {pet.specialCare && <p className="col-span-full"><span className="text-gray-400">Care:</span> {pet.specialCare}</p>}
                </div>
              )}

              {!finished && (
                <div className="border border-gray-100 rounded-lg p-3 space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{shipment.courierId ? 'Reassign courier' : 'Assign courier & start the journey'}</p>
                  <div className="flex gap-2">
                    <select value={courierId} onChange={(e) => setCourierId(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                      <option value="">Select a courier…</option>
                      {selectable.map((c) => <option key={c.courierId} value={c.courierId}>{c.name} ({c.courierId}){c.status === 'on-delivery' ? ' · busy' : ''}</option>)}
                    </select>
                    <button onClick={assign} disabled={!courierId || assigning}
                      className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40 flex items-center gap-1">
                      {assigning ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Assign
                    </button>
                  </div>
                  {assignError && <p className="text-xs text-red-600">{assignError}</p>}
                </div>
              )}
            </>
          )}

          {tab === 'journey' && live && (
            <JourneyTimeline live={live} paused={shipment.isPaused} started={started} nowMs={now} />
          )}
          {tab === 'journey' && !live && <p className="text-sm text-gray-400">No route data for this shipment.</p>}

          {tab === 'move' && live && (
            <PositionEditor shipment={shipment} live={live} onDone={(m) => { onChanged(m); setTab('journey'); }} onCancel={() => setTab('journey')} />
          )}

          {tab === 'transit' && (
            <StopControls shipment={shipment} live={live} onChanged={onChanged} />
          )}

          {tab === 'history' && (
            history === null
              ? <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading history…</p>
              : history.length === 0
                ? <p className="text-sm text-gray-400">No history yet.</p>
                : (
                  <ul className="space-y-2">
                    {history.map((h) => (
                      <li key={h.id} className="text-xs border-l-2 border-blue-200 pl-3">
                        <p className="font-semibold text-[#0a192f]">{STATUS_LABELS[h.status as ShipmentStatus] || h.status}{h.location ? ` · ${h.location}` : ''}</p>
                        {h.notes && <p className="text-gray-600">{h.notes}</p>}
                        <p className="text-gray-400">{formatDateTime(h.created_at)}{h.updated_by ? ` · ${h.updated_by}` : ''}</p>
                      </li>
                    ))}
                  </ul>
                )
          )}
        </div>

        {!finished && (
          <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-2">
            {shipment.status !== 'pending' && (
              <button onClick={() => onPause(shipment)} disabled={airborne}
                title={airborne ? 'The aircraft is airborne — divert it or wait until it lands' : undefined}
                className={`flex-1 min-w-[140px] px-4 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${shipment.isPaused ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-amber-500 text-white hover:bg-amber-400'}`}>
                {shipment.isPaused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> {airborne ? 'Airborne' : shipment.type === 'Live Animals' ? 'Pause for care' : 'Pause'}</>}
              </button>
            )}
            {shipment.status === 'pending' && (
              <button onClick={() => onStatus(shipment, 'picked-up')} className="flex-1 min-w-[140px] px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-500">
                Mark picked up
              </button>
            )}
            {!shipment.isPaused && ['picked-up', 'in-transit'].includes(shipment.status) && (
              <button onClick={() => onStatus(shipment, 'out-for-delivery')} className="flex-1 min-w-[140px] px-4 py-2.5 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-500">
                Out for delivery
              </button>
            )}
            <button onClick={() => onStatus(shipment, 'delivered')} className="flex-1 min-w-[140px] px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 flex items-center justify-center gap-2">
              <CheckCircle size={14} /> Mark delivered
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShipmentDetailModal;
