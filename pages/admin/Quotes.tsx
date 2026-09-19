import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Search, Filter, RefreshCw, ChevronDown, X, Clock, CheckCircle,
  XCircle, Eye, Trash2, Send, Mail, Phone, Building2, User, MessageSquare,
  AlertCircle, Loader2, ArrowRight, Tag, Calendar, StickyNote, Plane, Ship,
  Truck, Package, Warehouse, Box, PawPrint
} from 'lucide-react';
import { quotes } from '../../services/api';
import { useDebounced } from './components/useDebounced';

interface Quote {
  id: number;
  full_name: string;
  company: string | null;
  email: string;
  phone: string | null;
  service_type: string;
  details: string | null;
  status: string;
  admin_notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
}

interface QuoteStats {
  total: number;
  new_count: number;
  reviewing_count: number;
  quoted_count: number;
  accepted_count: number;
  rejected_count: number;
  closed_count: number;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  new: { label: 'New', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  reviewing: { label: 'Reviewing', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: <Eye className="w-3.5 h-3.5" /> },
  quoted: { label: 'Quoted', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: <Send className="w-3.5 h-3.5" /> },
  accepted: { label: 'Accepted', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: <XCircle className="w-3.5 h-3.5" /> },
  closed: { label: 'Closed', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: <X className="w-3.5 h-3.5" /> },
};

const serviceIcons: Record<string, React.ReactNode> = {
  'Air Freight': <Plane className="w-4 h-4" />,
  'Ocean Freight': <Ship className="w-4 h-4" />,
  'Land Transport': <Truck className="w-4 h-4" />,
  'Express Courier': <Package className="w-4 h-4" />,
  'Warehousing & Distribution': <Warehouse className="w-4 h-4" />,
  'Specialized Cargo': <Box className="w-4 h-4" />,
  'Animal & Pet Transport': <PawPrint className="w-4 h-4" />,
};

const QuotesPage: React.FC = () => {
  const [quoteList, setQuoteList] = useState<Quote[]>([]);
  const [stats, setStats] = useState<QuoteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterService, setFilterService] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const debouncedSearch = useDebounced(search);

