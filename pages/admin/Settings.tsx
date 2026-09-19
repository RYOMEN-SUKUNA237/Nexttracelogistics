import React, { useState, useEffect } from 'react';
import { Save, User, Bell, Shield, Globe, Eye, EyeOff, CheckCircle, XCircle, Loader2, LogOut } from 'lucide-react';
import * as api from '../../services/api';

// ─── Password Change Sub-Component ──────────────────────────────────────────
const SecurityPasswordForm: React.FC = () => {
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const mismatch = confirm.length > 0 && newPw !== confirm;
  const tooShort = newPw.length > 0 && newPw.length < 6;

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!current || !newPw || !confirm) { setError('All fields are required.'); return; }
    if (newPw !== confirm) { setError('New passwords do not match.'); return; }
    if (newPw.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (newPw === current) { setError('New password must be different from your current password.'); return; }

    setLoading(true);
    try {
      await api.auth.changePassword(current, newPw);
      setSuccess('Password updated successfully! Please use the new password next time you log in.');
      setCurrent(''); setNewPw(''); setConfirm('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-1 outline-none pr-12";

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
      <div className="p-6 border-b border-gray-100">
        <h3 className="font-bold text-[#0a192f]">Change Password</h3>
        <p className="text-xs text-gray-500 mt-1">Update your admin account password</p>
      </div>
      <div className="p-6 space-y-4">
        {/* Current Password */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={current}
              onChange={e => setCurrent(e.target.value)}
              placeholder="Enter your current password"
              className={`${inputClass} border-gray-200 focus:border-[#0a192f] focus:ring-[#0a192f]`}
            />
            <button type="button" onClick={() => setShowCurrent(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">New Password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="At least 6 characters"
              className={`${inputClass} ${tooShort ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : 'border-gray-200 focus:border-[#0a192f] focus:ring-[#0a192f]'}`}
            />
            <button type="button" onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {tooShort && <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters</p>}
        </div>

        {/* Confirm New Password */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Confirm New Password</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter your new password"
              className={`${inputClass} ${mismatch ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : 'border-gray-200 focus:border-[#0a192f] focus:ring-[#0a192f]'}`}
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {mismatch && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
        </div>

        {/* Feedback */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}
      </div>
      <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading || mismatch || tooShort}
          className="px-6 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </div>
    </div>
  );
};

// ─── Notification Preferences ───────────────────────────────────────────────
const NOTIFICATION_OPTIONS: { key: string; title: string; desc: string }[] = [
  { key: 'courier_registered', title: 'New courier registered', desc: 'A courier is added to the system.' },
  { key: 'customer_registered', title: 'New customer registered', desc: 'A customer account is created.' },
  { key: 'shipment_status', title: 'Shipment updates', desc: 'Shipments created, status changes, out for delivery, transit layovers and diversions.' },
  { key: 'shipment_paused', title: 'Holds', desc: 'A shipment is paused or resumed.' },
  { key: 'shipment_delivered', title: 'Deliveries', desc: 'A shipment reaches its destination.' },
];

const NotificationPreferences: React.FC = () => {
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.settings.getNotifications()
      .then((res) => { setPrefs(res.prefs); setSaved(res.prefs); })
      .catch((err) => setMessage({ ok: false, text: err.message || 'Failed to load preferences.' }));
  }, []);

  const dirty = !!prefs && !!saved && NOTIFICATION_OPTIONS.some((o) => prefs[o.key] !== saved[o.key]);

  const save = async () => {
    if (!prefs) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.settings.updateNotifications(prefs);
      setPrefs(res.prefs);
      setSaved(res.prefs);
      setMessage({ ok: true, text: 'Preferences saved.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ ok: false, text: err.message || 'Failed to save preferences.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
      <div className="p-6 border-b border-gray-100">
        <h3 className="font-bold text-[#0a192f]">Notification Preferences</h3>
        <p className="text-xs text-gray-500 mt-1">Choose which events appear in the bell menu. Customer emails are not affected.</p>
      </div>
      <div className="p-6 space-y-5">
        {!prefs && !message && <Loader2 size={18} className="animate-spin text-gray-400" />}
        {prefs && NOTIFICATION_OPTIONS.map((item) => (
          <div key={item.key} className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-[#0a192f]">{item.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
              <input type="checkbox" className="sr-only peer" checked={prefs[item.key] !== false}
                onChange={(e) => setPrefs((p) => ({ ...(p || {}), [item.key]: e.target.checked }))} />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0a192f]"></div>
            </label>
          </div>
        ))}
        {message && (
          <p className={`text-sm px-3 py-2 rounded-lg border ${message.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{message.text}</p>
        )}
      </div>
      <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
        <button onClick={save} disabled={!dirty || saving}
          className="px-6 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save preferences
        </button>
      </div>
    </div>
  );
};

// ─── Sign out everywhere ─────────────────────────────────────────────────────
const SessionControls: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const signOutEverywhere = async () => {
    setBusy(true);
    setError('');
    try {
      await api.auth.logoutAll();
      api.removeToken();
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Could not sign out other sessions.');
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 space-y-3">
      <h3 className="font-bold text-[#0a192f]">Sessions</h3>
      <p className="text-sm text-gray-500">If you signed in on a shared or lost device, end every session. You will need to sign in again here too.</p>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}
      {!confirming ? (
        <button onClick={() => setConfirming(true)}
          className="px-5 py-2.5 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 flex items-center gap-2">
          <LogOut size={14} /> Sign out of all devices
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-700">Sign out everywhere, including this browser?</span>
          <button onClick={signOutEverywhere} disabled={busy}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />} Yes, sign out
          </button>
          <button onClick={() => setConfirming(false)} disabled={busy} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
        </div>
      )}
    </div>
  );
};

// ─── Main Settings Component ─────────────────────────────────────────────────
const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security' | 'company'>('profile');

  // Live profile state
  const [adminUser, setAdminUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Company settings state
  const [companyName, setCompanyName] = useState('Next Trace Logistics');
  const [companyEmail, setCompanyEmail] = useState('support@nexttracelogistics.com');
  const [companyPhone, setCompanyPhone] = useState('+1 (412) 227-3484');
  const [companyAddress, setCompanyAddress] = useState('Wyoming');
  const [companyTaxId, setCompanyTaxId] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('https://nexttracelogistics.com');
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [companySuccess, setCompanySuccess] = useState('');

  // Load real user data on mount
  useEffect(() => {
    api.auth.me()
      .then(data => {
        const u = data.user;
        setAdminUser(u);
        const parts = (u.full_name || '').split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' ') || '');
        setEmail(u.email || '');
        setPhone(u.phone || '');
      })
      .catch(err => console.error('Failed to load user:', err))
      .finally(() => setLoadingUser(false));

    // Load company settings
    api.settings.getCompany()
      .then(data => {
        setCompanyName(data.company_name || '');
        setCompanyEmail(data.company_email || '');
        setCompanyPhone(data.company_phone || '');
        setCompanyAddress(data.company_address || '');
        setCompanyTaxId(data.company_tax_id || '');
        setCompanyWebsite(data.company_website || '');
      })
      .catch(err => console.error('Failed to load company settings:', err))
      .finally(() => setLoadingCompany(false));
  }, []);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const handleProfileSave = async () => {
    setSaveError(''); setSaveSuccess('');
    setSaving(true);
    try {
      const full_name = `${firstName} ${lastName}`.trim();
      const data = await api.auth.updateProfile({ full_name, email, phone });
      setAdminUser(data.user);
      setSaveSuccess('Profile updated successfully!');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err: any) {
      // Session-expired errors are handled globally (Dashboard logs out) — don't show here
      if (!err.message?.toLowerCase().includes('session')) {
        setSaveError(err.message || 'Failed to save profile. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCompanySave = async () => {
    setCompanyError(''); setCompanySuccess('');
    setSavingCompany(true);
    try {
      const data = await api.settings.updateCompany({
        company_name: companyName,
        company_email: companyEmail,
        company_phone: companyPhone,
        company_address: companyAddress,
        company_tax_id: companyTaxId,
        company_website: companyWebsite,
      });
      // Update local state from server response
      setCompanyName(data.company_name || companyName);
      setCompanyEmail(data.company_email || companyEmail);
      setCompanyPhone(data.company_phone || companyPhone);
      setCompanyAddress(data.company_address || companyAddress);
      setCompanyTaxId(data.company_tax_id || companyTaxId);
      setCompanyWebsite(data.company_website || companyWebsite);
      setCompanySuccess('Company information saved successfully!');
      setTimeout(() => setCompanySuccess(''), 3000);
    } catch (err: any) {
      // Session-expired errors are handled globally (Dashboard logs out) — don't show here
      if (!err.message?.toLowerCase().includes('session')) {
        setCompanyError(err.message || 'Failed to save company info. Please try again.');
      }
    } finally {
      setSavingCompany(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: <User size={16} /> },
    { id: 'notifications' as const, label: 'Notifications', icon: <Bell size={16} /> },
    { id: 'security' as const, label: 'Security', icon: <Shield size={16} /> },
    { id: 'company' as const, label: 'Company', icon: <Globe size={16} /> },
  ];

  const initials = adminUser?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'AD';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#0a192f]">Settings</h2>
        <p className="text-sm text-gray-500">Manage your account and system preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md whitespace-nowrap transition-all ${
              activeTab === tab.id ? 'bg-white text-[#0a192f] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-[#0a192f]">Admin Profile</h3>
            <p className="text-xs text-gray-500 mt-1">Update your personal information</p>
          </div>
          <div className="p-6 space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-[#0a192f] flex items-center justify-center text-white text-2xl font-bold">
                {loadingUser ? <Loader2 size={20} className="animate-spin" /> : initials}
              </div>
              <div>
                <p className="font-semibold text-[#0a192f]">{adminUser?.full_name || 'Loading...'}</p>
                <p className="text-sm text-gray-500">{adminUser?.email || ''}</p>
                <p className="text-xs text-gray-400 mt-1 capitalize">Role: {adminUser?.role || 'admin'}</p>
              </div>
            </div>

            {/* Feedback */}
            {saveError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{saveError}</p>
              </div>
            )}
            {saveSuccess && (
              <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700">{saveSuccess}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  disabled={loadingUser}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  disabled={loadingUser}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loadingUser}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  disabled={loadingUser}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none disabled:bg-gray-50"
                />
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
            <button
              onClick={handleProfileSave}
              disabled={saving || loadingUser}
              className="px-6 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && <NotificationPreferences />}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <SecurityPasswordForm />
          <SessionControls />
        </div>
      )}

      {/* Company Tab */}
      {activeTab === 'company' && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-[#0a192f]">Company Information</h3>
            <p className="text-xs text-gray-500 mt-1">Manage your organization details</p>
          </div>
          <div className="p-6 space-y-4">
            {/* Feedback */}
            {companyError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{companyError}</p>
              </div>
            )}
            {companySuccess && (
              <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700">{companySuccess}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  disabled={loadingCompany}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Business Email</label>
                <input
                  type="email"
                  value={companyEmail}
                  onChange={e => setCompanyEmail(e.target.value)}
                  disabled={loadingCompany}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Business Phone</label>
                <input
                  type="tel"
                  value={companyPhone}
                  onChange={e => setCompanyPhone(e.target.value)}
                  disabled={loadingCompany}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none disabled:bg-gray-50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Address</label>
                <input
                  type="text"
                  value={companyAddress}
                  onChange={e => setCompanyAddress(e.target.value)}
                  disabled={loadingCompany}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Tax ID / EIN</label>
                <input
                  type="text"
                  value={companyTaxId}
                  onChange={e => setCompanyTaxId(e.target.value)}
                  disabled={loadingCompany}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Website</label>
                <input
                  type="url"
                  value={companyWebsite}
                  onChange={e => setCompanyWebsite(e.target.value)}
                  disabled={loadingCompany}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none disabled:bg-gray-50"
                />
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
            <button
              onClick={handleCompanySave}
              disabled={savingCompany || loadingCompany}
              className="px-6 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingCompany ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {savingCompany ? 'Saving...' : 'Save Company Info'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
