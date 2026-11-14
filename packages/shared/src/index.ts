// Types, constants and pure logic shared by the API and every app.

export type Role = 'customer' | 'driver' | 'admin';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place extends LatLng {
  address: string;
}

// ---------- Vehicles & pricing ----------

export type VehicleTypeId = 'bike' | 'three_wheeler' | 'tata_ace' | 'pickup_8ft';

export interface VehicleType {
  id: VehicleTypeId;
  name: string;
  icon: string;
  capacity: string;
  baseFare: number; // ₹, includes the first BASE_KM
  perKm: number; // ₹ per km after BASE_KM
  minFare: number;
}

export const BASE_KM = 2;

export const VEHICLE_TYPES: VehicleType[] = [
  { id: 'bike', name: '2 Wheeler', icon: '🛵', capacity: 'Up to 20 kg', baseFare: 50, perKm: 10, minFare: 50 },
  { id: 'three_wheeler', name: '3 Wheeler', icon: '🛺', capacity: 'Up to 500 kg', baseFare: 150, perKm: 18, minFare: 150 },
  { id: 'tata_ace', name: 'Tata Ace', icon: '🚚', capacity: 'Up to 750 kg', baseFare: 250, perKm: 24, minFare: 250 },
  { id: 'pickup_8ft', name: 'Pickup 8ft', icon: '🚛', capacity: 'Up to 1250 kg', baseFare: 350, perKm: 30, minFare: 350 },
];

export function getVehicleType(id: string): VehicleType | undefined {
  return VEHICLE_TYPES.find((v) => v.id === id);
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Straight-line distance × 1.3 approximates road distance well enough for a PoC.
export function estimateRoadKm(a: LatLng, b: LatLng): number {
  return Math.round(haversineKm(a, b) * 1.3 * 10) / 10;
}

export function calculateFare(vehicleTypeId: VehicleTypeId, distanceKm: number): number {
  const v = getVehicleType(vehicleTypeId);
  if (!v) throw new Error(`Unknown vehicle type: ${vehicleTypeId}`);
  const fare = v.baseFare + Math.max(0, distanceKm - BASE_KM) * v.perKm;
  return Math.max(v.minFare, Math.round(fare));
}

// ---------- Orders ----------

export const ORDER_STATUSES = [
  'searching',
  'assigned',
  'arrived',
  'in_transit',
  'completed',
  'cancelled',
  'no_driver',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ACTIVE_STATUSES: OrderStatus[] = ['searching', 'assigned', 'arrived', 'in_transit'];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  searching: 'Finding a driver',
  assigned: 'Driver on the way',
  arrived: 'Driver at pickup',
  in_transit: 'On the way to drop',
  completed: 'Delivered',
  cancelled: 'Cancelled',
  no_driver: 'No driver available',
};

export type PaymentMethod = 'cash';

export interface OrderView {
  id: string;
  status: OrderStatus;
  vehicleType: VehicleTypeId;
  pickup: Place;
  drop: Place;
  distanceKm: number;
  fare: number;
  paymentMethod: PaymentMethod;
  pickupOtp?: string; // only sent to the customer
  cancelReason: string | null;
  customerRating: number | null;
  createdAt: string;
  customer: { name: string; phone: string } | null;
  driver: { name: string; phone: string; vehicleNumber: string; lat: number | null; lng: number | null } | null;
}

export interface JobOffer {
  order: OrderView;
  expiresInSec: number;
}

export interface UserView {
  id: string;
  phone: string;
  name: string;
  role: Role;
}

export interface DriverProfile {
  vehicleType: VehicleTypeId | null;
  vehicleNumber: string | null;
  online: boolean;
  busy: boolean;
  todayEarnings: number;
  todayTrips: number;
}

// Proof-of-concept login: every phone number accepts this OTP. No SMS is sent.
export const TEST_OTP = '123456';

// ---------- HTTP client (used by the apps) ----------

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createApi(baseUrl: string, getToken: () => string | null) {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const token = getToken();
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, `Cannot reach the server at ${baseUrl}. Is the API running?`);
    } finally {
      clearTimeout(timer);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
    return data as T;
  }
  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
    put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
    patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  };
}

export type Api = ReturnType<typeof createApi>;

// Socket.IO event names
export const EVENTS = {
  orderUpdate: 'order_update',
  offer: 'offer',
  offerCancelled: 'offer_cancelled',
  driverLocation: 'driver_location',
  location: 'location',
} as const;
