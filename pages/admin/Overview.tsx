import React, { useState, useEffect } from 'react';
import { 
  Users, Package, Truck, CheckCircle, AlertCircle, Clock, TrendingUp, 
  ArrowUpRight, Activity, MapPin, Loader2, RefreshCw
} from 'lucide-react';
import { Courier, Shipment } from './types';
import * as api from '../../services/api';

interface OverviewProps {
  couriers: Courier[];
  shipments: Shipment[];
  onNavigate: (page: string) => void;
}

interface DashboardStats {
  totalCouriers: number;
  activeCouriers: number;
  totalShipments: number;
  inTransit: number;
  delivered: number;
  pending: number;
  paused: number;
  returned: number;
  totalCustomers: number;
  deliveredToday: number;
  createdToday: number;
  couriersRegisteredToday: number;
}

interface ActivityItem {
  id: number;
  status: string;
  location: string | null;
  notes: string | null;
  created_at: string;
  sender_name: string | null;
  receiver_name: string | null;
  origin: string | null;
  destination: string | null;
  tracking_id?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

const statusColor: Record<string, string> = {
  'delivered': 'bg-green-500',
  'in-transit': 'bg-blue-500',
  'out-for-delivery': 'bg-indigo-500',
  'picked-up': 'bg-purple-500',
  'pending': 'bg-gray-400',
  'paused': 'bg-amber-500',
  'returned': 'bg-red-500',
};

const Overview: React.FC<OverviewProps> = ({ couriers, shipments, onNavigate }) => {
  const [liveStats, setLiveStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const activeCouriers = couriers.filter(c => c.status === 'active' || c.status === 'on-delivery').length;
  const inTransit = shipments.filter(s => s.status === 'in-transit' || s.status === 'out-for-delivery').length;
  const delivered = shipments.filter(s => s.status === 'delivered').length;
  const pending = shipments.filter(s => s.status === 'pending').length;
  const paused = shipments.filter(s => s.isPaused).length;

  const fetchStats = async () => {
    try {
      const data = await api.dashboard.stats();
      setLiveStats(data.stats);
    } catch (err) {
      console.error('Stats fetch error:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchActivity = async () => {
    try {
      const data = await api.dashboard.recentActivity(15);
      setActivity(data.activity || []);
    } catch (err) {
      console.error('Activity fetch error:', err);
    } finally {
      setLoadingActivity(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchActivity();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchStats();
      fetchActivity();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const todayDelivered = liveStats?.deliveredToday ?? 0;
  const todayCreated = liveStats?.createdToday ?? 0;

  const stats = [
    {
      label: 'Total Couriers',
      value: (liveStats?.totalCouriers ?? couriers.length).toString(),
      icon: <Users size={22} />,
      change: liveStats ? `${liveStats.couriersRegisteredToday} new today` : '...',
      up: true,
      color: 'bg-blue-50 text-blue-600'
    },
    {
      label: 'Active Shipments',
      value: (liveStats?.inTransit ?? inTransit).toString(),
      icon: <Truck size={22} />,
      change: liveStats ? `${todayCreated} created today` : '...',
      up: true,
      color: 'bg-emerald-50 text-emerald-600'
    },
    {
      label: 'Delivered',
      value: (liveStats?.delivered ?? delivered).toString(),
      icon: <CheckCircle size={22} />,
      change: liveStats ? `${todayDelivered} today` : '...',
      up: true,
      color: 'bg-green-50 text-green-600'
    },
    {
      label: 'Pending Pickup',
      value: (liveStats?.pending ?? pending).toString(),
      icon: <Clock size={22} />,
      change: liveStats?.pending && liveStats.pending > 0 ? 'Needs attention' : 'All clear',
      up: !liveStats?.pending || liveStats.pending === 0,
      color: 'bg-amber-50 text-amber-600'
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-5 sm:p-6 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-lg ${stat.color}`}>{stat.icon}</div>
              <span className={`text-xs font-medium flex items-center gap-0.5 ${stat.up ? 'text-green-600' : 'text-amber-600'}`}>
                {stat.up ? <ArrowUpRight size={14} /> : <AlertCircle size={14} />}
                {loadingStats ? '...' : stat.change}
              </span>
            </div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{stat.label}</h3>
            {loadingStats ? (
              <div className="w-16 h-8 bg-gray-100 animate-pulse rounded" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-[#0a192f]">{stat.value}</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity — Live */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-100 shadow-sm">
          <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-bold text-[#0a192f] flex items-center gap-2"><Activity size={18} /> Recent Activity</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-500 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
                Live
              </span>
              <button
                onClick={() => { fetchStats(); fetchActivity(); }}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {loadingActivity ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 sm:px-6 py-4 flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full flex-shrink-0 bg-gray-200 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-gray-100 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-1/4" />
                  </div>
                </div>
              ))
            ) : activity.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No activity yet. Create a shipment to get started.</div>
            ) : (
              activity.map((item) => {
                const color = statusColor[item.status] || 'bg-gray-400';
                const text = item.notes
                  ? item.notes
                  : `Shipment ${item.tracking_id || ''} → ${item.status.replace(/-/g, ' ')}`;
                const subtitle = item.sender_name && item.receiver_name
                  ? `${item.sender_name} → ${item.receiver_name}`
                  : item.location || '';
                return (
                  <div key={item.id} className="px-5 sm:px-6 py-4 flex items-start gap-3 hover:bg-gray-50/50 transition-colors">
                    <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{text}</p>
                      {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(item.created_at)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Actions + Active Couriers */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5 sm:p-6">
            <h2 className="font-bold text-[#0a192f] mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button onClick={() => onNavigate('couriers')} className="w-full text-left px-4 py-3 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] transition-colors flex items-center gap-2">
                <Users size={16} /> Register New Courier
              </button>
              <button onClick={() => onNavigate('shipments')} className="w-full text-left px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2">
                <Package size={16} /> Create Shipment
              </button>
              <button onClick={() => onNavigate('track-map')} className="w-full text-left px-4 py-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                <MapPin size={16} /> View Live Map
              </button>
            </div>
          </div>

          {/* Paused Shipments Alert */}
          {paused > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={18} className="text-amber-600" />
                <h3 className="font-semibold text-amber-800 text-sm">Paused Shipments</h3>
              </div>
              <p className="text-xs text-amber-700 mb-3">{paused} shipment(s) currently paused and need attention.</p>
              <button onClick={() => onNavigate('track-map')} className="text-xs font-medium text-amber-800 underline hover:no-underline">
                View on Map →
              </button>
            </div>
          )}

          {/* Top Couriers */}
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5 sm:p-6">
            <h2 className="font-bold text-[#0a192f] mb-4 flex items-center gap-2">
              <TrendingUp size={18} /> Top Couriers
            </h2>
            <div className="space-y-3">
              {couriers.length === 0 ? (
                <p className="text-xs text-gray-400">No couriers yet.</p>
              ) : (
                [...couriers].sort((a, b) => b.totalDeliveries - a.totalDeliveries).slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <img src={c.avatar} alt={c.name} className="w-9 h-9 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=0a192f&color=fff&size=100`; }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0a192f] truncate">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.totalDeliveries} deliveries</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                      ★ {c.rating}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
