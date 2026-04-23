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
}

export interface Shipment {
  id: string;
  trackingId: string;
  sender: string;
  receiver: string;
  origin: string;
  destination: string;
  status: 'pending' | 'picked-up' | 'in-transit' | 'out-for-delivery' | 'delivered' | 'returned' | 'paused';
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
  lat?: number;
  lng?: number;
}

export type AdminPage = 'overview' | 'couriers' | 'customers' | 'shipments' | 'track-map' | 'messages' | 'quotes' | 'reviews' | 'settings';

// Generate unique courier ID
export const generateCourierId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'AT-CUR-';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

// Generate unique tracking ID
export const generateTrackingId = (): string => {
  const num = Math.floor(1000 + Math.random() * 9000);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const suffix = chars.charAt(Math.floor(Math.random() * chars.length)) + Math.floor(Math.random() * 10);
  return `AT-${num}-${suffix}`;
};

// Mock data
const avatars = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fm=jpg&fit=crop&w=100&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?fm=jpg&fit=crop&w=100&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?fm=jpg&fit=crop&w=100&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?fm=jpg&fit=crop&w=100&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?fm=jpg&fit=crop&w=100&q=80',
];

export const mockCouriers: Courier[] = [
  {
    id: '1', courierId: 'AT-CUR-7X92KP', name: 'Marcus Johnson', email: 'marcus@auratrack.com',
    phone: '+1 555-0101', vehicleType: 'van', licensePlate: 'TX-4821-MJ', zone: 'Downtown Houston',
    status: 'on-delivery', registeredAt: '2024-08-15', totalDeliveries: 342, rating: 4.8, avatar: avatars[0],
  },
  {
    id: '2', courierId: 'AT-CUR-3B81NQ', name: 'Sofia Martinez', email: 'sofia@auratrack.com',
    phone: '+1 555-0102', vehicleType: 'motorcycle', licensePlate: 'TX-1192-SM', zone: 'Midtown',
    status: 'active', registeredAt: '2024-06-20', totalDeliveries: 578, rating: 4.9, avatar: avatars[1],
  },
  {
    id: '3', courierId: 'AT-CUR-9D44RL', name: 'Emily Chen', email: 'emily@auratrack.com',
    phone: '+1 555-0103', vehicleType: 'car', licensePlate: 'TX-8830-EC', zone: 'Galleria Area',
    status: 'on-break', registeredAt: '2024-11-01', totalDeliveries: 124, rating: 4.6, avatar: avatars[2],
  },
  {
    id: '4', courierId: 'AT-CUR-5F27WT', name: 'David Okafor', email: 'david@auratrack.com',
    phone: '+1 555-0104', vehicleType: 'truck', licensePlate: 'TX-6654-DO', zone: 'Industrial District',
    status: 'active', registeredAt: '2024-03-10', totalDeliveries: 891, rating: 4.7, avatar: avatars[3],
  },
  {
    id: '5', courierId: 'AT-CUR-2H65YM', name: 'Jake Williams', email: 'jake@auratrack.com',
    phone: '+1 555-0105', vehicleType: 'van', licensePlate: 'TX-3347-JW', zone: 'Medical Center',
    status: 'inactive', registeredAt: '2025-01-05', totalDeliveries: 56, rating: 4.3, avatar: avatars[4],
  },
];

export const mockShipments: Shipment[] = [
  {
    id: '1', trackingId: 'AT-8842-X9', sender: 'TechFlow Inc.', receiver: 'Global Parts Ltd.',
    origin: 'Houston, TX', destination: 'Los Angeles, CA', status: 'in-transit',
    courierId: 'AT-CUR-7X92KP', courierName: 'Marcus Johnson', weight: '24.5 kg',
    type: 'Electronics', createdAt: '2025-01-15', estimatedDelivery: '2025-01-19',
    progress: 65, isPaused: false, lat: 34.0522, lng: -118.2437,
  },
  {
    id: '2', trackingId: 'AT-3291-K4', sender: 'MedPharma Global', receiver: 'City Hospital',
    origin: 'New York, NY', destination: 'Chicago, IL', status: 'out-for-delivery',
    courierId: 'AT-CUR-3B81NQ', courierName: 'Sofia Martinez', weight: '8.2 kg',
    type: 'Pharmaceuticals', createdAt: '2025-01-16', estimatedDelivery: '2025-01-18',
    progress: 90, isPaused: false, lat: 41.8781, lng: -87.6298,
  },
  {
    id: '3', trackingId: 'AT-5510-A2', sender: 'AutoMakers Co.', receiver: 'Precision Motors',
    origin: 'Detroit, MI', destination: 'Houston, TX', status: 'picked-up',
    courierId: 'AT-CUR-5F27WT', courierName: 'David Okafor', weight: '150.0 kg',
    type: 'Auto Parts', createdAt: '2025-01-17', estimatedDelivery: '2025-01-22',
    progress: 15, isPaused: false, lat: 42.3314, lng: -83.0458,
  },
  {
    id: '4', trackingId: 'AT-7723-M6', sender: 'Fashion House', receiver: 'Retail Store #42',
    origin: 'Miami, FL', destination: 'Atlanta, GA', status: 'pending',
    courierId: null, courierName: 'Unassigned', weight: '5.1 kg',
    type: 'Apparel', createdAt: '2025-01-17', estimatedDelivery: '2025-01-20',
    progress: 0, isPaused: false,
  },
  {
    id: '5', trackingId: 'AT-1198-B7', sender: 'Book Depot', receiver: 'University Library',
    origin: 'Boston, MA', destination: 'Philadelphia, PA', status: 'delivered',
    courierId: 'AT-CUR-9D44RL', courierName: 'Emily Chen', weight: '32.0 kg',
    type: 'Books & Documents', createdAt: '2025-01-10', estimatedDelivery: '2025-01-13',
    progress: 100, isPaused: false,
  },
  {
    id: '6', trackingId: 'AT-6645-Z1', sender: 'Fresh Foods Co.', receiver: 'Restaurant Group',
    origin: 'San Francisco, CA', destination: 'Seattle, WA', status: 'paused',
    courierId: 'AT-CUR-7X92KP', courierName: 'Marcus Johnson', weight: '45.0 kg',
    type: 'Perishables', createdAt: '2025-01-14', estimatedDelivery: '2025-01-17',
    progress: 40, isPaused: true, lat: 37.7749, lng: -122.4194,
  },
];
