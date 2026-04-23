import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  LayoutDashboard, Map as MapIcon, Package, Users, Settings as SettingsIcon, 
  Bell, LogOut, Menu, X, Search, ChevronDown, Loader2, UserCircle, Lock, Contact, MessageCircle, FileText, Star
} from 'lucide-react';
import { AdminPage, Courier, Shipment } from './admin/types';
import Overview from './admin/Overview';
import Couriers from './admin/Couriers';
import ShipmentsPage from './admin/Shipments';
import TrackMap from './admin/TrackMap';
import SettingsPage from './admin/Settings';
import CustomersPage from './admin/Customers';
import MessagesPage from './admin/Messages';
import QuotesPage from './admin/Quotes';
import AdminReviewsPage from './admin/Reviews';
import * as api from '../services/api';

const sidebarItems: { id: AdminPage; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'couriers', label: 'Couriers', icon: <Users size={20} /> },
  { id: 'customers', label: 'Customers', icon: <Contact size={20} /> },
  { id: 'shipments', label: 'Shipments', icon: <Package size={20} /> },
  { id: 'track-map', label: 'Live Map', icon: <MapIcon size={20} /> },
  { id: 'messages', label: 'Messages', icon: <MessageCircle size={20} /> },
  { id: 'quotes', label: 'Quotes', icon: <FileText size={20} /> },
  { id: 'reviews', label: 'Reviews', icon: <Star size={20} /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon size={20} /> },
];

const Dashboard: React.FC = () => {
  const [activePage, setActivePage] = useState<AdminPage>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);

  // Check existing auth on mount
  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.auth.me()
        .then(data => { setAdminUser(data.user); setIsLoggedIn(true); })
        .catch(() => { api.removeToken(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch data when logged in
  const fetchData = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const [courierRes, shipmentRes] = await Promise.all([
        api.couriers.list({ limit: 200 }),
        api.shipments.list({ limit: 200 }),
      ]);
      // Map backend fields to frontend Courier/Shipment types
      setCouriers(courierRes.couriers.map((c: any) => ({
        id: c.id.toString(),
        courierId: c.courier_id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        vehicleType: c.vehicle_type,
        licensePlate: c.license_plate || '',
        zone: c.zone || '',
        status: c.status,
        registeredAt: c.created_at?.split('T')[0] || c.created_at,
        totalDeliveries: c.total_deliveries,
        rating: c.rating,
        avatar: c.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=0a192f&color=fff&size=100`,
      })));
      setShipments(shipmentRes.shipments.map((s: any) => ({
        id: s.id.toString(),
        trackingId: s.tracking_id,
        sender: s.sender_name,
        receiver: s.receiver_name,
        origin: s.origin,
        destination: s.destination,
        status: s.status,
        courierId: s.courier_id,
        courierName: s.courier_id ? (courierRes.couriers.find((c: any) => c.courier_id === s.courier_id)?.name || 'Unknown') : 'Unassigned',
        weight: s.weight || 'N/A',
        type: s.cargo_type || 'General',
        createdAt: s.created_at?.split('T')[0] || s.created_at,
        estimatedDelivery: s.estimated_delivery || '',
        progress: s.computed_progress ?? s.progress,
        isPaused: !!s.is_paused,
        pauseCategory: s.pause_category || undefined,
        pauseReason: s.pause_reason || undefined,
        lat: s.current_lat || s.dest_lat,
        lng: s.current_lng || s.dest_lng,
      })));
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  }, [isLoggedIn]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const data = await api.auth.login(loginForm.username, loginForm.password);
      api.setToken(data.token);
      setAdminUser(data.user);
      setIsLoggedIn(true);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    api.removeToken();
    setIsLoggedIn(false);
    setAdminUser(null);
    setCouriers([]);
    setShipments([]);
  };

  const navigate = (page: string) => {
    setActivePage(page as AdminPage);
    setSidebarOpen(false);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'overview':
        return <Overview couriers={couriers} shipments={shipments} onNavigate={navigate} />;
      case 'couriers':
        return <Couriers couriers={couriers} setCouriers={setCouriers} onRefresh={fetchData} />;
      case 'customers':
        return <CustomersPage onRefresh={fetchData} />;
      case 'shipments':
        return <ShipmentsPage shipments={shipments} setShipments={setShipments} couriers={couriers} onNavigate={navigate} onRefresh={fetchData} />;
      case 'track-map':
        return <TrackMap shipments={shipments} setShipments={setShipments} onRefresh={fetchData} />;
      case 'messages':
        return <MessagesPage />;
      case 'quotes':
        return <QuotesPage />;
      case 'reviews':
        return <AdminReviewsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <Overview couriers={couriers} shipments={shipments} onNavigate={navigate} />;
    }
  };

  const currentLabel = sidebarItems.find(i => i.id === activePage)?.label || 'Dashboard';
  const initials = adminUser?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'AD';

  // Loading spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-[#0a192f]" />
      </div>
    );
  }

  // Login screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0a192f] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="bg-[#0a192f] px-8 py-10 text-center">
            <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-[#0a192f] text-2xl font-bold">NR</span>
            </div>
            <h1 className="text-2xl font-bold text-white">NexusRoute Global Logistics</h1>
            <p className="text-gray-400 text-sm mt-1">Admin Portal</p>
          </div>
          <form onSubmit={handleLogin} className="p-8 space-y-5">
            {loginError && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                {loginError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Username or Email</label>
              <div className="relative">
                <UserCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="admin"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-[#0a192f] text-white font-medium rounded-lg hover:bg-[#112d57] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loginLoading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
            <p className="text-center text-xs text-gray-400 mt-4">
              Default credentials: <span className="font-mono text-gray-600">admin</span> / <span className="font-mono text-gray-600">admin123</span>
            </p>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-[#0a192f] text-gray-300 flex flex-col z-40 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="h-16 lg:h-20 flex items-center justify-between px-5 border-b border-gray-800 flex-shrink-0">
          <Link to="/" className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <div className="w-7 h-7 bg-white rounded-sm flex items-center justify-center">
              <span className="text-[#0a192f] text-xs font-bold">AT</span>
            </div>
            ADMIN
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                activePage === item.id
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {activePage === item.id && (
                <div className="ml-auto w-1.5 h-1.5 bg-blue-400 rounded-full" />
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3 px-4 py-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{initials}</div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{adminUser?.full_name || 'Admin'}</p>
              <p className="text-xs text-gray-500 truncate">{adminUser?.email || ''}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
          <Link to="/" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors mt-1">
            <span className="w-4 h-4 flex items-center justify-center text-xs">←</span>
            <span>Back to Site</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu size={20} />
              </button>
              <div>
                <h1 className="text-lg font-bold text-[#0a192f]">{currentLabel}</h1>
                <p className="text-xs text-gray-400 hidden sm:block">NexusRoute Global Logistics Admin Portal</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Search */}
              <div className="hidden md:flex items-center relative">
                <Search size={14} className="absolute left-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-9 pr-4 py-2 w-48 lg:w-64 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none"
                />
              </div>
              {/* Notifications */}
              <button className="relative p-2 bg-gray-50 rounded-lg text-gray-500 hover:text-[#0a192f] hover:bg-gray-100 transition-colors">
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-[#0a192f] flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;