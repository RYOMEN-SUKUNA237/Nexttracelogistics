import React, { useEffect, useState } from 'react';
import { Loader2, Plane } from 'lucide-react';
import * as api from '../../../services/api';
import PlaceInput, { Place } from './PlaceInput';

export interface Airport {
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  /** Search near this point instead of asking for a city (e.g. an aircraft's position). */
  near?: { lat: number; lng: number; label: string } | null;
  actionLabel: string;
  busy?: boolean;
  onPick: (airport: Airport) => void;
}

const label = (a: api.HubResult) => (a.iata ? `${a.name} (${a.iata})` : a.name);

/**
 * Choose a real airport: type a city (or give a point) and pick from the
 * airports around it, biggest first.
 */
const AirportPicker: React.FC<Props> = ({ near, actionLabel, busy, onPick }) => {
  const [text, setText] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [airports, setAirports] = useState<api.HubResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const center = near || place;

  useEffect(() => {
    if (!center) { setAirports([]); return; }
    let cancelled = false;
    setLoading(true);
    setError('');
    api.routing.nearestAirports(center.lat, center.lng, 12)
      .then(({ results }) => {
        if (cancelled) return;
        const sorted = [...results].sort((a, b) => {
          const big = (x: api.HubResult) => (x.type === 'large_airport' ? 0 : 1);
          return big(a) - big(b) || a.distanceKm - b.distanceKm;
        });
        setAirports(sorted.slice(0, 6));
        if (sorted.length === 0) setError('No airports with scheduled service found nearby.');
      })
      .catch((e) => !cancelled && setError(e.message || 'Airport lookup failed.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [center?.lat, center?.lng]);

  return (
    <div className="space-y-2">
      {!near && (
        <PlaceInput
          compact
          label=""
          placeholder="City or country near the airport…"
          value={place}
          text={text}
          onTextChange={(t) => { setText(t); if (place && t !== place.name) setPlace(null); }}
          onSelect={(p) => { setPlace(p); setText(p.name); }}
        />
      )}
      {near && <p className="text-[11px] text-gray-500">Airports near {near.label}:</p>}
      {loading && <p className="text-[11px] text-gray-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Finding airports…</p>}
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      {!loading && airports.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {airports.map((a) => (
            <div key={`${a.name}-${a.lat}`} className="flex items-center justify-between gap-2 px-2 py-1.5 bg-white border border-gray-100 rounded-lg">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-700 truncate flex items-center gap-1">
                  <Plane size={11} className="text-sky-500 flex-shrink-0" /> {label(a)}
                </p>
                <p className="text-[10px] text-gray-400">
                  {Math.round(a.distanceKm)} km away · {a.type === 'large_airport' ? 'major airport' : 'regional airport'}
                </p>
              </div>
              <button type="button" disabled={busy}
                onClick={() => onPick({ name: label(a), lat: a.lat, lng: a.lng })}
                className="px-2 py-1 text-[10px] font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded disabled:opacity-50 flex-shrink-0">
                {actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AirportPicker;
