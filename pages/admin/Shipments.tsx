import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Search, Plus, Pause, Play, Eye, MapPin, Edit2, Trash2,
  CheckCircle, Clock, Truck, RotateCcw, ArrowRight,
} from 'lucide-react';
import { Shipment, Courier, ShipmentStatus, STATUS_LABELS, formatDateTime } from './types';
import * as api from '../../services/api';
import PauseModal from './components/PauseModal';
import CreateShipmentModal from './components/CreateShipmentModal';
import EditShipmentModal from './components/EditShipmentModal';
import ShipmentDetailModal from './components/ShipmentDetailModal';

interface ShipmentsProps {
  shipments: Shipment[];
  couriers: Courier[];
  onRefresh: () => void;
  search: string;
  onSearchChange: (value: string) => void;
}

const statusConfig: Record<ShipmentStatus, { color: string; icon: React.ReactNode }> = {
  pending: { color: 'bg-gray-100 text-gray-700', icon: <Clock size={12} /> },
  'picked-up': { color: 'bg-purple-100 text-purple-700', icon: <Package size={12} /> },
  'in-transit': { color: 'bg-blue-100 text-blue-700', icon: <Truck size={12} /> },
  'out-for-delivery': { color: 'bg-cyan-100 text-cyan-700', icon: <MapPin size={12} /> },
  delivered: { color: 'bg-green-100 text-green-700', icon: <CheckCircle size={12} /> },
  returned: { color: 'bg-red-100 text-red-700', icon: <RotateCcw size={12} /> },
  paused: { color: 'bg-amber-100 text-amber-700', icon: <Pause size={12} /> },
};

const MODE_ICON: Record<string, string> = { road: '🚛', air: '✈️', sea: '🚢' };

function modesOf(s: Shipment): string {
  const segs = s.raw.multi_modal_segments;
  if (!Array.isArray(segs) || segs.length === 0) return '🚛';
  return Array.from(new Set(segs.map((x: any) => x?.mode).filter(Boolean))).map((m) => MODE_ICON[m as string] || '').join(' ');
}

interface Confirm {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  run: () => Promise<unknown>;
  success: string;
}

