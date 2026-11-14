import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ACTIVE_STATUSES,
  VEHICLE_TYPES,
  calculateFare,
  estimateRoadKm,
  type VehicleTypeId,
} from '@porter/shared';
import { HttpError, requireUser } from '../auth.ts';
import { db } from '../db.ts';
import { cancelDispatch, startDispatch } from '../dispatch.ts';
import { broadcastOrder, getOrderRow, listOrderRows, toView, transition } from '../orders.ts';

export const place = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().trim().min(1).max(300),
});
const vehicleType = z.enum(VEHICLE_TYPES.map((v) => v.id) as [VehicleTypeId, ...VehicleTypeId[]]);

export async function customerRoutes(app: FastifyInstance) {
  app.get('/vehicle-types', async () => ({ vehicleTypes: VEHICLE_TYPES }));

  app.post('/fare/estimate', async (req) => {
    await requireUser(req, 'customer');
    const { pickup, drop } = z.object({ pickup: place, drop: place }).parse(req.body);
    const distanceKm = estimateRoadKm(pickup, drop);
    return {
      distanceKm,
      options: VEHICLE_TYPES.map((v) => ({ vehicleType: v.id, fare: calculateFare(v.id, distanceKm) })),
    };
  });

  app.post('/orders', async (req) => {
    const { id: customerId } = await requireUser(req, 'customer');
    const body = z.object({ pickup: place, drop: place, vehicleType }).parse(req.body);

    const [existing] = await db.query(
      'SELECT id FROM orders WHERE customer_id = $1 AND status = ANY($2::text[]) LIMIT 1',
      [customerId, ACTIVE_STATUSES],
    );
    if (existing) throw new HttpError(409, 'You already have a booking in progress');

    const distanceKm = estimateRoadKm(body.pickup, body.drop);
    if (distanceKm < 0.2) throw new HttpError(400, 'Pickup and drop are too close');
    const fare = calculateFare(body.vehicleType, distanceKm);
    const otp = String(Math.floor(1000 + Math.random() * 9000));

    const [{ id }] = await db.query<{ id: string }>(
      `INSERT INTO orders (customer_id, vehicle_type, status, pickup_lat, pickup_lng, pickup_address,
                           drop_lat, drop_lng, drop_address, distance_km, fare, pickup_otp)
       VALUES ($1, $2, 'searching', $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        customerId,
        body.vehicleType,
        body.pickup.lat,
        body.pickup.lng,
        body.pickup.address,
        body.drop.lat,
        body.drop.lng,
        body.drop.address,
        distanceKm,
        fare,
        otp,
      ],
    );
    await db.query(`INSERT INTO order_events (order_id, status) VALUES ($1, 'searching')`, [id]);
    startDispatch(id);
    return { order: toView((await getOrderRow(id))!, 'customer') };
  });

  app.get('/orders', async (req) => {
    const { id } = await requireUser(req, 'customer');
    const rows = await listOrderRows('o.customer_id = $1', [id]);
    return { orders: rows.map((r) => toView(r, 'customer')) };
  });

  app.get('/orders/active', async (req) => {
    const { id } = await requireUser(req, 'customer');
    const [row] = await listOrderRows('o.customer_id = $1 AND o.status = ANY($2::text[])', [id, ACTIVE_STATUSES], 1);
    return { order: row ? toView(row, 'customer') : null };
  });

  app.get('/orders/:id', async (req) => {
    const user = await requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const row = await getOrderRow(id);
    const allowed = row && (user.role === 'admin' || row.customer_id === user.id || row.driver_id === user.id);
    if (!allowed) throw new HttpError(404, 'Order not found');
    return { order: toView(row, user.role === 'driver' ? 'driver' : 'customer') };
  });

  app.post('/orders/:id/cancel', async (req) => {
    const { id: customerId } = await requireUser(req, 'customer');
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { reason } = z.object({ reason: z.string().max(200).default('Cancelled by customer') }).parse(req.body ?? {});
    const row = await getOrderRow(id);
    if (!row || row.customer_id !== customerId) throw new HttpError(404, 'Order not found');

    const ok = await transition(id, ['searching', 'assigned', 'arrived'], 'cancelled', ', cancel_reason = $4', [reason]);
    if (!ok) throw new HttpError(409, 'This booking can no longer be cancelled');
    cancelDispatch(id);
    if (row.driver_id) await db.query('UPDATE drivers SET busy = false WHERE user_id = $1', [row.driver_id]);
    return { order: toView((await broadcastOrder(id))!, 'customer') };
  });

  app.post('/orders/:id/rate', async (req) => {
    const { id: customerId } = await requireUser(req, 'customer');
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { rating } = z.object({ rating: z.number().int().min(1).max(5) }).parse(req.body);
    const rows = await db.query(
      `UPDATE orders SET customer_rating = $3 WHERE id = $1 AND customer_id = $2 AND status = 'completed' RETURNING id`,
      [id, customerId, rating],
    );
    if (!rows.length) throw new HttpError(404, 'Order not found');
    return { ok: true };
  });
}
