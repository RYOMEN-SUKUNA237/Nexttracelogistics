export interface Courier {
  id: string;
  courierId: string;
  name: string;
  email: string;
  phone: string;
  vehicleType: 'motorcycle' | 'van' | 'truck' | 'bicycle' | 'car';
  licensePlate: string;
  zone: string;
  status: 'active' | 'inactive' | 'on-delivery' | 'on-break';
  registeredAt: string;
  totalDeliveries: number;
  rating: number;
  avatar: string;
  emergencyContact?: string;
  notes?: string;
}

export type ShipmentStatus = 'pending' | 'picked-up' | 'in-transit' | 'out-for-delivery' | 'delivered' | 'returned' | 'paused';

export interface ScheduledStop {
  name: string;
  lat: number;
  lng: number;
  added_at?: string;
}

export interface PetDetails {
  species?: string;
  breed?: string;
  gender?: string;
  age?: string;
  color?: string;
  weight?: string;
  microchipId?: string;
  vaccinationStatus?: string;
  medications?: string;
  vetName?: string;
  vetPhone?: string;
  vetClinic?: string;
  crateType?: string;
  tempMin?: string;
  tempMax?: string;
  feedingSchedule?: string;
  specialCare?: string;
  ownerConsent?: boolean;
}

/** Shipment row exactly as the admin API returns it. */
export interface ShipmentRecord {
  id: number | string;
  tracking_id: string;
  sender_name: string;
  sender_email: string | null;
  sender_phone: string | null;
  receiver_name: string;
  receiver_email: string | null;
  receiver_phone: string | null;
  origin: string;
  destination: string;
  origin_lat: number | string | null;
  origin_lng: number | string | null;
  dest_lat: number | string | null;
  dest_lng: number | string | null;
  current_lat: number | string | null;
  current_lng: number | string | null;
  status: ShipmentStatus;
  status_before_pause?: ShipmentStatus | null;
  courier_id: string | null;
  weight: string | null;
  cargo_type: string | null;
  description: string | null;
  special_instructions: string | null;
  progress: number | string | null;
  computed_progress?: number;
  is_paused: boolean;
  paused_at: string | null;
  total_paused_ms: number | string | null;
  pause_category: string | null;
  pause_reason: string | null;
  departed_at: string | null;
  estimated_delivery: string | null;
  eta_overridden?: boolean;
  actual_delivery: string | null;
  route_data: any;
  route_distance: number | string | null;
  route_duration: number | string | null;
  route_summary: string | null;
  route_mode?: string | null;
  transport_modes: any;
  multi_modal_segments: any;
  multi_modal_stops: any;
  scheduled_transit_stops: ScheduledStop[] | string | null;
  pet_details: PetDetails | string | null;
  created_at: string;
}

export interface Shipment {
  id: string;
  trackingId: string;
  sender: string;
  receiver: string;
  origin: string;
  destination: string;
  status: ShipmentStatus;
  courierId: string | null;
  courierName: string;
  weight: string;
  type: string;
  createdAt: string;
  estimatedDelivery: string;
  progress: number; // 0-100
  isPaused: boolean;
  pauseCategory?: string;
  pauseReason?: string;
  /** Full server record (route, timeline, contacts, pet details). */
  raw: ShipmentRecord;
}

export type AdminPage = 'overview' | 'couriers' | 'customers' | 'shipments' | 'track-map' | 'messages' | 'quotes' | 'reviews' | 'emails' | 'settings';

/** Map an API shipment row to the admin list model. */
export function toShipment(s: ShipmentRecord, courierNames: Record<string, string>): Shipment {
  return {
    id: String(s.id),
    trackingId: s.tracking_id,
    sender: s.sender_name,
    receiver: s.receiver_name,
    origin: s.origin,
    destination: s.destination,
    status: s.status,
    courierId: s.courier_id,
    courierName: s.courier_id ? (courierNames[s.courier_id] || 'Unknown') : 'Unassigned',
    weight: s.weight || 'N/A',
    type: s.cargo_type || 'General',
    createdAt: s.created_at?.split('T')[0] || s.created_at,
    estimatedDelivery: s.estimated_delivery || '',
    progress: Math.round(Number(s.computed_progress ?? s.progress ?? 0) * 10) / 10,
    isPaused: !!s.is_paused,
    pauseCategory: s.pause_category || undefined,
    pauseReason: s.pause_reason || undefined,
    raw: s,
  };
}

export function scheduledStopsOf(s: ShipmentRecord): ScheduledStop[] {
  let v: any = s.scheduled_transit_stops;
  while (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return []; }
  }
  return Array.isArray(v) ? v.filter((x) => x && x.lat != null && x.lng != null) : [];
}

export function petDetailsOf(s: ShipmentRecord): PetDetails | null {
  let v: any = s.pet_details;
  while (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return null; }
  }
  return v && typeof v === 'object' ? v : null;
}

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  'pending': 'Pending',
  'picked-up': 'Picked Up',
  'in-transit': 'In Transit',
  'out-for-delivery': 'Out for Delivery',
  'delivered': 'Delivered',
  'returned': 'Returned',
  'paused': 'On Hold',
};

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(String(value).includes('T') ? String(value) : `${value}T00:00:00Z`);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Value for <input type="datetime-local"> in the browser's timezone. */
export function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
