import React, { useState } from 'react';
import { Save, User, Bell, Shield, Globe, Mail, Phone, MapPin, Camera } from 'lucide-react';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security' | 'company'>('profile');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: <User size={16} /> },
    { id: 'notifications' as const, label: 'Notifications', icon: <Bell size={16} /> },
    { id: 'security' as const, label: 'Security', icon: <Shield size={16} /> },
    { id: 'company' as const, label: 'Company', icon: <Globe size={16} /> },
  ];

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
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-[#0a192f] flex items-center justify-center text-white text-2xl font-bold">AD</div>
                <button className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-500 transition-colors">
                  <Camera size={14} />
                </button>
              </div>
              <div>
                <p className="font-semibold text-[#0a192f]">Admin User</p>
                <p className="text-sm text-gray-500">nexttracelogistics@gmail.com</p>
                <p className="text-xs text-gray-400 mt-1">Role: Super Administrator</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">First Name</label>
                <input type="text" defaultValue="Admin" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Last Name</label>
                <input type="text" defaultValue="User" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Email</label>
                <input type="email" defaultValue="nexttracelogistics@gmail.com" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Phone</label>
                <input type="tel" defaultValue="+1 (800) 555-0199" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Timezone</label>
                <select className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] outline-none bg-white">
                  <option>America/Chicago (CST, UTC-6)</option>
                  <option>America/New_York (EST, UTC-5)</option>
                  <option>America/Los_Angeles (PST, UTC-8)</option>
                  <option>Europe/London (GMT, UTC+0)</option>
                </select>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
            <button onClick={handleSave} className="px-6 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] transition-colors flex items-center gap-2">
              <Save size={14} /> {saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-[#0a192f]">Notification Preferences</h3>
            <p className="text-xs text-gray-500 mt-1">Choose how and when you receive alerts</p>
          </div>
          <div className="p-6 space-y-6">
            {[
              { title: 'New Courier Registered', desc: 'Get notified when a new courier is added to the system', default: true },
              { title: 'Shipment Status Changes', desc: 'Alerts when shipments change status (picked up, in transit, delivered)', default: true },
              { title: 'Paused Shipments', desc: 'Immediate alert when a shipment is paused or requires attention', default: true },
              { title: 'Delivery Confirmations', desc: 'Notification when shipments are successfully delivered', default: false },
              { title: 'System Maintenance', desc: 'Updates about scheduled system maintenance windows', default: true },
              { title: 'Weekly Reports', desc: 'Automated weekly performance and analytics summary', default: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-[#0a192f]">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
                  <input type="checkbox" defaultChecked={item.default} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0a192f]"></div>
                </label>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
            <button onClick={handleSave} className="px-6 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] transition-colors flex items-center gap-2">
              <Save size={14} /> {saved ? 'Saved!' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-bold text-[#0a192f]">Change Password</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Current Password</label>
                <input type="password" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">New Password</label>
                <input type="password" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Confirm New Password</label>
                <input type="password" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button onClick={handleSave} className="px-6 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] transition-colors flex items-center gap-2">
                <Shield size={14} /> Update Password
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-[#0a192f] mb-4">Two-Factor Authentication</h3>
            <p className="text-sm text-gray-500 mb-4">Add an extra layer of security to your admin account.</p>
            <button className="px-5 py-2.5 border border-[#0a192f] text-[#0a192f] text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Enable 2FA
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-[#0a192f] mb-2">Active Sessions</h3>
            <p className="text-sm text-gray-500 mb-4">Manage devices where you're currently signed in.</p>
            <div className="space-y-3">
              {[
                { device: 'Chrome on Windows', location: 'Atlanta, GA', current: true },
                { device: 'Safari on iPhone', location: 'Atlanta, GA', current: false },
              ].map((session, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-[#0a192f]">{session.device}</p>
                    <p className="text-xs text-gray-400">{session.location}</p>
                  </div>
                  {session.current ? (
                    <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">Current</span>
                  ) : (
                    <button className="text-xs text-red-600 font-medium hover:underline">Revoke</button>
                  )}
                </div>
              ))}
            </div>
          </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Company Name</label>
                <input type="text" defaultValue="Next Trace Logistics" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Business Email</label>
                <input type="email" defaultValue="nexttracelogistics@gmail.com" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Business Phone</label>
                <input type="tel" defaultValue="+1 (307) 200-8344" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Address</label>
                <input type="text" defaultValue="Atlanta, GA" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Tax ID / EIN</label>
                <input type="text" defaultValue="XX-XXXXXXX" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Website</label>
                <input type="url" defaultValue="https://nexttrace.logistics" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
            <button onClick={handleSave} className="px-6 py-2.5 bg-[#0a192f] text-white text-sm font-medium rounded-lg hover:bg-[#112d57] transition-colors flex items-center gap-2">
              <Save size={14} /> {saved ? 'Saved!' : 'Save Company Info'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
