const API_BASE = '/api';

// ─── TOKEN MANAGEMENT ────────────────────────────────────────────────
export function getToken(): string | null {
  return localStorage.getItem('aura_token');
}

export function setToken(token: string): void {
  localStorage.setItem('aura_token', token);
}

export function removeToken(): void {
  localStorage.removeItem('aura_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ─── BASE FETCH ──────────────────────────────────────────────────────
async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    // If unauthorized, clear token
    if (res.status === 401) {
      removeToken();
    }
    throw new Error(data.error || `API Error ${res.status}`);
  }

  return data;
}

// ─── AUTH ─────────────────────────────────────────────────────────────
export const auth = {
  login: (username: string, password: string) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  register: (data: { username: string; email: string; password: string; full_name: string; phone?: string }) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  me: () => apiFetch('/auth/me'),

  updateProfile: (data: { full_name?: string; email?: string; phone?: string }) =>
    apiFetch('/auth/me', { method: 'PUT', body: JSON.stringify(data) }),

  changePassword: (current_password: string, new_password: string) =>
    apiFetch('/auth/password', { method: 'PUT', body: JSON.stringify({ current_password, new_password }) }),
};

// ─── COURIERS ─────────────────────────────────────────────────────────
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

// ─── CUSTOMERS ────────────────────────────────────────────────────────
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

// ─── SHIPMENTS ────────────────────────────────────────────────────────
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
  }) => apiFetch('/shipments', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, any>) =>
    apiFetch(`/shipments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) => apiFetch(`/shipments/${id}`, { method: 'DELETE' }),

  updateStatus: (id: string, data: { status: string; location?: string; lat?: number; lng?: number; notes?: string }) =>
    apiFetch(`/shipments/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),

  assignCourier: (id: string, courier_id: string) =>
    apiFetch(`/shipments/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ courier_id }) }),

  togglePause: (id: string, data?: { pause_category?: string; pause_reason?: string }) =>
    apiFetch(`/shipments/${id}/pause`, { method: 'PATCH', body: JSON.stringify(data || {}) }),

  // Public endpoint - no auth required
  track: (trackingId: string) =>
    fetch(`${API_BASE}/shipments/${trackingId}/track`).then(r => r.json()),
};

// ─── DASHBOARD ────────────────────────────────────────────────────────
export const dashboard = {
  stats: () => apiFetch('/dashboard/stats'),
  recentActivity: (limit = 20) => apiFetch(`/dashboard/recent-activity?limit=${limit}`),
  topCouriers: () => apiFetch('/dashboard/top-couriers'),
  notifications: (limit = 20) => apiFetch(`/dashboard/notifications?limit=${limit}`),
  markNotificationRead: (id: number) => apiFetch(`/dashboard/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => apiFetch('/dashboard/notifications/read-all', { method: 'PATCH' }),
  activeMap: () => apiFetch('/dashboard/active-map'),
};

// ─── MESSAGES ────────────────────────────────────────────────────────
export const messages = {
  // Public endpoints (visitor)
  startConversation: (data: { visitor_id: string; visitor_name?: string; visitor_email?: string; subject?: string }) =>
    fetch(`${API_BASE}/messages/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),

  send: (data: { conversation_id: number; content: string; sender_name?: string; sender_type?: string }) =>
    fetch(`${API_BASE}/messages/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),

  getMessages: (conversationId: number) =>
    fetch(`${API_BASE}/messages/conversations/${conversationId}/messages`).then(r => r.json()),

  // Admin endpoints (auth required)
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

// ─── QUOTES ─────────────────────────────────────────────────────────
export const quotes = {
  // Public endpoint (no auth)
  submit: (data: { full_name: string; company?: string; email: string; phone?: string; service_type: string; details?: string }) =>
    fetch(`${API_BASE}/quotes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),

  // Admin endpoints (auth required)
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

  adminDelete: (id: number) =>
    apiFetch(`/quotes/admin/${id}`, { method: 'DELETE' }),

  adminStats: () => apiFetch('/quotes/admin-stats'),
};

// ─── REVIEWS ─────────────────────────────────────────────────────────
export const reviews = {
  // Public: submit a review (goes to pending)
  submit: (data: { name: string; email: string; role?: string; text: string; rating: number }) =>
    fetch(`${API_BASE}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),

  // Public: get approved reviews only
  approved: () =>
    fetch(`${API_BASE}/reviews/approved`).then(r => r.json()),

  // Admin: list all reviews with optional filters
  adminList: (params?: { status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    return apiFetch(`/reviews/admin?${query.toString()}`);
  },

  // Admin: approve a review
  adminApprove: (id: number) =>
    apiFetch(`/reviews/admin/${id}/approve`, { method: 'PATCH' }),

  // Admin: reject a review
  adminReject: (id: number, admin_notes?: string) =>
    apiFetch(`/reviews/admin/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ admin_notes }) }),

  // Admin: delete a review
  adminDelete: (id: number) =>
    apiFetch(`/reviews/admin/${id}`, { method: 'DELETE' }),
};

// ─── HEALTH ───────────────────────────────────────────────────────────
export const health = () => fetch(`${API_BASE}/health`).then(r => r.json());
