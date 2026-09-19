const API_BASE = '/api';

// ─── TOKEN STORAGE ─────────────────────────────────────────────────────
// Access token: short-lived Supabase JWT (1h) OR long-lived HS256 (30d)
// Refresh token: Supabase refresh token stored separately — used to silently renew

export function getToken(): string | null {
  return localStorage.getItem('ntl_token');
}

export function setToken(token: string): void {
  localStorage.setItem('ntl_token', token);
}

export function removeToken(): void {
  localStorage.removeItem('ntl_token');
  localStorage.removeItem('ntl_refresh_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('ntl_refresh_token');
}

export function setRefreshToken(token: string): void {
  if (token) localStorage.setItem('ntl_refresh_token', token);
}

// ─── TOKEN REFRESH (client-side via Supabase JS) ────────────────────────
let _refreshing: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  // Deduplicate concurrent refresh attempts
  if (_refreshing) return _refreshing;

  _refreshing = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      // Call the server's token-refresh endpoint
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          setToken(data.access_token);
          if (data.refresh_token) setRefreshToken(data.refresh_token);
          return true;
        }
      }
    } catch (_e) {
      // Network error — can't refresh
    }
    return false;
  })();

  try {
    return await _refreshing;
  } finally {
    _refreshing = null;
  }
}

// ─── SESSION EXPIRY ──────────────────────────────────────────────────────
// Fired at most once per signed-in session: only for requests that carried a
// token, never for the login request itself, and re-armed on the next login.
export const SESSION_EXPIRED_EVENT = 'ntl:session-expired';
let sessionExpiredSent = false;

