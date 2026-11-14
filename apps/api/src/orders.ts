import type { OrderStatus, OrderView, PaymentMethod, VehicleTypeId } from '@porter/shared';
import { db } from './db.ts';
import { emitOrderUpdate } from './realtime.ts';

export interface OrderRow {
  id: string;
  customer_id: string;
  driver_id: string | null;
  offered_driver_id: string | null;
  vehicle_type: VehicleTypeId;
  status: OrderStatus;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  drop_lat: number;
  drop_lng: number;
  drop_address: string;
  distance_km: number;
  fare: number;
  payment_method: PaymentMethod;
  pickup_otp: string;
  cancel_reason: string | null;
  customer_rating: number | null;
  created_at: Date | string;
  customer_name: string;
  customer_phone: string;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_number: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
}

const SELECT_ORDER = `
  SELECT o.*, c.name AS customer_name, c.phone AS customer_phone,
         du.name AS driver_name, du.phone AS driver_phone,
         d.vehicle_number, d.lat AS driver_lat, d.lng AS driver_lng
  FROM orders o
  JOIN users c ON c.id = o.customer_id
  LEFT JOIN users du ON du.id = o.driver_id
  LEFT JOIN drivers d ON d.user_id = o.driver_id`;

export type Viewer = 'customer' | 'driver' | 'admin';

export function toView(r: OrderRow, viewer: Viewer): OrderView {
  return {
    id: r.id,
    status: r.status,
    vehicleType: r.vehicle_type,
    pickup: { lat: r.pickup_lat, lng: r.pickup_lng, address: r.pickup_address },
    drop: { lat: r.drop_lat, lng: r.drop_lng, address: r.drop_address },
    distanceKm: r.distance_km,
    fare: r.fare,
    paymentMethod: r.payment_method,
    ...(viewer !== 'driver' ? { pickupOtp: r.pickup_otp } : {}),
    cancelReason: r.cancel_reason,
    customerRating: r.customer_rating,
    createdAt: new Date(r.created_at).toISOString(),
    customer: { name: r.customer_name, phone: r.customer_phone },
    driver: r.driver_id
      ? {
          name: r.driver_name ?? '',
          phone: r.driver_phone ?? '',
          vehicleNumber: r.vehicle_number ?? '',
          lat: r.driver_lat,
          lng: r.driver_lng,
        }
      : null,
  };
}

export async function getOrderRow(id: string): Promise<OrderRow | undefined> {
  const [row] = await db.query<OrderRow>(`${SELECT_ORDER} WHERE o.id = $1`, [id]);
  return row;
}

export async function listOrderRows(where: string, params: unknown[], limit = 50): Promise<OrderRow[]> {
  return db.query<OrderRow>(`${SELECT_ORDER} WHERE ${where} ORDER BY o.created_at DESC LIMIT ${limit}`, params);
}

// Re-reads the order and pushes it to the customer and the assigned driver.
export async function broadcastOrder(orderId: string) {
  const row = await getOrderRow(orderId);
  if (row) emitOrderUpdate(toView(row, 'customer'), row.customer_id, row.driver_id);
  return row;
}

// Moves an order to `to` only if it is currently in one of `from`, so two
// requests racing on the same order cannot both succeed. `extraSet` adds more
// "column = $n" assignments, numbered from $4.
export async function transition(
  orderId: string,
  from: OrderStatus[],
  to: OrderStatus,
  extraSet = '',
  extraParams: unknown[] = [],
  extraWhere = '',
): Promise<boolean> {
  const rows = await db.query(
    `UPDATE orders SET status = $3, updated_at = now()${extraSet}
     WHERE id = $1 AND status = ANY($2::text[])${extraWhere} RETURNING id`,
    [orderId, from, to, ...extraParams],
  );
  if (!rows.length) return false;
  await db.query('INSERT INTO order_events (order_id, status) VALUES ($1, $2)', [orderId, to]);
  return true;
}
