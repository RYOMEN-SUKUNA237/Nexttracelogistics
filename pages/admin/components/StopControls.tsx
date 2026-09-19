import React, { useState } from 'react';
import { Loader2, PlaneLanding, Trash2, Navigation, PauseCircle, Crosshair, MapPin, Timer } from 'lucide-react';
import * as api from '../../../services/api';
import { Shipment, scheduledStopsOf } from '../types';
import { haversineKm, liveState, formatHours, PlanStop } from '../../../utils/shipmentTimeline';
import AirportPicker, { Airport } from './AirportPicker';
import PlaceInput, { Place } from './PlaceInput';

type Live = NonNullable<ReturnType<typeof liveState>>;

interface Props {
  shipment: Shipment;
  live: Live | null;
  onChanged: (message: string) => void;
  /** Live Map only: lets the admin click the map to choose where to stop. */
  mapPick?: { active: boolean; toggle: () => void; point: { lat: number; lng: number } | null };
}

type Panel = null | 'road' | 'air' | 'divert';

const ROAD_KINDS: { value: string; label: string; icon: string }[] = [
  { value: 'rest', label: 'Rest stop', icon: '🛌' },
  { value: 'meal', label: 'Driver break', icon: '☕' },
  { value: 'fuel', label: 'Refuelling', icon: '⛽' },
  { value: 'parking', label: 'Parking / holding', icon: '🅿️' },
  { value: 'roadside', label: 'Roadside stop', icon: '🛑' },
  { value: 'checkpoint', label: 'Checkpoint', icon: '🚧' },
  { value: 'delivery', label: 'Drop-off', icon: '📦' },
];
const QUICK_MINUTES = [15, 30, 60, 120];

