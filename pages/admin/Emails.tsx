import React, { useState, useEffect } from 'react';
import { Mail, Search, Send, X, Eye, Trash2, Clock, CheckCircle, XCircle, AlertCircle, Loader2, Edit3, ChevronDown } from 'lucide-react';
import * as api from '../../services/api';
import { useDebounced } from './components/useDebounced';

interface EmailDraft {
  id: number;
  type: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  html_body: string;
  text_body: string;
  status: string;
  related_tracking_id: string;
  created_at: string;
  sent_at: string;
  metadata: any;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'bg-amber-100 text-amber-700', icon: <Clock size={12} />, label: 'Draft' },
  sent: { color: 'bg-green-100 text-green-700', icon: <CheckCircle size={12} />, label: 'Sent' },
  cancelled: { color: 'bg-gray-100 text-gray-500', icon: <XCircle size={12} />, label: 'Cancelled' },
};

const Emails: React.FC = () => {
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('draft');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDraft, setSelectedDraft] = useState<EmailDraft | null>(null);
  const [previewDraft, setPreviewDraft] = useState<EmailDraft | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [sending, setSending] = useState<number | null>(null);
  const [error, setError] = useState('');
  const debouncedSearch = useDebounced(searchQuery);

  const fetchDrafts = async () => {
    try {
      const res = await api.emails.adminListDrafts({
        status: statusFilter,
        search: debouncedSearch.trim() || undefined,
      });
      setDrafts(res.drafts || []);
      setCounts(res.counts || {});
    } catch (err: any) {
      setError(err.message || 'Failed to load emails.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDrafts(); }, [statusFilter, debouncedSearch]);

  const handleSend = async (id: number) => {
    if (!confirm('Are you sure you want to send this email?')) return;
    setSending(id);
    try {
      const res = await api.emails.adminSendDraft(id);
      if (res.error) throw new Error(res.error);
      fetchDrafts();
      setSelectedDraft(null);
      setPreviewDraft(null);
    } catch (err: any) {
      setError(err.message || 'Failed to send the email.');
    } finally {
      setSending(null);
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Cancel this email draft?')) return;
    try {
      await api.emails.adminCancelDraft(id);
      fetchDrafts();
      setSelectedDraft(null);
      setPreviewDraft(null);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel the draft.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Permanently delete this email?')) return;
    try {
      await api.emails.adminDeleteDraft(id);
      if (previewDraft?.id === id) setPreviewDraft(null);
      fetchDrafts();
    } catch (err: any) {
      setError(err.message || 'Failed to delete the email.');
    }
  };

  const handleUpdateSubject = async (id: number) => {
    if (!editSubject.trim()) { setError('The subject cannot be empty.'); return; }
    try {
      await api.emails.adminUpdateDraft(id, { subject: editSubject.trim() });
      fetchDrafts();
      setSelectedDraft(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update the draft.');
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#0a192f]">Email Management</h2>
        <p className="text-sm text-gray-500">Review and approve outgoing emails before they are sent to clients</p>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
          {error}
          <button onClick={() => setError('')} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'draft', label: 'Pending', icon: <Clock size={16} />, count: counts.draft_count || 0, color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { key: 'sent', label: 'Sent', icon: <CheckCircle size={16} />, count: counts.sent_count || 0, color: 'text-green-600 bg-green-50 border-green-200' },
          { key: 'cancelled', label: 'Cancelled', icon: <XCircle size={16} />, count: counts.cancelled_count || 0, color: 'text-gray-600 bg-gray-50 border-gray-200' },
          { key: 'all', label: 'All', icon: <Mail size={16} />, count: counts.total || 0, color: 'text-blue-600 bg-blue-50 border-blue-200' },
        ].map(card => (
          <button
            key={card.key}
            onClick={() => setStatusFilter(card.key)}
            className={`p-3 rounded-lg border text-left transition-all ${
              statusFilter === card.key ? 'border-[#0a192f] bg-[#0a192f]/5 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
          >
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${card.color} px-2 py-0.5 rounded-full`}>
              {card.icon} {card.label}
            </span>
            <p className="text-xl font-bold text-[#0a192f] mt-2">{card.count}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by recipient, subject..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-600" />
        </div>
      )}

      {/* Email List */}
      {!loading && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recipient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Subject</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Date</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {drafts.map(draft => {
                  const sc = statusConfig[draft.status] || statusConfig.draft;
                  return (
                    <tr key={draft.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <p className="text-sm font-medium text-[#0a192f] truncate max-w-[180px]">{draft.recipient_email}</p>
                        {draft.recipient_name && <p className="text-xs text-gray-400">{draft.recipient_name}</p>}
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <p className="text-sm text-gray-600 truncate max-w-[250px]">{draft.subject}</p>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium capitalize">{draft.type.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${sc.color}`}>
                          {sc.icon} {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell">
                        <p className="text-xs text-gray-500">{formatDate(draft.created_at)}</p>
                        {draft.sent_at && <p className="text-xs text-green-600 mt-0.5">Sent: {formatDate(draft.sent_at)}</p>}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setPreviewDraft(draft)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-[#0a192f]" title="Preview">
                            <Eye size={16} />
                          </button>
                          {draft.status === 'draft' && (
                            <>
                              <button onClick={() => { setSelectedDraft(draft); setEditSubject(draft.subject); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600" title="Edit">
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => handleSend(draft.id)}
                                disabled={sending === draft.id}
                                className="p-2 hover:bg-green-50 rounded-lg text-green-600 hover:text-green-700 disabled:opacity-40"
                                title="Send"
                              >
                                {sending === draft.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                              </button>
                              <button onClick={() => handleCancel(draft.id)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-amber-600" title="Cancel">
                                <XCircle size={16} />
                              </button>
                            </>
                          )}
                          <button onClick={() => handleDelete(draft.id)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {drafts.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">No email drafts found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {selectedDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedDraft(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-[#0a192f]">Edit Email Draft</h3>
              <button onClick={() => setSelectedDraft(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Recipient</label>
                <input type="text" value={selectedDraft.recipient_email} readOnly className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Subject</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none"
                />
              </div>
              {selectedDraft.related_tracking_id && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Related Shipment: <span className="font-mono">{selectedDraft.related_tracking_id}</span></p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setSelectedDraft(null)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => handleUpdateSubject(selectedDraft.id)} className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 flex items-center justify-center gap-2">
                  <Edit3 size={14} /> Save Changes
                </button>
                <button
                  onClick={() => handleSend(selectedDraft.id)}
                  disabled={sending === selectedDraft.id}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {sending === selectedDraft.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Send Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPreviewDraft(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-[#0a192f]">Email Preview</h3>
                <p className="text-xs text-gray-500 mt-0.5">To: {previewDraft.recipient_email}</p>
              </div>
              <button onClick={() => setPreviewDraft(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Subject</p>
                <p className="text-sm font-medium text-[#0a192f]">{previewDraft.subject}</p>
              </div>
              {/* Sandboxed: stored email HTML can never run scripts inside the admin. */}
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={previewDraft.html_body}
                className="w-full h-[60vh] border border-gray-200 rounded-lg bg-white"
              />
              {previewDraft.status === 'draft' && (
                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                  <button onClick={() => handleCancel(previewDraft.id)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2">
                    <XCircle size={14} /> Cancel Draft
                  </button>
                  <button
                    onClick={() => handleSend(previewDraft.id)}
                    disabled={sending === previewDraft.id}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {sending === previewDraft.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Approve & Send
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Emails;
