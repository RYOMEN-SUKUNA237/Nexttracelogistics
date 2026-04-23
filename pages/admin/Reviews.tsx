import React, { useState, useEffect, useCallback } from 'react';
import { Star, CheckCircle, XCircle, Trash2, Search, Clock, Eye, Loader2, MessageSquare, Filter } from 'lucide-react';
import * as api from '../../services/api';

interface Review {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar: string;
  text: string;
  rating: number;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  approved_at: string | null;
}

const AdminReviews: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.reviews.adminList({
        status: filter !== 'all' ? filter : undefined,
        search: search || undefined,
      });
      setReviews(data.reviews);
      setCounts(data.counts);
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleApprove = async (id: number) => {
    setActionLoading(id);
    try {
      await api.reviews.adminApprove(id);
      await fetchReviews();
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionLoading(id);
    try {
      await api.reviews.adminReject(id);
      await fetchReviews();
    } catch (err) {
      console.error('Failed to reject:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this review?')) return;
    setActionLoading(id);
    try {
      await api.reviews.adminDelete(id);
      await fetchReviews();
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      approved: 'bg-green-100 text-green-700 border-green-200',
      rejected: 'bg-red-100 text-red-700 border-red-200',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status === 'pending' && <Clock className="w-3 h-3" />}
        {status === 'approved' && <CheckCircle className="w-3 h-3" />}
        {status === 'rejected' && <XCircle className="w-3 h-3" />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0a192f]">Customer Reviews</h2>
          <p className="text-sm text-gray-500 mt-1">Manage and moderate customer reviews before they go live.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', count: counts.total, color: 'bg-blue-50 text-blue-700', icon: <MessageSquare className="w-5 h-5" /> },
          { label: 'Pending', count: counts.pending, color: 'bg-yellow-50 text-yellow-700', icon: <Clock className="w-5 h-5" /> },
          { label: 'Approved', count: counts.approved, color: 'bg-green-50 text-green-700', icon: <CheckCircle className="w-5 h-5" /> },
          { label: 'Rejected', count: counts.rejected, color: 'bg-red-50 text-red-700', icon: <XCircle className="w-5 h-5" /> },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl p-4 ${stat.color} border`}>
            <div className="flex items-center gap-2 mb-1">
              {stat.icon}
              <span className="text-xs font-semibold uppercase tracking-wide">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold">{stat.count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or content..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {['all', 'pending', 'approved', 'rejected'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
                filter === f ? 'bg-white text-[#0a192f] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'pending' && counts.pending > 0 && (
                <span className="ml-1.5 bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{counts.pending}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No reviews found</p>
          <p className="text-gray-400 text-sm mt-1">
            {filter !== 'all' ? `No ${filter} reviews at the moment.` : 'No reviews have been submitted yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <div
              key={review.id}
              className={`bg-white rounded-xl border p-5 transition-all hover:shadow-md ${
                review.status === 'pending' ? 'border-yellow-200 border-l-4 border-l-yellow-400' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start gap-4">
                <img src={review.avatar} alt={review.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-semibold text-[#0a192f] text-sm">{review.name}</h4>
                    {statusBadge(review.status)}
                  </div>
                  <p className="text-xs text-gray-500">{review.role} · {review.email}</p>
                  <div className="flex gap-0.5 my-2">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`w-4 h-4 ${s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                    ))}
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed italic">"{review.text}"</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Submitted: {new Date(review.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {review.approved_at && ` · Approved: ${new Date(review.approved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {review.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(review.id)}
                        disabled={actionLoading === review.id}
                        className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                        title="Approve & Publish"
                      >
                        {actionLoading === review.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleReject(review.id)}
                        disabled={actionLoading === review.id}
                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                        title="Reject"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {review.status === 'rejected' && (
                    <button
                      onClick={() => handleApprove(review.id)}
                      disabled={actionLoading === review.id}
                      className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                      title="Approve & Publish"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  {review.status === 'approved' && (
                    <button
                      onClick={() => handleReject(review.id)}
                      disabled={actionLoading === review.id}
                      className="p-2 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 transition-colors disabled:opacity-50"
                      title="Unpublish"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(review.id)}
                    disabled={actionLoading === review.id}
                    className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                    title="Delete Permanently"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminReviews;
