import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EVENTS, VEHICLE_TYPES, type VehicleTypeId } from '@porter/shared';
import { HttpError, requireUser } from '../auth.ts';
import { db } from '../db.ts';
import { acceptOffer, rejectOffer } from '../dispatch.ts';
import { broadcastOrder, getOrderRow, listOrderRows, toView, transition } from '../orders.ts';
import { emitToUser } from '../realtime.ts';
import { getDriverProfile } from './auth.ts';

const vehicleType = z.enum(VEHICLE_TYPES.map((v) => v.id) as [VehicleTypeId, ...VehicleTypeId[]]);
const orderParams = z.object({ id: z.string().uuid() });

// Stores the driver's position and forwards it to the customer of their current trip.
export async function updateDriverLocation(driverId: string, lat: number, lng: number) {
  await db.query('UPDATE drivers SET lat = $2, lng = $3, location_at = now() WHERE user_id = $1', [driverId, lat, lng]);
  const [order] = await db.query<{ id: string; customer_id: string }>(
    `SELECT id, customer_id FROM orders
     WHERE driver_id = $1 AND status IN ('assigned', 'arrived', 'in_transit') LIMIT 1`,
    [driverId],
  );
  if (order) emitToUser(order.customer_id, EVENTS.driverLocation, { orderId: order.id, lat, lng });
}

async function ownTrip(orderId: string, driverId: string) {
  const row = await getOrderRow(orderId);
  if (!row || row.driver_id !== driverId) throw new HttpError(404, 'Trip not found');
  return row;
}

export async function driverRoutes(app: FastifyInstance) {
  app.get('/driver/profile', async (req) => {
    const { id } = await requireUser(req, 'driver');
    return { driver: await getDriverProfile(id) };
  });

  app.put('/driver/profile', async (req) => {
    const { id } = await requireUser(req, 'driver');
    const body = z
      .object({
        name: z.string().trim().min(2, 'Enter your name').max(60),
        vehicleType,
        vehicleNumber: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{4}$/, 'Enter a valid vehicle number, e.g. MH12AB1234'),
      })
      .parse(req.body);
    await db.query('UPDATE users SET name = $2 WHERE id = $1', [id, body.name]);
    await db.query('UPDATE drivers SET vehicle_type = $2, vehicle_number = $3 WHERE user_id = $1', [
      id,
      body.vehicleType,
      body.vehicleNumber.replace(/\s/g, ''),
    ]);
    return { driver: await getDriverProfile(id) };
  });

  app.post('/driver/online', async (req) => {
    const { id } = await requireUser(req, 'driver');
    const { online, lat, lng } = z
      .object({ online: z.boolean(), lat: z.number().optional(), lng: z.number().optional() })
      .parse(req.body);
    const profile = await getDriverProfile(id);
    if (online && !profile.vehicleType) throw new HttpError(400, 'Add your vehicle details first');
    await db.query('UPDATE drivers SET online = $2 WHERE user_id = $1', [id, online]);
    if (online && lat !== undefined && lng !== undefined) await updateDriverLocation(id, lat, lng);
    return { driver: await getDriverProfile(id) };
  });

  app.post('/driver/location', async (req) => {
    const { id } = await requireUser(req, 'driver');
    const { lat, lng } = z.object({ lat: z.number(), lng: z.number() }).parse(req.body);
    await updateDriverLocation(id, lat, lng);
    return { ok: true };
  });

  app.get('/driver/active-order', async (req) => {
    const { id } = await requireUser(req, 'driver');
    const [row] = await listOrderRows(`o.driver_id = $1 AND o.status IN ('assigned', 'arrived', 'in_transit')`, [id], 1);
    return { order: row ? toView(row, 'driver') : null };
  });

  app.get('/driver/orders', async (req) => {
    const { id } = await requireUser(req, 'driver');
    const rows = await listOrderRows('o.driver_id = $1', [id]);
    return { orders: rows.map((r) => toView(r, 'driver')) };
  });

  app.post('/driver/orders/:id/accept', async (req) => {
    const { id: driverId } = await requireUser(req, 'driver');
    const { id } = orderParams.parse(req.params);
    if (!(await acceptOffer(id, driverId))) throw new HttpError(409, 'This job is no longer available');
    return { order: toView((await getOrderRow(id))!, 'driver') };
  });

  app.post('/driver/orders/:id/reject', async (req) => {
    const { id: driverId } = await requireUser(req, 'driver');
    const { id } = orderParams.parse(req.params);
    rejectOffer(id, driverId);
    return { ok: true };
  });

  app.post('/driver/orders/:id/arrived', async (req) => {
    const { id: driverId } = await requireUser(req, 'driver');
    const { id } = orderParams.parse(req.params);
    await ownTrip(id, driverId);
    if (!(await transition(id, ['assigned'], 'arrived'))) throw new HttpError(409, 'Trip is not in the right state');
    return { order: toView((await broadcastOrder(id))!, 'driver') };
  });

  app.post('/driver/orders/:id/start', async (req) => {
    const { id: driverId } = await requireUser(req, 'driver');
    const { id } = orderParams.parse(req.params);
    const { otp } = z.object({ otp: z.string() }).parse(req.body);
    const row = await ownTrip(id, driverId);
    if (otp.trim() !== row.pickup_otp) throw new HttpError(400, 'Wrong OTP. Ask the customer for the 4-digit OTP');
    if (!(await transition(id, ['arrived'], 'in_transit'))) throw new HttpError(409, 'Trip is not in the right state');
    return { order: toView((await broadcastOrder(id))!, 'driver') };
  });

  app.post('/driver/orders/:id/complete', async (req) => {
    const { id: driverId } = await requireUser(req, 'driver');
    const { id } = orderParams.parse(req.params);
    await ownTrip(id, driverId);
    if (!(await transition(id, ['in_transit'], 'completed'))) throw new HttpError(409, 'Trip is not in the right state');
    await db.query('UPDATE drivers SET busy = false WHERE user_id = $1', [driverId]);
    return { order: toView((await broadcastOrder(id))!, 'driver') };
  });

  app.post('/driver/orders/:id/cancel', async (req) => {
    const { id: driverId } = await requireUser(req, 'driver');
    const { id } = orderParams.parse(req.params);
    await ownTrip(id, driverId);
    const ok = await transition(id, ['assigned', 'arrived'], 'cancelled', ', cancel_reason = $4', ['Cancelled by driver']);
    if (!ok) throw new HttpError(409, 'This trip can no longer be cancelled');
    await db.query('UPDATE drivers SET busy = false WHERE user_id = $1', [driverId]);
    return { order: toView((await broadcastOrder(id))!, 'driver') };
  });
}