/** Scheduled stops for a shipment: road stops on truck legs, layovers on flights. */
const StopControls: React.FC<Props> = ({ shipment, live, onChanged, mapPick }) => {
  const [panel, setPanel] = useState<Panel>(null);
  const [divertFrom, setDivertFrom] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Road stop form
  const [roadBy, setRoadBy] = useState<'time' | 'place'>('time');
  const [minutesAhead, setMinutesAhead] = useState(30);
  const [duration, setDuration] = useState(30);
  const [kind, setKind] = useState('rest');
  const [placeText, setPlaceText] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [stopName, setStopName] = useState('');

  const raw = shipment.raw;
  const airVias = scheduledStopsOf(raw);
  const finished = ['delivered', 'returned'].includes(shipment.status);
  const started = !!raw.departed_at && shipment.status !== 'pending';

  if (!live) return <p className="text-xs text-gray-400">This shipment has no route yet.</p>;
  const { plan, tl, state, elapsed } = live;

  const isAir = plan.segments.some((s) => s.mode === 'air');
  const roadStops = plan.stops.filter((s) => s.role === 'scheduled_road');
  const roadAhead = tl.phases.some((p) => p.type === 'move' && plan.segments[p.index].mode === 'road' && p.endHours > elapsed + 0.02);
  const destPhase = tl.phases.find((p) => p.type === 'stop' && plan.stops[p.index]?.role === 'dest_hub');
  const landedAtDestination = started && destPhase ? elapsed >= destPhase.startHours : false;
  const airborne = started && !shipment.isPaused && state.kind === 'move' && state.mode === 'air';
  const atAirport = started && state.kind === 'stop' && ['airport', 'transit_airport'].includes(state.stop?.type || '');
  const canEdit = !finished;

  const phaseOf = (match: (s: PlanStop) => boolean) => {
    const idx = plan.stops.findIndex(match);
    return idx === -1 ? null : tl.phases.find((p) => p.type === 'stop' && p.index === idx) || null;
  };

  const statusOf = (phase: { startHours: number; endHours: number } | null) => {
    if (!phase || !started) return { label: 'Upcoming', removable: true, inHours: phase ? phase.startHours - elapsed : null };
    if (elapsed >= phase.endHours) return { label: 'Completed', removable: false, inHours: null };
    if (elapsed >= phase.startHours) return { label: 'Stopped here now', removable: false, inHours: null };
    return { label: 'Upcoming', removable: true, inHours: phase.startHours - elapsed };
  };

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setPanel(null);
      onChanged(message);
    } catch (e: any) {
      setError(e.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const addAirStop = (a: Airport) => run(
    () => api.shipments.addTransitStop(shipment.trackingId, { airport_name: a.name, lat: a.lat, lng: a.lng }),
    `✈️ Transit stop added at ${a.name}`);
  const divert = (a: Airport) => run(
    () => api.shipments.divert(shipment.trackingId, { airport_name: a.name, lat: a.lat, lng: a.lng }),
    `🛬 Flight diverted to ${a.name}`);
  const removeAirStop = (idx: number, name: string) => run(
    () => api.shipments.deleteTransitStop(shipment.trackingId, idx),
    `🗑️ Removed transit stop at ${name}`);
  const hold = () => run(() => api.shipments.transitLand(shipment.trackingId, {}), `⏸ Cargo held at ${state.name}`);
  const removeRoadStop = (stop: PlanStop) => run(
    () => api.shipments.removeRoadStop(shipment.trackingId, stop.id!),
    `🗑️ Removed stop at ${stop.name}`);

  const addRoadStop = () => {
    const preset = ROAD_KINDS.find((k) => k.value === kind);
    const payload: any = { duration_minutes: duration, kind, name: stopName.trim() || undefined };
    if (roadBy === 'time') {
      payload.in_minutes = minutesAhead;
    } else if (mapPick?.point && !place) {
      payload.lat = mapPick.point.lat;
      payload.lng = mapPick.point.lng;
    } else if (place) {
      payload.lat = place.lat;
      payload.lng = place.lng;
    } else {
      setError('Choose a place on the route, or switch to scheduling by time.');
      return;
    }
    run(() => api.shipments.addRoadStop(shipment.trackingId, payload),
      `${preset?.icon || '🛑'} ${roadBy === 'time' ? `Stop scheduled in ${minutesAhead} min` : 'Stop scheduled'} (${duration} min)`);
  };

  let situation = '';
  if (finished) situation = 'Shipment completed.';
  else if (!started) situation = 'Not departed yet — stops can be scheduled anywhere along the route.';
  else if (shipment.isPaused) situation = `On hold${shipment.pauseCategory ? ` — ${shipment.pauseCategory}` : ''}.`;
  else if (state.kind === 'move') {
    const verb = state.mode === 'air' ? 'In flight' : state.mode === 'sea' ? 'At sea' : 'On the road';
    situation = `${verb}: ${state.segment?.from.name} → ${state.segment?.to.name} · ${formatHours(state.remainingInPhaseHours)} to go`;
  } else situation = `Stopped at ${state.name} (${state.label.toLowerCase()})`;

  return (
    <div className="space-y-3 text-xs">
      <p className={`px-3 py-2 rounded-lg border ${airborne ? 'bg-sky-50 border-sky-100 text-sky-800' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
        {state.mode === 'air' ? '✈️' : state.mode === 'sea' ? '🚢' : '🚛'} {situation}
      </p>

      {/* Scheduled stops */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase">Scheduled stops</p>
        {roadStops.length === 0 && airVias.length === 0 && (
          <p className="text-gray-500 italic text-[11px]">None scheduled{plan.stops.some((s) => s.role === 'transit') ? ' (automatic refuelling stops only)' : ''}.</p>
        )}
        {roadStops.map((stop) => {
          const st = statusOf(phaseOf((x) => x.role === 'scheduled_road' && x.id === stop.id));
          return (
            <div key={stop.id} className="flex items-center justify-between gap-2 p-2 bg-white border border-gray-100 rounded-lg">
              <div className="min-w-0">
                <p className="font-semibold text-gray-700 truncate">{stop.icon} {stop.name}</p>
                <p className={`text-[10px] ${st.label === 'Stopped here now' ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
                  {stop.label} · {Math.round(stop.waitHours * 60)} min · {st.label}
                  {st.inHours != null && started && !shipment.isPaused ? ` · in ${formatHours(st.inHours)}` : ''}
                </p>
              </div>
              {st.removable && canEdit && (
                <button type="button" disabled={busy} onClick={() => removeRoadStop(stop)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-40" title="Remove stop"><Trash2 size={13} /></button>
              )}
            </div>
          );
        })}
        {airVias.map((v, idx) => {
          const st = statusOf(phaseOf((x) => x.role === 'transit' && haversineKm(x.coords, [Number(v.lng), Number(v.lat)]) < 5));
          return (
            <div key={`${v.name}-${idx}`} className="flex items-center justify-between gap-2 p-2 bg-white border border-gray-100 rounded-lg">
              <div className="min-w-0">
                <p className="font-semibold text-gray-700 truncate">🔄 {v.name}</p>
                <p className={`text-[10px] ${st.label === 'Stopped here now' ? 'text-sky-600 font-semibold' : 'text-gray-400'}`}>
                  Flight layover · {st.label}{st.inHours != null && started && !shipment.isPaused ? ` · lands in ${formatHours(st.inHours)}` : ''}
                </p>
              </div>
              {st.removable && canEdit && !landedAtDestination && (
                <button type="button" disabled={busy} onClick={() => removeAirStop(idx, v.name)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-40" title="Remove stop"><Trash2 size={13} /></button>
              )}
            </div>
          );
        })}
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {roadAhead && (
            <button type="button" onClick={() => setPanel(panel === 'road' ? null : 'road')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold ${panel === 'road' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'}`}>
              <MapPin size={12} /> Add road stop
            </button>
          )}
          {isAir && !landedAtDestination && (
            <button type="button" onClick={() => setPanel(panel === 'air' ? null : 'air')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold ${panel === 'air' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50'}`}>
              <PlaneLanding size={12} /> Add flight layover
            </button>
          )}
          {airborne && (
            <button type="button" onClick={() => { setDivertFrom({ lng: state.position[0], lat: state.position[1] }); setPanel(panel === 'divert' ? null : 'divert'); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold ${panel === 'divert' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50'}`}>
              <Navigation size={12} /> Divert flight
            </button>
          )}
          {atAirport && !shipment.isPaused && (
            <button type="button" disabled={busy} onClick={hold}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold bg-white text-amber-700 border-amber-200 hover:bg-amber-50 disabled:opacity-50">
              <PauseCircle size={12} /> Hold cargo here
            </button>
          )}
        </div>
      )}

      {/* Road stop form */}
      {panel === 'road' && (
        <div className="p-3 bg-amber-50/40 border border-amber-100 rounded-lg space-y-3">
          <div className="flex gap-1 bg-white rounded-lg p-1 border border-amber-100">
            <button type="button" onClick={() => setRoadBy('time')}
              className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[11px] font-semibold ${roadBy === 'time' ? 'bg-amber-500 text-white' : 'text-gray-600'}`}>
              <Timer size={12} /> By time
            </button>
            <button type="button" onClick={() => setRoadBy('place')}
              className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[11px] font-semibold ${roadBy === 'place' ? 'bg-amber-500 text-white' : 'text-gray-600'}`}>
              <MapPin size={12} /> By place
            </button>
          </div>

          {roadBy === 'time' ? (
            <div className="space-y-1.5">
              <p className="text-[11px] text-gray-600">Stop this far from now (while the truck is on the road):</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {QUICK_MINUTES.map((m) => (
                  <button key={m} type="button" onClick={() => setMinutesAhead(m)}
                    className={`px-2 py-1 rounded border text-[11px] font-semibold ${minutesAhead === m ? 'bg-white border-amber-400 text-amber-700' : 'bg-white/60 border-gray-200 text-gray-600'}`}>
                    {m < 60 ? `${m} min` : `${m / 60} h`}
                  </button>
                ))}
                <input type="number" min={1} max={2880} value={minutesAhead} onChange={(e) => setMinutesAhead(Math.max(1, Number(e.target.value)))}
                  className="w-16 px-1.5 py-1 border border-gray-200 rounded text-center" aria-label="Minutes from now" />
                <span className="text-gray-500">min from now</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-gray-600">Pick a place along the route (within 25 km of it).</p>
                {mapPick && (
                  <button type="button" onClick={mapPick.toggle}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border flex-shrink-0 ${mapPick.active ? 'bg-amber-500 text-white border-amber-500 animate-pulse' : 'bg-white text-amber-600 border-gray-200'}`}>
                    <Crosshair size={11} /> {mapPick.active ? 'Click the map…' : 'Pick on map'}
                  </button>
                )}
              </div>
              {mapPick?.point && !place && (
                <p className="text-[11px] text-amber-700">📍 Using the point you clicked ({mapPick.point.lat.toFixed(3)}, {mapPick.point.lng.toFixed(3)}).</p>
              )}
              <PlaceInput compact label="" placeholder="Town, service area, address…" value={place} text={placeText}
                onTextChange={(t) => { setPlaceText(t); if (place && t !== place.name) setPlace(null); }}
                onSelect={(p) => { setPlace(p); setPlaceText(p.name); if (!stopName.trim()) setStopName(p.name.split(',')[0]); }} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Reason</label>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded bg-white">
                {ROAD_KINDS.map((k) => <option key={k.value} value={k.value}>{k.icon} {k.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Stop length (min)</label>
              <input type="number" min={1} max={4320} value={duration} onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
                className="w-full px-2 py-1.5 border border-gray-200 rounded" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Name shown to the customer (optional)</label>
            <input value={stopName} onChange={(e) => setStopName(e.target.value)} placeholder="e.g. Buc-ee's service area"
              className="w-full px-2 py-1.5 border border-gray-200 rounded" />
          </div>
          <p className="text-[10px] text-gray-500">The truck waits there, and the arrival time moves back by the length of the stop.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPanel(null)} className="px-3 py-1.5 text-gray-600 hover:bg-white rounded-lg">Cancel</button>
            <button type="button" onClick={addRoadStop} disabled={busy}
              className="px-3.5 py-1.5 font-semibold bg-amber-500 text-white hover:bg-amber-600 rounded-lg disabled:opacity-60 flex items-center gap-1">
              {busy && <Loader2 size={12} className="animate-spin" />} Schedule stop
            </button>
          </div>
        </div>
      )}

      {/* Flight layover */}
      {panel === 'air' && (
        <div className="p-3 bg-sky-50/40 border border-sky-100 rounded-lg space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-gray-600">Pick the airport for the layover. The flight is re-planned from its current position.</p>
            {mapPick && (
              <button type="button" onClick={mapPick.toggle}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border flex-shrink-0 ${mapPick.active ? 'bg-sky-600 text-white border-sky-600 animate-pulse' : 'bg-white text-sky-600 border-gray-200'}`}>
                <Crosshair size={11} /> {mapPick.active ? 'Click the map…' : 'Pick on map'}
              </button>
            )}
          </div>
          <AirportPicker near={mapPick?.point ? { ...mapPick.point, label: 'the point you clicked' } : null} actionLabel="Add layover" busy={busy} onPick={addAirStop} />
        </div>
      )}

      {/* Divert */}
      {panel === 'divert' && airborne && divertFrom && (
        <div className="p-3 bg-orange-50/40 border border-orange-100 rounded-lg space-y-2">
          <p className="text-[11px] text-gray-600">The aircraft turns towards the chosen airport right away, then continues to its destination.</p>
          <AirportPicker near={{ ...divertFrom, label: 'the aircraft’s position' }} actionLabel="Divert here" busy={busy} onPick={divert} />
        </div>
      )}

      {busy && <p className="text-[11px] text-gray-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Updating route…</p>}
      {error && <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1">{error}</p>}
    </div>
  );
};

export default StopControls;