function notifySessionExpired() {
  if (sessionExpiredSent || typeof window === 'undefined') return;
  sessionExpiredSent = true;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export function resetSessionExpiry() {
  sessionExpiredSent = false;
}

// ─── BASE FETCH ──────────────────────────────────────────────────────────
async function apiFetch(endpoint: string, options: RequestInit = {}, _retried = false): Promise<any> {
  const token = getToken();
  const refreshToken = getRefreshToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Send refresh token as a header so the server can auto-refresh if needed
  if (refreshToken) {
    headers['X-Refresh-Token'] = refreshToken;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // ── Handle server-side token refresh (server returned new tokens in headers)
  const newAccessToken = res.headers.get('X-New-Access-Token');
  const newRefreshToken = res.headers.get('X-New-Refresh-Token');
  if (newAccessToken) setToken(newAccessToken);
  if (newRefreshToken) setRefreshToken(newRefreshToken);

  // ── Handle 401 — try to silently refresh once, then retry
  if (res.status === 401 && token && !endpoint.startsWith('/auth/login')) {
    const refreshed = !_retried && await tryRefreshToken();
    if (refreshed) {
      // Retry the original request with the new token
      return apiFetch(endpoint, options, true);
    }
    // Refresh failed — clear tokens and tell the dashboard (once) to show the login screen
    removeToken();
    notifySessionExpired();
    throw new Error('Session expired. Please log in again.');
  }

  // ── Parse response
  let data: any;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new Error(`API Error ${res.status}`);
    return {};
  }

  if (!res.ok) {
    throw new Error(data?.error || `API Error ${res.status}`);
  }

  return data;
}

// ─── AUTH ──────────────────────────────────────────────────────────────
export const auth = {
  login: async (username: string, password: string) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    // Store both tokens on login
    if (data.token) setToken(data.token);
    if (data.refresh_token) setRefreshToken(data.refresh_token);
    resetSessionExpiry();
    return data;
  },

  register: (data: { username: string; email: string; password: string; full_name: string; phone?: string }) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  me: () => apiFetch('/auth/me'),

  updateProfile: (data: { full_name?: string; email?: string; phone?: string }) =>
    apiFetch('/auth/me', { method: 'PUT', body: JSON.stringify(data) }),

  changePassword: (current_password: string, new_password: string) =>
    apiFetch('/auth/password', { method: 'PUT', body: JSON.stringify({ current_password, new_password }) }),

  refresh: (refresh_token: string) =>
    apiFetch('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token }) }),

  logoutAll: () => apiFetch('/auth/logout-all', { method: 'POST' }),
};

// ─── COURIERS ──────────────────────────────────────────────────────────
export const couriers = {
  list: (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    return apiFetch(`/couriers?${query.toString()}`);
  },

  get: (id: string) => apiFetch(`/couriers/${id}`),

  create: (data: {
    name: string; email: string; phone: string;
    vehicle_type?: string; license_plate?: string; zone?: string;
    emergency_contact?: string; date_of_birth?: string; national_id?: string; notes?: string;
  }) => apiFetch('/couriers', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, any>) =>
    apiFetch(`/couriers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) => apiFetch(`/couriers/${id}`, { method: 'DELETE' }),

  updateStatus: (id: string, status: string) =>
    apiFetch(`/couriers/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

// ─── CUSTOMERS ─────────────────────────────────────────────────────────
export const customers = {
  list: (params?: { status?: string; search?: string; type?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.type) query.set('type', params.type);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    return apiFetch(`/customers?${query.toString()}`);
  },

  get: (id: string) => apiFetch(`/customers/${id}`),

  create: (data: {
    contact_name: string; email: string; phone: string;
    company_name?: string; address?: string; city?: string; state?: string;
    country?: string; postal_code?: string; type?: string; notes?: string;
  }) => apiFetch('/customers', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, any>) =>
    apiFetch(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) => apiFetch(`/customers/${id}`, { method: 'DELETE' }),
};

// ─── SHIPMENTS ─────────────────────────────────────────────────────────
export const shipments = {
  list: (params?: { status?: string; courier_id?: string; customer_id?: string; search?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.courier_id) query.set('courier_id', params.courier_id);
    if (params?.customer_id) query.set('customer_id', params.customer_id);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    return apiFetch(`/shipments?${query.toString()}`);
  },

  get: (id: string) => apiFetch(`/shipments/${id}`),

  create: (data: {
    sender_name: string; receiver_name: string; origin: string; destination: string;
    sender_email?: string; sender_phone?: string;
    receiver_email?: string; receiver_phone?: string;
    courier_id?: string; customer_id?: string;
    weight?: string; dimensions?: string; cargo_type?: string;
    description?: string; declared_value?: number; insurance?: boolean;
    estimated_delivery?: string; special_instructions?: string;
    origin_lat?: number; origin_lng?: number; dest_lat?: number; dest_lng?: number;
    route_data?: any; transport_modes?: string[]; route_distance?: number; route_duration?: number; route_summary?: string;
    route_mode?: string; eta_overridden?: boolean;
    multi_modal_segments?: any; multi_modal_stops?: any;
    scheduled_transit_stops?: Array<{ name: string; lat: number; lng: number }>;
    pet_details?: Record<string, any>;
  }) => apiFetch('/shipments', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, any>) =>
    apiFetch(`/shipments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) => apiFetch(`/shipments/${id}`, { method: 'DELETE' }),

  updateStatus: (id: string, data: { status: string; location?: string; lat?: number; lng?: number; notes?: string; pause_category?: string; pause_reason?: string }) =>
    apiFetch(`/shipments/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),

  assignCourier: (id: string, courier_id: string) =>
    apiFetch(`/shipments/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ courier_id }) }),

  togglePause: (id: string, data?: { pause_category?: string; pause_reason?: string }) =>
    apiFetch(`/shipments/${id}/pause`, { method: 'PATCH', body: JSON.stringify(data || {}) }),

  alterLocation: (id: string, data: { progress: number; location_name?: string; lat?: number; lng?: number }) =>
    apiFetch(`/shipments/${id}/alter-location`, { method: 'PATCH', body: JSON.stringify(data) }),

  addTransitStop: (id: string, data: { airport_name: string; lat: number; lng: number; reason?: string }) =>
    apiFetch(`/shipments/${id}/transit-stop`, { method: 'POST', body: JSON.stringify(data) }),

  deleteTransitStop: (id: string, index: number) =>
    apiFetch(`/shipments/${id}/transit-stop/${index}`, { method: 'DELETE' }),

  /** Hold the cargo at the airport it is currently at (the server works out which). */
  transitLand: (id: string, data: { reason?: string } = {}) =>
    apiFetch(`/shipments/${id}/transit-land`, { method: 'POST', body: JSON.stringify(data) }),

  /** Send an airborne aircraft to a different airport next. */
  divert: (id: string, data: { airport_name: string; lat: number; lng: number; reason?: string }) =>
    apiFetch(`/shipments/${id}/divert`, { method: 'POST', body: JSON.stringify(data) }),

  /** Stop a truck along its route — by place (lat/lng) or by time (in_minutes). */
  addRoadStop: (id: string, data: {
    lat?: number; lng?: number; in_minutes?: number;
    duration_minutes: number; kind?: string; name?: string; note?: string;
  }) => apiFetch(`/shipments/${id}/road-stop`, { method: 'POST', body: JSON.stringify(data) }),

  removeRoadStop: (id: string, stopId: string) =>
    apiFetch(`/shipments/${id}/road-stop/${encodeURIComponent(stopId)}`, { method: 'DELETE' }),

  // Public endpoint — no auth required
  track: (trackingId: string) =>
    fetch(`${API_BASE}/shipments/${trackingId}/track`).then(r => r.json()),
};

// ─── DASHBOARD ─────────────────────────────────────────────────────────
export const dashboard = {
  stats: () => apiFetch('/dashboard/stats'),
  recentActivity: (limit = 20) => apiFetch(`/dashboard/recent-activity?limit=${limit}`),
  topCouriers: () => apiFetch('/dashboard/top-couriers'),
  notifications: (limit = 20) => apiFetch(`/dashboard/notifications?limit=${limit}`),
  markNotificationRead: (id: number) => apiFetch(`/dashboard/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => apiFetch('/dashboard/notifications/read-all', { method: 'PATCH' }),
  activeMap: () => apiFetch('/dashboard/active-map'),
};

// ─── MESSAGES ──────────────────────────────────────────────────────────
export const messages = {
  startConversation: (data: { visitor_id: string; visitor_name?: string; visitor_email?: string; subject?: string }) =>
    fetch(`${API_BASE}/messages/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),

  send: (data: { conversation_id: number; content: string; sender_name?: string; sender_type?: string }) =>
    fetch(`${API_BASE}/messages/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),

  getMessages: (conversationId: number) =>
    fetch(`${API_BASE}/messages/conversations/${conversationId}/messages`).then(r => r.json()),

  adminListConversations: (params?: { status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    return apiFetch(`/messages/admin/conversations?${query.toString()}`);
  },

  adminGetConversation: (id: number) => apiFetch(`/messages/admin/conversations/${id}`),

  adminReply: (data: { conversation_id: number; content: string }) =>
    apiFetch('/messages/admin/reply', { method: 'POST', body: JSON.stringify(data) }),

  adminCloseConversation: (id: number) =>
    apiFetch(`/messages/admin/conversations/${id}/close`, { method: 'PATCH' }),

  adminReopenConversation: (id: number) =>
    apiFetch(`/messages/admin/conversations/${id}/reopen`, { method: 'PATCH' }),
};

// ─── QUOTES ────────────────────────────────────────────────────────────
export const quotes = {
  submit: (data: { full_name: string; company?: string; email: string; phone?: string; service_type: string; details?: string }) =>
    fetch(`${API_BASE}/quotes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),

  adminList: (params?: { status?: string; service_type?: string; search?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.service_type) query.set('service_type', params.service_type);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    return apiFetch(`/quotes/admin?${query.toString()}`);
  },

  adminGet: (id: number) => apiFetch(`/quotes/admin/${id}`),
  adminUpdateStatus: (id: number, data: { status: string; admin_notes?: string }) =>
    apiFetch(`/quotes/admin/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
  adminUpdateNotes: (id: number, admin_notes: string) =>
    apiFetch(`/quotes/admin/${id}/notes`, { method: 'PATCH', body: JSON.stringify({ admin_notes }) }),
  adminDelete: (id: number) => apiFetch(`/quotes/admin/${id}`, { method: 'DELETE' }),
  adminStats: () => apiFetch('/quotes/admin-stats'),
};

// ─── REVIEWS ───────────────────────────────────────────────────────────
export const reviews = {
  submit: (data: { name: string; email: string; role?: string; text: string; rating: number }) =>
    fetch(`${API_BASE}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),

  approved: () => fetch(`${API_BASE}/reviews/approved`).then(r => r.json()),

  adminList: (params?: { status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    return apiFetch(`/reviews/admin?${query.toString()}`);
  },

  adminApprove: (id: number) => apiFetch(`/reviews/admin/${id}/approve`, { method: 'PATCH' }),
  adminReject: (id: number, admin_notes?: string) =>
    apiFetch(`/reviews/admin/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ admin_notes }) }),
  adminDelete: (id: number) => apiFetch(`/reviews/admin/${id}`, { method: 'DELETE' }),
};

// ─── EMAILS ────────────────────────────────────────────────────────────
export const emails = {
  subscribe: (data: { tracking_id: string; email: string; name?: string }) =>
    fetch(`${API_BASE}/emails/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),

  unsubscribe: (data: { tracking_id: string; email: string }) =>
    fetch(`${API_BASE}/emails/unsubscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),

  adminListDrafts: (params?: { status?: string; type?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    if (params?.search) query.set('search', params.search);
    return apiFetch(`/emails/admin/drafts?${query.toString()}`);
  },

  adminGetDraft: (id: number) => apiFetch(`/emails/admin/drafts/${id}`),
  adminUpdateDraft: (id: number, data: { subject?: string; html_body?: string; text_body?: string }) =>
    apiFetch(`/emails/admin/drafts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminSendDraft: (id: number) => apiFetch(`/emails/admin/drafts/${id}/send`, { method: 'POST' }),
  adminCancelDraft: (id: number) => apiFetch(`/emails/admin/drafts/${id}/cancel`, { method: 'PATCH' }),
  adminDeleteDraft: (id: number) => apiFetch(`/emails/admin/drafts/${id}`, { method: 'DELETE' }),
  adminListSubscribers: (trackingId?: string) => {
    const query = new URLSearchParams();
    if (trackingId) query.set('tracking_id', trackingId);
    return apiFetch(`/emails/admin/subscribers?${query.toString()}`);
  },
};

// ─── ROUTING (admin transport planner) ────────────────────────────────
export interface HubResult { name: string; iata?: string; lat: number; lng: number; type?: string; distanceKm: number; score?: number }

export const routing = {
  plans: (data: {
    origin: { name: string; lat: number; lng: number };
    destination: { name: string; lat: number; lng: number };
    vias?: Array<{ name: string; lat: number; lng: number }>;
    cargoType?: string;
    mapboxToken?: string;
  }) => apiFetch('/routing/plans', { method: 'POST', body: JSON.stringify(data) }),

  nearestAirports: (lat: number, lng: number, limit = 8): Promise<{ results: HubResult[] }> =>
    apiFetch(`/routing/nearest-hub?type=airport&lat=${lat}&lng=${lng}&limit=${limit}`),
};

// ─── HEALTH ────────────────────────────────────────────────────────────
export const health = () => fetch(`${API_BASE}/health`).then(r => r.json());

// ─── SETTINGS ──────────────────────────────────────────────────────────
export const settings = {
  getCompany: (): Promise<{
    company_name: string;
    company_email: string;
    company_phone: string;
    company_address: string;
    company_tax_id: string;
    company_website: string;
  }> => apiFetch('/settings/company'),

  updateCompany: (data: {
    company_name?: string;
    company_email?: string;
    company_phone?: string;
    company_address?: string;
    company_tax_id?: string;
    company_website?: string;
  }) => apiFetch('/settings/company', { method: 'PUT', body: JSON.stringify(data) }),

  getNotifications: (): Promise<{ prefs: Record<string, boolean> }> => apiFetch('/settings/notifications'),
  updateNotifications: (prefs: Record<string, boolean>): Promise<{ prefs: Record<string, boolean> }> =>
    apiFetch('/settings/notifications', { method: 'PUT', body: JSON.stringify(prefs) }),
};

