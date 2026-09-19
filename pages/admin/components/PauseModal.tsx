import React, { useEffect, useState } from 'react';
import { Pause, Play, X, Loader2 } from 'lucide-react';
import * as api from '../../../services/api';
import { Shipment } from '../types';

const GENERAL_CATEGORIES = ['Customs Hold', 'Weather Delay', 'Port Congestion', 'Document Issue', 'Transit Change', 'Recipient Unavailable', 'Security Check', 'Vehicle Breakdown', 'Other'];
const ANIMAL_CATEGORIES = ['Veterinary Check', 'Emergency Vet Visit', 'Feeding & Hydration', 'Walking / Exercise', 'Rest Period (Mandatory)', 'Temperature Out of Range', 'Quarantine Required', 'Anxiety / Stress Management', 'Grooming & Hygiene', 'Crate Maintenance', 'Weather — Unsafe for Animal', 'Vaccination Document Issue', 'Import/Export Permit Hold', 'Other'];

interface Props {
  shipment: Shipment | null;
  onClose: () => void;
  onDone: (message: string) => void;
}

/**
 * Pause (with a hold category and reason) or resume a shipment. Customers are
 * emailed by the server either way.
 */
const PauseModal: React.FC<Props> = ({ shipment, onClose, onDone }) => {
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCategory('');
    setReason('');
    setError('');
  }, [shipment?.id]);

  if (!shipment) return null;
  const resuming = shipment.isPaused;
  const categories = shipment.type === 'Live Animals' ? ANIMAL_CATEGORIES : GENERAL_CATEGORIES;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await api.shipments.togglePause(shipment.trackingId, resuming ? {} : { pause_category: category, pause_reason: reason.trim() || undefined });
      onDone(resuming ? `▶️ ${shipment.trackingId} resumed` : `⏸ ${shipment.trackingId} placed on hold`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update the shipment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-[#0a192f]">{resuming ? '▶ Resume Shipment' : '⏸ Pause Shipment'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg" aria-label="Close"><X size={20} className="text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 px-4 py-3 rounded-lg flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Shipment</p>
              <p className="font-mono font-bold text-[#0a192f]">{shipment.trackingId}</p>
            </div>
            <div className="text-right min-w-0">
              <p className="text-xs text-gray-400 truncate">{shipment.origin}</p>
              <p className="text-xs text-gray-400 truncate">→ {shipment.destination}</p>
            </div>
          </div>

          {!resuming && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Hold category *</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none bg-white">
                  <option value="">Select a category…</option>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Reason / details</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                  placeholder="Brief explanation — included in the customer email"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none resize-none" />
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-lg">
                ⚡ The sender and receiver are emailed the hold reason as soon as you confirm.
              </p>
            </>
          )}
          {resuming && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2.5 rounded-lg">
              ✅ The shipment continues from where it stopped and its arrival time moves back by the time it was on hold.
              {shipment.pauseCategory ? ` Current hold: ${shipment.pauseCategory}${shipment.pauseReason ? ` — ${shipment.pauseReason}` : ''}.` : ''}
            </p>
          )}

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={confirm} disabled={busy || (!resuming && !category)}
              className={`flex-1 px-4 py-2.5 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${resuming ? 'bg-green-600 hover:bg-green-500' : 'bg-amber-500 hover:bg-amber-400'}`}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : resuming ? <Play size={14} /> : <Pause size={14} />}
              {resuming ? 'Resume & notify' : 'Pause & notify'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PauseModal;
