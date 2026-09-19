import React, { useEffect, useMemo, useState } from 'react';
import {
  UserPlus, Search, X, Eye, ChevronDown, Building2, User, Trash2, Edit2,
  Mail, Phone, MapPin, Loader2,
} from 'lucide-react';
import * as api from '../../services/api';
import useEscapeKey from './components/useEscapeKey';

interface Customer {
  id: number;
  customer_id: string;
  company_name: string | null;
  contact_name: string;
  email: string;
  phone: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  postal_code: string | null;
  type: string;
  status: string;
  notes: string | null;
  created_at: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inputCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide';

const emptyForm = {
  contact_name: '', company_name: '', email: '', phone: '',
  address: '', city: '', state: '', country: 'US', postal_code: '',
  type: 'individual', status: 'active', notes: '',
};
type FormState = typeof emptyForm;

const initials = (name: string) => name.split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2);
const addressOf = (c: Customer) => [c.address, c.city, [c.state, c.postal_code].filter(Boolean).join(' '), c.country].filter(Boolean).join(', ');

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [formMode, setFormMode] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEscapeKey(() => setFormMode(null), formMode !== null);
  useEscapeKey(() => setViewing(null), viewing !== null);
  useEscapeKey(() => setDeleting(null), deleting !== null);

  const fetchCustomers = async () => {
    try {
      const res = await api.customers.list({ limit: 200 });
      setCustomers(res.customers || []);
      setLoadError('');
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const openCreate = () => { setForm(emptyForm); setEditing(null); setFormError(''); setFormMode('create'); };
  const openEdit = (c: Customer) => {
    setForm({
      contact_name: c.contact_name, company_name: c.company_name || '', email: c.email, phone: c.phone || '',
      address: c.address || '', city: c.city || '', state: c.state || '', country: c.country || 'US',
      postal_code: c.postal_code || '', type: c.type, status: c.status || 'active', notes: c.notes || '',
    });
    setEditing(c);
    setViewing(null);
    setFormError('');
    setFormMode('edit');
  };

  const save = async () => {
    setFormError('');
    if (!form.contact_name.trim() || !form.email.trim() || !form.phone.trim()) return setFormError('Contact name, email and phone are required.');
    if (!EMAIL_RE.test(form.email.trim())) return setFormError('Enter a valid email address.');
    if (!form.country.trim()) return setFormError('Country is required.');
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
    setSaving(true);
    try {
      if (formMode === 'edit' && editing) await api.customers.update(editing.customer_id, payload);
      else {
        const { status, ...createPayload } = payload;
        await api.customers.create(createPayload as any);
      }
      setFormMode(null);
      fetchCustomers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save the customer.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.customers.delete(deleting.customer_id);
      setDeleting(null);
      fetchCustomers();
    } catch (err: any) {
      setLoadError(err.message || 'Failed to delete the customer.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const filtered = useMemo(() => customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || [c.contact_name, c.customer_id, c.email, c.company_name, c.phone, c.city]
      .some((v) => (v || '').toLowerCase().includes(q));
    return matchesSearch && (typeFilter === 'all' || c.type === typeFilter);
  }), [customers, searchQuery, typeFilter]);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0a192f]">Customer Management</h2>
          <p className="text-sm text-gray-500">{customers.length} registered customers</p>
        </div>
        <button onClick={openCreate} className="px-5 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] flex items-center gap-2 self-start sm:self-auto">
          <UserPlus size={16} /> Register Customer
        </button>
      </div>

      {loadError && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
          {loadError}
          <button onClick={() => setLoadError('')} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      {formMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setFormMode(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-[#0a192f]">{formMode === 'edit' ? 'Edit Customer' : 'Register New Customer'}</h3>
                {editing && formMode === 'edit' && <p className="text-xs text-gray-400 font-mono">{editing.customer_id}</p>}
              </div>
              <button onClick={() => setFormMode(null)} className="p-1 hover:bg-gray-100 rounded-lg" aria-label="Close"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={labelCls}>Contact name *</label><input className={inputCls} value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder="John Smith" /></div>
                <div><label className={labelCls}>Company name</label><input className={inputCls} value={form.company_name} onChange={(e) => set('company_name', e.target.value)} placeholder="Optional" /></div>
                <div><label className={labelCls}>Email *</label><input type="email" className={inputCls} value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
                <div><label className={labelCls}>Phone *</label><input type="tel" className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
                <div className="sm:col-span-2"><label className={labelCls}>Address</label><input className={inputCls} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Street address" /></div>
                <div><label className={labelCls}>City</label><input className={inputCls} value={form.city} onChange={(e) => set('city', e.target.value)} /></div>
                <div><label className={labelCls}>State / region</label><input className={inputCls} value={form.state} onChange={(e) => set('state', e.target.value)} /></div>
                <div><label className={labelCls}>Postal code</label><input className={inputCls} value={form.postal_code} onChange={(e) => set('postal_code', e.target.value)} /></div>
                <div><label className={labelCls}>Country *</label><input className={inputCls} value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="US" /></div>
                <div>
                  <label className={labelCls}>Type</label>
                  <select className={`${inputCls} bg-white`} value={form.type} onChange={(e) => set('type', e.target.value)}>
                    <option value="individual">Individual</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                {formMode === 'edit' && (
                  <div>
                    <label className={labelCls}>Status</label>
                    <select className={`${inputCls} bg-white`} value={form.status} onChange={(e) => set('status', e.target.value)}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}
                <div className="sm:col-span-2"><label className={labelCls}>Notes</label>
                  <textarea rows={2} className={`${inputCls} resize-none`} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
                </div>
              </div>
              {formError && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setFormMode(null)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={save} disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] disabled:opacity-40 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {formMode === 'edit' ? 'Save changes' : 'Register customer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-[#0a192f]">Customer Details</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(viewing)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title="Edit"><Edit2 size={16} /></button>
                <button onClick={() => setViewing(null)} className="p-1 hover:bg-gray-100 rounded-lg" aria-label="Close"><X size={20} className="text-gray-500" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold ${viewing.type === 'business' ? 'bg-blue-600' : 'bg-emerald-600'}`}>{initials(viewing.contact_name)}</div>
                <div>
                  <p className="text-lg font-bold text-[#0a192f]">{viewing.contact_name}</p>
                  {viewing.company_name && <p className="text-sm text-gray-500">{viewing.company_name}</p>}
                  <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">{viewing.customer_id}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full capitalize ${viewing.status === 'inactive' ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>{viewing.status}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2 min-w-0"><Mail size={14} className="text-gray-400 mt-0.5 flex-shrink-0" /><div className="min-w-0"><p className="text-xs text-gray-500">Email</p><p className="font-medium text-[#0a192f] break-all">{viewing.email}</p></div></div>
                <div className="flex items-start gap-2"><Phone size={14} className="text-gray-400 mt-0.5" /><div><p className="text-xs text-gray-500">Phone</p><p className="font-medium text-[#0a192f]">{viewing.phone}</p></div></div>
                <div className="col-span-2 flex items-start gap-2"><MapPin size={14} className="text-gray-400 mt-0.5" /><div><p className="text-xs text-gray-500">Address</p><p className="font-medium text-[#0a192f]">{addressOf(viewing) || '—'}</p></div></div>
              </div>
              {viewing.notes && <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600"><p className="text-xs text-gray-500 mb-1">Notes</p>{viewing.notes}</div>}
              <p className="text-xs text-gray-400">Registered {new Date(viewing.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleting(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[#0a192f]">Delete {deleting.contact_name}?</h3>
            <p className="text-sm text-gray-600">The customer record is removed permanently. Their shipments are kept.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(null)} className="flex-1 px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteBusy} className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                {deleteBusy ? 'Deleting…' : 'Delete customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID, email, phone, company or city…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
        </div>
        <div className="relative">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none bg-white">
            <option value="all">All types</option>
            <option value="individual">Individual</option>
            <option value="business">Business</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Contact</th>
                <th className="text-right px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <tr key={c.id} className={`hover:bg-gray-50/50 transition-colors ${c.status === 'inactive' ? 'opacity-60' : ''}`}>
                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${c.type === 'business' ? 'bg-blue-600' : 'bg-emerald-600'}`}>{initials(c.contact_name)}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0a192f] truncate">{c.contact_name}</p>
                        {c.company_name && <p className="text-xs text-gray-400 truncate">{c.company_name}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell"><span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">{c.customer_id}</span></td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full capitalize ${c.type === 'business' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {c.type === 'business' ? <Building2 size={12} /> : <User size={12} />}{c.type}
                    </span>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell"><span className="text-sm text-gray-600">{[c.city, c.state, c.country].filter(Boolean).join(', ') || '—'}</span></td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <p className="text-sm text-gray-600">{c.email}</p>
                    <p className="text-xs text-gray-400">{c.phone}</p>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewing(c)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-[#0a192f]" title="View details"><Eye size={16} /></button>
                      <button onClick={() => openEdit(c)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600" title="Edit"><Edit2 size={16} /></button>
                      <button onClick={() => setDeleting(c)} className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600" title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">No customers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Customers;
