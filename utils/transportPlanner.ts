/**
 * Multi-modal route types.
 *
 * Route planning now runs on the server (server/utils/transportPlanner.js,
 * POST /api/routing/plans) so the admin planner and later re-routing use the
 * same rules. The admin timeline model lives in utils/shipmentTimeline.ts.
 */

export interface RouteSegment {
  mode: 'road' | 'air' | 'sea';
  coordinates: [number, number][];
  from: { name: string; coords: [number, number] };
  to: { name: string; coords: [number, number] };
  distanceKm: number;
  durationHours: number;
  speedKmh: number;
  label: string;
  icon: string;
}

export interface TransitStop {
  name: string;
  coords: [number, number];
  type: 'airport' | 'seaport' | 'customs' | 'border' | 'transit_airport' | 'rest' | 'facility';
  waitHours: number;
  label: string;
  icon: string;
  role?: 'origin_hub' | 'dest_hub' | 'transit' | 'rest' | 'processing';
  afterSegment?: number;
}
