import React, { useMemo, useState } from 'react';
import {
  UserPlus, Search, Copy, CheckCircle, Bike, Car, Truck as TruckIcon, X, Eye, ChevronDown, Loader2, Edit2, Trash2,
} from 'lucide-react';
import { Courier } from './types';
import Barcode from '../../components/ui/Barcode';
import * as api from '../../services/api';

interface CouriersProps {
  couriers: Courier[];
  onRefresh: () => void;
}

const vehicleIcons: Record<string, React.ReactNode> = {
  motorcycle: <Bike size={16} />,
  car: <Car size={16} />,
  van: <Car size={16} />,
  truck: <TruckIcon size={16} />,
  bicycle: <Bike size={16} />,
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  'on-delivery': 'bg-blue-100 text-blue-700',
  'on-break': 'bg-amber-100 text-amber-700',
};

const STATUS_OPTIONS: Courier['status'][] = ['active', 'on-delivery', 'on-break', 'inactive'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inputCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide';

type FormState = {
  name: string; email: string; phone: string; vehicleType: Courier['vehicleType'];
  licensePlate: string; zone: string; emergencyContact: string; notes: string;
};
const emptyForm: FormState = { name: '', email: '', phone: '', vehicleType: 'van', licensePlate: '', zone: '', emergencyContact: '', notes: '' };

const Couriers: React.FC<CouriersProps> = ({ couriers, onRefresh }) => {
  const [formMode, setFormMode] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<Courier | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [barcodeFor, setBarcodeFor] = useState<{ courier: Courier; justRegistered: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState<Courier | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const openCreate = () => {
    setFormData(emptyForm);
    setEditing(null);
    setFormError('');
    setFormMode('create');
  };

  const openEdit = (c: Courier) => {
    setFormData({
      name: c.name, email: c.email, phone: c.phone || '', vehicleType: c.vehicleType,
      licensePlate: c.licensePlate || '', zone: c.zone || '', emergencyContact: c.emergencyContact || '', notes: c.notes || '',
    });
    setEditing(c);
    setFormError('');
    setFormMode('edit');
  };

  const save = async () => {
    setFormError('');
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) return setFormError('Name, email and phone are required.');
    if (!EMAIL_RE.test(formData.email.trim())) return setFormError('Enter a valid email address.');
    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      vehicle_type: formData.vehicleType,
      license_plate: formData.licensePlate.trim(),
      zone: formData.zone.trim(),
      emergency_contact: formData.emergencyContact.trim(),
      notes: formData.notes.trim(),
    };
    setSaving(true);
    try {
      if (formMode === 'edit' && editing) {
        await api.couriers.update(editing.courierId, payload);
        setFormMode(null);
      } else {
        const res = await api.couriers.create(payload);
        const c = res.courier;
        setFormMode(null);
        setBarcodeFor({
          justRegistered: true,
          courier: {
            id: String(c.id), courierId: c.courier_id, name: c.name, email: c.email, phone: c.phone,
            vehicleType: c.vehicle_type, licensePlate: c.license_plate || '', zone: c.zone || '', status: c.status,
            registeredAt: c.created_at?.split('T')[0] || '', totalDeliveries: 0, rating: Number(c.rating) || 5, avatar: c.avatar || '',
          },
        });
      }
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save the courier.');
    } finally {
      setSaving(false);
    }
  };

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — your browser blocked clipboard access.');
    }
  };

  const changeStatus = async (courier: Courier, status: string) => {
    if (status === courier.status) return;
    setBusyId(courier.courierId);
    setError('');
    try {
      await api.couriers.updateStatus(courier.courierId, status);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update the status.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting.courierId);
    try {
      await api.couriers.delete(deleting.courierId);
      setDeleting(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to delete the courier.');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => couriers.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || [c.name, c.courierId, c.zone, c.email, c.phone].some((v) => (v || '').toLowerCase().includes(q));
    return matchesSearch && (statusFilter === 'all' || c.status === statusFilter);
  }), [couriers, searchQuery, statusFilter]);

  const set = (k: keyof FormState, v: string) => setFormData((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0a192f]">Courier Management</h2>
          <p className="text-sm text-gray-500">{couriers.length} registered couriers</p>
        </div>
        <button onClick={openCreate} className="px-5 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] flex items-center gap-2 self-start sm:self-auto">
          <UserPlus size={16} /> Register Courier
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
          {error}
          <button onClick={() => setError('')} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      {formMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setFormMode(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-[#0a192f]">{formMode === 'edit' ? 'Edit Courier' : 'Register New Courier'}</h3>
                {formMode === 'edit' && editing && <p className="text-xs text-gray-400 font-mono">{editing.courierId}</p>}
                {formMode === 'create' && <p className="text-xs text-gray-400">The courier ID and barcode are issued when you register.</p>}
              </div>
              <button onClick={() => setFormMode(null)} className="p-1 hover:bg-gray-100 rounded-lg" aria-label="Close"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={labelCls}>Full name *</label><input className={inputCls} value={formData.name} onChange={(e) => set('name', e.target.value)} placeholder="John Smith" /></div>
                <div><label className={labelCls}>Email *</label><input type="email" className={inputCls} value={formData.email} onChange={(e) => set('email', e.target.value)} placeholder="john@example.com" /></div>
                <div><label className={labelCls}>Phone *</label><input type="tel" className={inputCls} value={formData.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+1 555-0100" /></div>
                <div>
                  <label className={labelCls}>Vehicle type</label>
                  <select className={`${inputCls} bg-white`} value={formData.vehicleType} onChange={(e) => set('vehicleType', e.target.value)}>
                    <option value="motorcycle">Motorcycle</option>
                    <option value="bicycle">Bicycle</option>
                    <option value="car">Car</option>
                    <option value="van">Van</option>
                    <option value="truck">Truck</option>
                  </select>
                </div>
                <div><label className={labelCls}>License plate</label><input className={inputCls} value={formData.licensePlate} onChange={(e) => set('licensePlate', e.target.value)} placeholder="TX-1234-AB" /></div>
                <div><label className={labelCls}>Assigned zone</label><input className={inputCls} value={formData.zone} onChange={(e) => set('zone', e.target.value)} placeholder="Downtown Houston" /></div>
                <div><label className={labelCls}>Emergency contact</label><input className={inputCls} value={formData.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} /></div>
                <div><label className={labelCls}>Notes</label><input className={inputCls} value={formData.notes} onChange={(e) => set('notes', e.target.value)} /></div>
              </div>
              {formMode === 'create' && <p className="text-xs text-gray-400">New couriers start as inactive — activate them when they are ready to take shipments.</p>}
              {formError && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setFormMode(null)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={save} disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] disabled:opacity-40 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {formMode === 'edit' ? 'Save changes' : 'Register & generate barcode'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {barcodeFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setBarcodeFor(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center space-y-4">
              {barcodeFor.justRegistered && (
                <>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto"><CheckCircle size={32} className="text-green-600" /></div>
                  <h3 className="text-lg font-bold text-[#0a192f]">Courier registered</h3>
                </>
              )}
              <p className="text-sm text-gray-500">{barcodeFor.courier.name}</p>
              <div className="bg-gray-50 rounded-lg p-5 space-y-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Courier ID & barcode</p>
                <p className="font-mono font-bold text-lg text-[#0a192f]">{barcodeFor.courier.courierId}</p>
                <div className="flex justify-center"><Barcode value={barcodeFor.courier.courierId} width={250} height={65} /></div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => copyId(barcodeFor.courier.courierId)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2">
                  <Copy size={14} /> {copied ? 'Copied!' : 'Copy ID'}
                </button>
                <button onClick={() => setBarcodeFor(null)} className="flex-1 px-4 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57]">Done</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleting(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[#0a192f]">Delete {deleting.name}?</h3>
            <p className="text-sm text-gray-600">The courier is removed permanently and unassigned from any shipment that is not yet completed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(null)} className="flex-1 px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
              <button onClick={confirmDelete} disabled={busyId === deleting.courierId} className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                {busyId === deleting.courierId ? 'Deleting…' : 'Delete courier'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID, zone, email or phone…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none bg-white">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="on-delivery">On delivery</option>
            <option value="on-break">On break</option>
            <option value="inactive">Inactive</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Courier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Vehicle</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Zone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Deliveries</th>
                <th className="text-right px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((courier) => (
                <tr key={courier.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={courier.avatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0a192f] truncate">{courier.name}</p>
                        <p className="text-xs text-gray-400 truncate">{courier.email} · {courier.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell"><span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">{courier.courierId}</span></td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <div className="flex items-center gap-2 text-sm text-gray-600 capitalize">{vehicleIcons[courier.vehicleType]} {courier.vehicleType}{courier.licensePlate ? <span className="text-xs text-gray-400 normal-case">· {courier.licensePlate}</span> : null}</div>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell"><span className="text-sm text-gray-600">{courier.zone || '—'}</span></td>
                  <td className="px-4 py-4">
                    <select value={courier.status} disabled={busyId === courier.courierId}
                      onChange={(e) => changeStatus(courier, e.target.value)}
                      aria-label={`Status of ${courier.name}`}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full border-0 cursor-pointer outline-none capitalize ${statusColors[courier.status]}`}>
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className="text-sm font-medium text-[#0a192f]">{courier.totalDeliveries}</span>
                    <span className="text-xs text-yellow-600 ml-2">★ {Number(courier.rating).toFixed(1)}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setBarcodeFor({ courier, justRegistered: false })} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-[#0a192f]" title="View barcode"><Eye size={16} /></button>
                      <button onClick={() => copyId(courier.courierId)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-[#0a192f]" title="Copy ID"><Copy size={16} /></button>
                      <button onClick={() => openEdit(courier)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600" title="Edit"><Edit2 size={16} /></button>
                      <button onClick={() => setDeleting(courier)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">No couriers found matching your criteria.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {copied && !barcodeFor && <div className="fixed bottom-4 right-4 z-50 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg shadow">ID copied</div>}
    </div>
  );
};

export default Couriers;
