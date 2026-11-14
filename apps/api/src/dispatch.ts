import { EVENTS, type JobOffer } from '@porter/shared';
import { config } from './config.ts';
import { db } from './db.ts';
import { broadcastOrder, getOrderRow, toView, transition } from './orders.ts';
import { emitToUser } from './realtime.ts';

// Offers each new order to the nearest free driver of the right vehicle type,
// one driver at a time, moving on after a timeout or a reject.
//
// State lives in memory, which is fine for a single-server PoC. Move it to
// Redis/BullMQ before running more than one API instance.
interface DispatchState {
  tried: Set<string>;
  currentDriverId: string | null;
  timer: NodeJS.Timeout | null;
}
const active = new Map<string, DispatchState>();

export function startDispatch(orderId: string) {
  active.set(orderId, { tried: new Set(), currentDriverId: null, timer: null });
  void offerNext(orderId);
}

async function findNearestDriver(orderId: string, exclude: string[]) {
  const [driver] = await db.query<{ user_id: string; distance_km: number }>(
    `WITH o AS (SELECT pickup_lat, pickup_lng, vehicle_type FROM orders WHERE id = $1)
     SELECT * FROM (
       SELECT d.user_id,
              6371 * 2 * asin(sqrt(
                power(sin(radians(d.lat - o.pickup_lat) / 2), 2) +
                cos(radians(o.pickup_lat)) * cos(radians(d.lat)) *
                power(sin(radians(d.lng - o.pickup_lng) / 2), 2)
              )) AS distance_km
       FROM drivers d, o
       WHERE d.online AND NOT d.busy
         AND d.vehicle_type = o.vehicle_type
         AND d.lat IS NOT NULL
         AND d.location_at > now() - make_interval(secs => $2)
         AND NOT (d.user_id = ANY($3::uuid[]))
     ) x
     WHERE distance_km <= $4
     ORDER BY distance_km
     LIMIT 1`,
    [orderId, config.driverLocationMaxAgeSec, exclude, config.searchRadiusKm],
  );
  return driver;
}

async function offerNext(orderId: string) {
  const state = active.get(orderId);
  if (!state) return;
  state.currentDriverId = null;
  const row = await getOrderRow(orderId);
  if (!row || row.status !== 'searching') return stop(orderId);

  const driver =
    state.tried.size < config.maxOfferAttempts ? await findNearestDriver(orderId, [...state.tried]) : undefined;

  if (!driver) {
    stop(orderId);
    if (await transition(orderId, ['searching'], 'no_driver')) await broadcastOrder(orderId);
    return;
  }

  state.tried.add(driver.user_id);
  state.currentDriverId = driver.user_id;
  await db.query('UPDATE orders SET offered_driver_id = $2 WHERE id = $1', [orderId, driver.user_id]);

  const offer: JobOffer = { order: toView(row, 'driver'), expiresInSec: config.offerTimeoutSec };
  emitToUser(driver.user_id, EVENTS.offer, offer);

  state.timer = setTimeout(() => {
    emitToUser(driver.user_id, EVENTS.offerCancelled, { orderId });
    void offerNext(orderId);
  }, config.offerTimeoutSec * 1000);
}

function stop(orderId: string) {
  const state = active.get(orderId);
  if (state?.timer) clearTimeout(state.timer);
  active.delete(orderId);
}

// Returns true if this driver got the order. Only the driver currently being
// offered the order can accept it, and only once.
export async function acceptOffer(orderId: string, driverId: string): Promise<boolean> {
  const won = await transition(
    orderId,
    ['searching'],
    'assigned',
    ', driver_id = $4',
    [driverId],
    ' AND offered_driver_id = $4',
  );
  if (!won) return false;
  stop(orderId);
  await db.query('UPDATE drivers SET busy = true WHERE user_id = $1', [driverId]);
  await broadcastOrder(orderId);
  return true;
}

export function rejectOffer(orderId: string, driverId: string) {
  const state = active.get(orderId);
  if (!state || state.currentDriverId !== driverId) return;
  if (state.timer) clearTimeout(state.timer);
  void offerNext(orderId);
}

export function cancelDispatch(orderId: string) {
  const state = active.get(orderId);
  if (state?.currentDriverId) emitToUser(state.currentDriverId, EVENTS.offerCancelled, { orderId });
  stop(orderId);
}

// Orders still "searching" after a restart lost their in-memory state.
export async function resumeSearchingOrders() {
  const rows = await db.query<{ id: string }>(`SELECT id FROM orders WHERE status = 'searching'`);
  for (const r of rows) startDispatch(r.id);
}
