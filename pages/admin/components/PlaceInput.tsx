import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { geocodeSearch, MAPBOX_TOKEN } from '../../../utils/mapbox';

export interface Place {
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  label: string;
  placeholder?: string;
  value: Place | null;
  text: string;
  onTextChange: (text: string) => void;
  onSelect: (place: Place) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  compact?: boolean;
}

/**
 * Address / city search with Mapbox suggestions. Keeps the exact coordinates
 * of the chosen suggestion so they never have to be looked up again.
 */
const PlaceInput: React.FC<Props> = ({ label, placeholder, value, text, onTextChange, onSelect, disabled, autoFocus, compact }) => {
  const [suggestions, setSuggestions] = useState<Array<{ lng: number; lat: number; place_name: string }>>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2 || (value && value.name === text)) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const results = await geocodeSearch(q);
      if (id !== requestId.current) return;
      setSuggestions(results);
      setHighlight(0);
      setOpen(results.length > 0);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [text, value]);

  const choose = (s: { lng: number; lat: number; place_name: string }) => {
    requestId.current++;
    onSelect({ name: s.place_name, lat: s.lat, lng: s.lng });
    setSuggestions([]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => (h + 1) % suggestions.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(suggestions[highlight]); }
    // Escape closes the suggestions first; the dialog around us only closes
    // on a second press (see useEscapeKey).
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  };

  const pad = compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm';

  return (
    <div ref={wrapperRef} className="relative">
      {label && <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>}
      <div className="relative">
        <input
          type="text"
          value={text}
          disabled={disabled || !MAPBOX_TOKEN}
          autoFocus={autoFocus}
          onChange={(e) => onTextChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          onKeyDown={onKeyDown}
          placeholder={MAPBOX_TOKEN ? placeholder : 'Map search unavailable (no Mapbox token)'}
          className={`w-full ${pad} pr-8 border rounded-lg outline-none focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] disabled:bg-gray-50 ${value && value.name === text ? 'border-green-300' : 'border-gray-200'}`}
        />
        {loading
          ? <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
          : <MapPin size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 ${value && value.name === text ? 'text-green-500' : 'text-gray-400'}`} />}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button key={`${s.place_name}-${i}`} type="button"
              onMouseDown={(e) => { e.preventDefault(); choose(s); }}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-4 py-2 text-sm text-gray-700 flex items-start gap-2 border-b border-gray-50 last:border-0 ${i === highlight ? 'bg-blue-50' : ''}`}>
              <MapPin size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{s.place_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlaceInput;
