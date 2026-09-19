import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import * as api from '../../../services/api';
import { Shipment, PetDetails, petDetailsOf, toLocalInput } from '../types';
import useEscapeKey from './useEscapeKey';

interface Props {
  shipment: Shipment | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const input = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none';
const labelCls = 'block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide';

/** Edit contact, cargo, arrival time and animal details of a shipment. */
const EditShipmentModal: React.FC<Props> = ({ shipment, onClose, onSaved }) => {
  const [f, setF] = useState<Record<string, string>>({});
  const [pet, setPet] = useState<PetDetails>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shipment) return;
    const r = shipment.raw;
    setF({
      sender_name: r.sender_name || '',
      sender_email: r.sender_email || '',
      sender_phone: r.sender_phone || '',
      receiver_name: r.receiver_name || '',
      receiver_email: r.receiver_email || '',
      receiver_phone: r.receiver_phone || '',
      weight: r.weight || '',
      description: r.description || '',
      special_instructions: r.special_instructions || '',
      estimated_delivery: toLocalInput(r.estimated_delivery),
    });
    setPet(petDetailsOf(r) || {});
    setError('');
  }, [shipment?.id]);

  useEscapeKey(onClose, !!shipment);

  if (!shipment) return null;
  const r = shipment.raw;
  const isAnimal = shipment.type === 'Live Animals';
  const finished = ['delivered', 'returned'].includes(shipment.status);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setError('');
    if (!f.sender_name.trim() || !f.receiver_name.trim()) return setError('Sender and receiver names are required.');
    for (const k of ['sender_email', 'receiver_email']) {
      if (f[k].trim() && !EMAIL_RE.test(f[k].trim())) return setError(`${k.startsWith('sender') ? 'Sender' : 'Receiver'} email is not valid.`);
    }
    const payload: Record<string, any> = {};
    const original: Record<string, string> = {
      sender_name: r.sender_name || '', sender_email: r.sender_email || '', sender_phone: r.sender_phone || '',
      receiver_name: r.receiver_name || '', receiver_email: r.receiver_email || '', receiver_phone: r.receiver_phone || '',
      weight: r.weight || '', description: r.description || '', special_instructions: r.special_instructions || '',
    };
    Object.keys(original).forEach((k) => {
      if (f[k].trim() !== original[k]) payload[k] = f[k].trim();
    });
    if (f.estimated_delivery && f.estimated_delivery !== toLocalInput(r.estimated_delivery)) {
      const d = new Date(f.estimated_delivery);
      if (isNaN(d.getTime())) return setError('Invalid arrival date.');
      if (!finished && d.getTime() <= Date.now()) return setError('The arrival time must be in the future.');
      payload.estimated_delivery = d.toISOString();
    }
    if (isAnimal) {
      if (!pet.species) return setError('Species is required for live animals.');
      payload.pet_details = pet;
    }
    if (Object.keys(payload).length === 0) { onClose(); return; }

    setSaving(true);
    try {
      await api.shipments.update(shipment.trackingId, payload);
      onSaved(`💾 ${shipment.trackingId} updated`);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to update the shipment.');
    } finally {
      setSaving(false);
    }
  };

  const petField = (k: keyof PetDetails, label: string, type = 'text') => (
    <div>
      <label className={labelCls}>{label}</label>
      <input type={type} className={input} value={(pet[k] as string) || ''} onChange={(e) => setPet((p) => ({ ...p, [k]: e.target.value }))} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-[#0a192f]">Edit Shipment</h3>
            <p className="text-xs text-gray-400 font-mono">{shipment.trackingId}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg" aria-label="Close"><X size={20} className="text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Sender name *</label><input className={input} value={f.sender_name || ''} onChange={(e) => set('sender_name', e.target.value)} /></div>
            <div><label className={labelCls}>Receiver name *</label><input className={input} value={f.receiver_name || ''} onChange={(e) => set('receiver_name', e.target.value)} /></div>
            <div><label className={labelCls}>Sender email</label><input type="email" className={input} value={f.sender_email || ''} onChange={(e) => set('sender_email', e.target.value)} /></div>
            <div><label className={labelCls}>Receiver email</label><input type="email" className={input} value={f.receiver_email || ''} onChange={(e) => set('receiver_email', e.target.value)} /></div>
            <div><label className={labelCls}>Sender phone</label><input className={input} value={f.sender_phone || ''} onChange={(e) => set('sender_phone', e.target.value)} /></div>
            <div><label className={labelCls}>Receiver phone</label><input className={input} value={f.receiver_phone || ''} onChange={(e) => set('receiver_phone', e.target.value)} /></div>
            <div><label className={labelCls}>Weight</label><input className={input} value={f.weight || ''} onChange={(e) => set('weight', e.target.value)} placeholder="e.g. 12 kg" /></div>
            <div>
              <label className={labelCls}>Arrival date & time</label>
              <input type="datetime-local" className={input} value={f.estimated_delivery || ''} onChange={(e) => set('estimated_delivery', e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 -mt-2">
            Changing the arrival time fixes it: extra time is spent at hubs, less time speeds the journey up. Adding or removing transit stops re-plans it again.
          </p>
          <div><label className={labelCls}>Description</label><input className={input} value={f.description || ''} onChange={(e) => set('description', e.target.value)} /></div>
          <div><label className={labelCls}>Special instructions</label>
            <textarea rows={2} className={`${input} resize-none`} value={f.special_instructions || ''} onChange={(e) => set('special_instructions', e.target.value)} />
          </div>

          {isAnimal && (
            <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 space-y-3">
              <p className="text-xs font-bold text-[#0a192f] uppercase">🐾 Animal details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Species *</label>
                  <select className={`${input} bg-white`} value={pet.species || ''} onChange={(e) => setPet((p) => ({ ...p, species: e.target.value }))}>
                    <option value="">Select…</option>
                    {['Dog', 'Cat', 'Bird', 'Rabbit', 'Reptile', 'Fish', 'Horse', 'Livestock', 'Exotic', 'Other'].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {petField('breed', 'Breed')}
                {petField('microchipId', 'Microchip ID')}
                {petField('medications', 'Medications')}
                {petField('vetName', 'Vet name')}
                {petField('vetPhone', 'Vet phone')}
                {petField('tempMin', 'Min temp (°C)', 'number')}
                {petField('tempMax', 'Max temp (°C)', 'number')}
                {petField('feedingSchedule', 'Feeding schedule')}
                {petField('specialCare', 'Special care')}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditShipmentModal;
