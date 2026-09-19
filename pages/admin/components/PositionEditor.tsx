import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import * as api from '../../../services/api';
import { Shipment } from '../types';
import { liveState, progressFromPoint, stateAt, formatHours, wrapLng } from '../../../utils/shipmentTimeline';
import PlaceInput, { Place } from './PlaceInput';

type Live = NonNullable<ReturnType<typeof liveState>>;

interface Props {
  shipment: Shipment;
  live: Live;
  /** Progress chosen by clicking the route on a map (Live Map). */
  external?: { progress: number; label: string; key: number } | null;
  onPreview?: (progress: number | null) => void;
  onDone: (message: string) => void;
  onCancel: () => void;
}

/**
 * Move a shipment to another point of its journey. Slider, place search and
 * map clicks all use the same timeline as the moving marker, so what you see
 * is exactly where the vehicle will be.
 */
const PositionEditor: React.FC<Props> = ({ shipment, live, external, onPreview, onDone, onCancel }) => {
  const [progress, setProgress] = useState(() => Math.round(live.progress * 10) / 10);
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!external) return;
    setProgress(Math.round(external.progress * 10) / 10);
    setLabel(external.label);
    setError('');
  }, [external?.key]);

  useEffect(() => {
    onPreview?.(progress);
  }, [progress]);

  useEffect(() => () => onPreview?.(null), []);

  const preview = stateAt(live.plan, live.tl, (progress / 100) * live.tl.totalHours);
  const describe = preview
    ? preview.kind === 'move'
      ? `${preview.icon} ${preview.label} (${preview.segment?.from.name} → ${preview.segment?.to.name})`
      : `${preview.icon} ${preview.label} at ${preview.name}`
    : '';

  const onSlide = (v: number) => {
    setProgress(Math.max(0, Math.min(100, v)));
    setLabel('');
    setError('');
  };

  const onPlace = (p: Place) => {
    setPlace(p);
    setText(p.name);
    const hit = progressFromPoint(live.plan, live.tl, [p.lng, p.lat]);
    if (!hit) return;
    if (hit.distanceKm > 300) {
      setError(`${p.name.split(',')[0]} is ${Math.round(hit.distanceKm)} km from the route — pick a place along it.`);
      return;
    }
    setError('');
    setProgress(Math.round(hit.progress * 10) / 10);
    setLabel(p.name);
  };

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      const pos = preview?.position;
      await api.shipments.alterLocation(shipment.trackingId, {
        progress,
        location_name: label || describe.replace(/^\S+\s/, ''),
        lat: pos ? pos[1] : undefined,
        lng: pos ? wrapLng(pos[0]) : undefined,
      });
      onDone(willReopen
        ? `↩️ ${shipment.trackingId} re-opened and moved to ${progress}%`
        : `📍 ${shipment.trackingId} moved to ${progress}%`);
    } catch (e: any) {
      setError(e.message || 'Could not move the shipment.');
    } finally {
      setBusy(false);
    }
  };

  const remaining = live.tl.totalHours * (1 - progress / 100);
  // Moving a finished shipment back onto its route re-opens it: the server
  // clears the delivery date and works the status out from the new position.
  const finished = ['delivered', 'returned'].includes(shipment.status);
  const willReopen = finished && progress < 100;

  return (
    <div className="space-y-3 text-xs">
      <div>
        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Journey progress</label>
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={100} step={0.1} value={progress}
            onChange={(e) => onSlide(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
          <div className="flex items-center gap-1">
            <input type="number" min={0} max={100} step={0.1} value={progress}
              onChange={(e) => onSlide(Number(e.target.value))}
              className="w-16 px-1.5 py-1 text-center border border-gray-300 rounded font-mono font-bold" />
            <span className="text-gray-500">%</span>
          </div>
        </div>
      </div>

      <PlaceInput compact label="Or snap to a place on the route" placeholder="City along the route…"
        value={place} text={text}
        onTextChange={(t) => { setText(t); if (place && t !== place.name) setPlace(null); }}
        onSelect={onPlace} />

      <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg text-blue-800">
        <p className="font-semibold">{describe || '—'}</p>
        <p className="text-[10px] text-blue-600 mt-0.5">
          {shipment.isPaused ? 'Shipment stays on hold at this point.' : `Arrives in ${formatHours(remaining)} from this point.`}
          {label ? ` · ${label}` : ''}
        </p>
      </div>

      {finished && (
        <p className={`text-[11px] p-2 rounded-lg border ${willReopen
          ? 'text-amber-800 bg-amber-50 border-amber-200'
          : 'text-gray-600 bg-gray-50 border-gray-200'}`}>
          {willReopen
            ? `⚠️ This shipment is marked ${shipment.status}. Applying puts it back on the road — the delivery date is cleared and tracking resumes from ${progress}%.`
            : 'Drag the slider below 100% to re-open this shipment and put it back on the road.'}
        </p>
      )}

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
        <button type="button" onClick={apply} disabled={busy}
          className="flex items-center gap-1 px-3.5 py-1.5 font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-60">
          {busy ? <Loader2 size={12} className="animate-spin" /> : willReopen ? 'Re-open shipment' : 'Apply position'}
        </button>
      </div>
    </div>
  );
};

export default PositionEditor;