  const fetchQuotes = useCallback(async () => {
    try {
      setRefreshing(true);
      const [listRes, statsRes] = await Promise.all([
        quotes.adminList({ status: filterStatus || undefined, service_type: filterService || undefined, search: debouncedSearch.trim() || undefined }),
        quotes.adminStats(),
      ]);
      setQuoteList(listRes.quotes || []);
      setStats(statsRes.stats || null);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load quote requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterStatus, filterService, debouncedSearch]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const handleStatusChange = async (id: number, status: string) => {
    try {
      setSaving(true);
      await quotes.adminUpdateStatus(id, { status });
      await fetchQuotes();
      if (selectedQuote?.id === id) {
        const res = await quotes.adminGet(id);
        setSelectedQuote(res.quote);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update the status.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedQuote) return;
    try {
      setSaving(true);
      await quotes.adminUpdateNotes(selectedQuote.id, editNotes);
      await fetchQuotes();
      const res = await quotes.adminGet(selectedQuote.id);
      setSelectedQuote(res.quote);
    } catch (err: any) {
      setError(err.message || 'Failed to save the notes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this quote request?')) return;
    try {
      await quotes.adminDelete(id);
      setShowDetail(false);
      setSelectedQuote(null);
      await fetchQuotes();
    } catch (err: any) {
      setError(err.message || 'Failed to delete the quote.');
    }
  };

  const openDetail = (quote: Quote) => {
    setSelectedQuote(quote);
    setEditNotes(quote.admin_notes || '');
    setShowDetail(true);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0a192f]">Quote Requests</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and process incoming quote requests from service pages</p>
        </div>
        <button
          onClick={fetchQuotes}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
          {error}
          <button onClick={() => setError('')} aria-label="Dismiss"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'bg-gray-50 border-gray-200 text-gray-700' },
            { label: 'New', value: stats.new_count, color: 'bg-blue-50 border-blue-200 text-blue-700' },
            { label: 'Reviewing', value: stats.reviewing_count, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
            { label: 'Quoted', value: stats.quoted_count, color: 'bg-purple-50 border-purple-200 text-purple-700' },
            { label: 'Accepted', value: stats.accepted_count, color: 'bg-green-50 border-green-200 text-green-700' },
            { label: 'Rejected', value: stats.rejected_count, color: 'bg-red-50 border-red-200 text-red-700' },
            { label: 'Closed', value: stats.closed_count, color: 'bg-gray-50 border-gray-200 text-gray-600' },
          ].map((s) => (
            <div key={s.label} className={`p-3 rounded-lg border ${s.color} text-center`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs font-medium opacity-75">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border rounded-lg transition-colors ${
              showFilters || filterStatus || filterService ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" /> Filters
            {(filterStatus || filterService) && (
              <span className="w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                {(filterStatus ? 1 : 0) + (filterService ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
                <div className="min-w-[180px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Statuses</option>
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Service Type</label>
                  <select
                    value={filterService}
                    onChange={(e) => setFilterService(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Services</option>
                    {Object.keys(serviceIcons).map((svc) => (
                      <option key={svc} value={svc}>{svc}</option>
                    ))}
                  </select>
                </div>
                {(filterStatus || filterService) && (
                  <div className="flex items-end">
                    <button
                      onClick={() => { setFilterStatus(''); setFilterService(''); }}
                      className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : quoteList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No quote requests found</p>
            <p className="text-sm text-gray-400 mt-1">Quote requests from service pages will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Contact</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Service</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Submitted</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quoteList.map((q) => {
                  const sc = statusConfig[q.status] || statusConfig.new;
                  return (
                    <tr
                      key={q.id}
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => openDetail(q)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-[#0a192f] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {q.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#0a192f] truncate">{q.full_name}</p>
                            <p className="text-xs text-gray-400 truncate">{q.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 text-gray-700">
                          {serviceIcons[q.service_type] || <FileText className="w-4 h-4" />}
                          <span className="text-xs font-medium">{q.service_type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${sc.bg} ${sc.color}`}>
                          {sc.icon} {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs text-gray-500">{timeAgo(q.created_at)}</p>
                        <p className="text-[10px] text-gray-400">{formatDate(q.created_at)}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); openDetail(q); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {showDetail && selectedQuote && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setShowDetail(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-[#0a192f]">Quote #{selectedQuote.id}</h2>
                  <p className="text-xs text-gray-500">{formatDate(selectedQuote.created_at)}</p>
                </div>
                <button
                  onClick={() => setShowDetail(false)}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <div>
                    {(() => {
                      const sc = statusConfig[selectedQuote.status] || statusConfig.new;
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border ${sc.bg} ${sc.color}`}>
                          {sc.icon} {sc.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    {serviceIcons[selectedQuote.service_type] || <FileText className="w-4 h-4" />}
                    <span className="text-sm font-medium">{selectedQuote.service_type}</span>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-[#0a192f] flex items-center gap-2">
                    <User className="w-4 h-4" /> Contact Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Name</p>
                        <p className="text-sm font-medium text-[#0a192f]">{selectedQuote.full_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Mail className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Email</p>
                        <p className="text-sm font-medium text-[#0a192f] truncate">{selectedQuote.email}</p>
                      </div>
                    </div>
                    {selectedQuote.company && (
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Company</p>
                          <p className="text-sm font-medium text-[#0a192f]">{selectedQuote.company}</p>
                        </div>
                      </div>
                    )}
                    {selectedQuote.phone && (
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Phone className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Phone</p>
                          <p className="text-sm font-medium text-[#0a192f]">{selectedQuote.phone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Shipment Details */}
                {selectedQuote.details && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-[#0a192f] flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" /> Shipment Details
                    </h3>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedQuote.details}</p>
                    </div>
                  </div>
                )}

                {/* Update Status */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-[#0a192f] flex items-center gap-2">
                    <Tag className="w-4 h-4" /> Update Status
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                      <button
                        key={key}
                        disabled={saving || selectedQuote.status === key}
                        onClick={() => handleStatusChange(selectedQuote.id, key)}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                          selectedQuote.status === key
                            ? `${cfg.bg} ${cfg.color} ring-2 ring-offset-1 ring-current`
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        } disabled:opacity-50`}
                      >
                        {cfg.icon} {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Admin Notes */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-[#0a192f] flex items-center gap-2">
                    <StickyNote className="w-4 h-4" /> Admin Notes
                  </h3>
                  <textarea
                    rows={4}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add internal notes about this quote request..."
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  />
                  <button
                    onClick={handleSaveNotes}
                    disabled={saving || editNotes === (selectedQuote.admin_notes || '')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#0a192f] text-white rounded-lg hover:bg-[#112d57] transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Save Notes
                  </button>
                </div>

                {/* Processing Info */}
                {selectedQuote.processed_by && (
                  <div className="bg-green-50 border border-green-100 rounded-lg p-4 space-y-1">
                    <p className="text-xs text-green-600 font-medium">Processed by {selectedQuote.processed_by}</p>
                    {selectedQuote.processed_at && (
                      <p className="text-xs text-green-500">{formatDate(selectedQuote.processed_at)}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <button
                  onClick={() => handleDelete(selectedQuote.id)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <a
                  href={`mailto:${selectedQuote.email}?subject=Re: ${selectedQuote.service_type} Quote Request&body=Dear ${selectedQuote.full_name},%0D%0A%0D%0AThank you for your interest in our ${selectedQuote.service_type} services.%0D%0A%0D%0A`}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
                >
                  <Mail className="w-4 h-4" /> Reply via Email
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuotesPage;