const Shipments: React.FC<ShipmentsProps> = ({ shipments, couriers, onRefresh, search, onSearchChange }) => {
  const [statusFilter, setStatusFilter] = useState<'all' | ShipmentStatus>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [pauseId, setPauseId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Always read the latest copy from the list (it refreshes after every action).
  const byId = (id: string | null) => (id ? shipments.find((s) => s.id === id) || null : null);
  const detail = byId(detailId);
  const editing = byId(editId);
  const pausing = byId(pauseId);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  };
  const changed = (msg: string) => {
    notify(msg);
    onRefresh();
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await confirm.run();
      changed(confirm.success);
      setConfirm(null);
    } catch (e: any) {
      notify(`❌ ${e.message || 'Action failed.'}`);
    } finally {
      setConfirmBusy(false);
    }
  };

  const requestStatus = (s: Shipment, status: ShipmentStatus) => {
    if (status === s.status) return;
    if (status === 'paused') { setPauseId(s.id); return; }
    const label = STATUS_LABELS[status];
    const messages: Partial<Record<ShipmentStatus, string>> = {
      'pending': 'The journey is reset: the shipment goes back to waiting for pickup and its progress is cleared.',
      'picked-up': s.status === 'pending' ? 'The journey starts now and the arrival time is calculated from the route.' : 'The shipment is marked as picked up.',
      'in-transit': s.isPaused ? 'The hold is lifted and the shipment continues from where it stopped.' : 'The shipment is marked as in transit.',
      'out-for-delivery': 'The shipment jumps to its final delivery leg.',
      'delivered': 'The shipment is completed and the courier is released.',
      'returned': 'The shipment is marked as returned to the sender.',
    };
    setConfirm({
      title: `Mark ${s.trackingId} as ${label}?`,
      message: `${messages[status] || ''} The sender and receiver are emailed.`,
      confirmLabel: `Mark ${label.toLowerCase()}`,
      danger: status === 'returned' || status === 'pending',
      run: () => api.shipments.updateStatus(s.trackingId, { status }),
      success: `✅ ${s.trackingId} is now ${label.toLowerCase()}`,
    });
  };

  const requestDelete = (s: Shipment) => {
    setConfirm({
      title: `Delete ${s.trackingId}?`,
      message: 'The shipment and its tracking history are permanently removed. Customers will no longer be able to track it.',
      confirmLabel: 'Delete shipment',
      danger: true,
      run: async () => {
        await api.shipments.delete(s.trackingId);
        if (detailId === s.id) setDetailId(null);
      },
      success: `🗑️ ${s.trackingId} deleted`,
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shipments.filter((s) => {
      const matchesSearch = !q || [s.trackingId, s.sender, s.receiver, s.origin, s.destination, s.courierName]
        .some((v) => (v || '').toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [shipments, search, statusFilter]);

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className={`fixed top-4 right-4 z-[80] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold border ${toast.startsWith('❌') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0a192f]">Shipment Management</h2>
          <p className="text-sm text-gray-500">{shipments.length} total shipments</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 flex items-center gap-2 self-start sm:self-auto">
          <Plus size={16} /> Create Shipment
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {(Object.keys(statusConfig) as ShipmentStatus[]).map((status) => {
          const count = shipments.filter((s) => s.status === status).length;
          const conf = statusConfig[status];
          return (
            <button key={status} onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={`p-3 rounded-lg border text-left transition-all ${statusFilter === status ? 'border-[#0a192f] bg-[#0a192f]/5 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${conf.color}`}>{conf.icon} {STATUS_LABELS[status]}</span>
              <p className="text-xl font-bold text-[#0a192f] mt-2">{count}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by tracking ID, sender, receiver, city or courier…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
        </div>
        {(search || statusFilter !== 'all') && (
          <button onClick={() => { onSearchChange(''); setStatusFilter('all'); }} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Clear filters
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tracking ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Route</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Courier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Progress</th>
                <th className="text-right px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((s) => {
                const conf = statusConfig[s.status];
                const finished = s.status === 'delivered' || s.status === 'returned';
                return (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 sm:px-6 py-4">
                      <button onClick={() => setDetailId(s.id)} className="text-sm font-mono font-medium text-[#0a192f] hover:text-blue-600">{s.trackingId}</button>
                      <p className="text-xs text-gray-400">{modesOf(s)} {s.type} · {s.weight}</p>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <span className="truncate max-w-[130px]" title={s.origin}>{s.origin}</span>
                        <ArrowRight size={12} className="text-gray-400 flex-shrink-0" />
                        <span className="truncate max-w-[130px]" title={s.destination}>{s.destination}</span>
                      </div>
                      <p className="text-[11px] text-gray-400">{finished ? `Completed ${formatDateTime(s.raw.actual_delivery)}` : `ETA ${formatDateTime(s.estimatedDelivery)}`}</p>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell"><p className="text-sm text-gray-600">{s.courierName}</p></td>
                    <td className="px-4 py-4">
                      <select value={s.status} onChange={(e) => requestStatus(s, e.target.value as ShipmentStatus)}
                        aria-label={`Status of ${s.trackingId}`}
                        className={`px-2.5 py-1 text-xs font-medium rounded-full border-0 cursor-pointer outline-none ${conf.color}`}>
                        {(Object.keys(STATUS_LABELS) as ShipmentStatus[]).map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
                      </select>
                      {s.isPaused && s.pauseCategory && <p className="text-[10px] text-amber-600 mt-0.5 truncate max-w-[140px]" title={s.pauseReason || s.pauseCategory}>{s.pauseCategory}</p>}
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${s.isPaused ? 'bg-amber-500' : finished ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, s.progress)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{Math.round(s.progress)}%</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setDetailId(s.id)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-[#0a192f]" title="View details"><Eye size={16} /></button>
                        <button onClick={() => setEditId(s.id)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600" title="Edit"><Edit2 size={16} /></button>
                        {!finished && s.status !== 'pending' && (
                          <button onClick={() => setPauseId(s.id)} className={`p-2 hover:bg-gray-100 rounded-lg ${s.isPaused ? 'text-green-600' : 'text-amber-500'}`} title={s.isPaused ? 'Resume' : 'Pause'}>
                            {s.isPaused ? <Play size={16} /> : <Pause size={16} />}
                          </button>
                        )}
                        <button onClick={() => requestDelete(s)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">No shipments found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateShipmentModal
        open={showCreate}
        couriers={couriers}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => { setShowCreate(false); changed(`📦 Shipment ${id || ''} created`); }}
      />

      <ShipmentDetailModal
        shipment={detail}
        couriers={couriers}
        onClose={() => setDetailId(null)}
        onChanged={changed}
        onEdit={(s) => setEditId(s.id)}
        onPause={(s) => setPauseId(s.id)}
        onStatus={requestStatus}
        onDelete={requestDelete}
      />

      <EditShipmentModal shipment={editing} onClose={() => setEditId(null)} onSaved={changed} />
      <PauseModal shipment={pausing} onClose={() => setPauseId(null)} onDone={changed} />

      {confirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => !confirmBusy && setConfirm(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[#0a192f]">{confirm.title}</h3>
            <p className="text-sm text-gray-600">{confirm.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} disabled={confirmBusy} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={runConfirm} disabled={confirmBusy}
                className={`flex-1 px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 ${confirm.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-[#0a192f] hover:bg-[#112d57]'}`}>
                {confirmBusy ? 'Working…' : confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shipments;
