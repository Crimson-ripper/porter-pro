// Edge-case checks against a running API (no simulator needed; this script
// plays both the customer and the driver).
//
//   npm run check -w apps/api

import { io, type Socket } from 'socket.io-client';
import { EVENTS, TEST_OTP, type JobOffer, type OrderView } from '@porter/shared';

const API = process.env.API_URL ?? 'http://localhost:4000';
let failures = 0;

function ok(cond: unknown, name: string) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

async function call(path: string, token: string | null, body?: unknown, method?: string) {
  const res = await fetch(`${API}${path}`, {
    method: method ?? (body !== undefined ? 'POST' : 'GET'),
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: (await res.json()) as any };
}

async function login(phone: string, role: string) {
  return (await call('/auth/otp/verify', null, { phone, role, otp: TEST_OTP })).data.token as string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitFor = <T>(socket: Socket, event: string, pred: (x: T) => boolean = () => true, ms = 8000) =>
  new Promise<T | null>((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    const h = (x: T) => {
      if (pred(x)) {
        clearTimeout(t);
        socket.off(event, h);
        resolve(x);
      }
    };
    socket.on(event, h);
  });

// Use an area far from the simulator's default so its drivers don't interfere.
const C = { lat: 12.9716, lng: 77.5946 };
const pickup = { ...C, address: 'Test pickup' };
const drop = { lat: C.lat + 0.03, lng: C.lng + 0.01, address: 'Test drop' };

// --- auth
ok((await call('/auth/otp/verify', null, { phone: '7000000001', role: 'customer', otp: '000000' })).status === 400, 'wrong OTP rejected');
ok((await call('/auth/otp/send', null, { phone: '12345', role: 'customer' })).status === 400, 'invalid phone rejected');
ok((await call('/orders', null)).status === 401, 'no token -> 401');
ok((await call('/auth/otp/verify', null, { phone: '7000000009', role: 'admin', otp: TEST_OTP })).status === 403, 'non-admin cannot log in as admin');

const cust = await login('7000000001', 'customer');
const cust2 = await login('7000000002', 'customer');
await call('/me', cust, { name: 'Check Customer' }, 'PATCH');
ok((await call('/driver/profile', cust)).status === 403, 'customer cannot use driver endpoints');

// Reset any leftover active orders from earlier runs.
for (const t of [cust, cust2]) {
  const a = (await call('/orders/active', t)).data.order;
  if (a) await call(`/orders/${a.id}/cancel`, t, {});
}

// --- drivers
const d1 = await login('7100000001', 'driver');
const d2 = await login('7100000002', 'driver');
const fresh = await login(`72${String(Date.now()).slice(-8)}`, 'driver');
ok((await call('/driver/online', fresh, { online: true })).status === 400, 'driver without vehicle cannot go online');
ok((await call('/driver/profile', d1, { name: 'Check D1', vehicleType: 'tata_ace', vehicleNumber: 'bad' }, 'PUT')).status === 400, 'invalid vehicle number rejected');
for (const [t, n, km] of [[d1, 1, 0.5], [d2, 2, 1.5]] as const) {
  await call('/driver/profile', t, { name: `Check D${n}`, vehicleType: 'tata_ace', vehicleNumber: `KA01CK000${n}` }, 'PUT');
  const r = await call('/driver/online', t, { online: true, lat: C.lat + km / 111, lng: C.lng });
  ok(r.data.driver?.online === true, `driver ${n} online`);
}
const s1 = io(API, { auth: { token: d1 } });
const s2 = io(API, { auth: { token: d2 } });
const sc = io(API, { auth: { token: cust } });
await Promise.all([s1, s2, sc].map((s) => new Promise<void>((r) => s.on('connect', () => r()))));
const bad = io(API, { auth: { token: 'nope' } });
ok(await new Promise((r) => { bad.on('connect_error', () => r(true)); setTimeout(() => r(false), 3000); }), 'socket with bad token refused');
bad.close();

// --- fare
const est = (await call('/fare/estimate', cust, { pickup, drop })).data;
ok(est.distanceKm > 0 && est.options.length === 4, `fare estimate (${est.distanceKm} km)`);
ok((await call('/orders', cust, { pickup, drop: pickup, vehicleType: 'tata_ace' })).status === 400, 'pickup == drop rejected');

// --- nearest driver gets the offer first; reject passes it on
const offer1 = waitFor<JobOffer>(s1, EVENTS.offer);
const o1 = (await call('/orders', cust, { pickup, drop, vehicleType: 'tata_ace' })).data.order as OrderView;
ok(o1?.status === 'searching' && o1.pickupOtp?.length === 4, 'order created with OTP');
ok((await call('/orders', cust, { pickup, drop, vehicleType: 'tata_ace' })).status === 409, 'second active order blocked');
const got1 = await offer1;
ok(got1?.order.id === o1.id, 'nearest driver (D1) gets offer');
ok(got1 && !('pickupOtp' in got1.order && got1.order.pickupOtp), 'offer hides pickup OTP from driver');
ok((await call(`/driver/orders/${o1.id}/accept`, d2, {})).status === 409, 'driver not offered cannot accept');

const offer2 = waitFor<JobOffer>(s2, EVENTS.offer);
await call(`/driver/orders/${o1.id}/reject`, d1, {});
ok((await offer2)?.order.id === o1.id, 'after reject, offer goes to D2');

// --- accept, trip flow
const assigned = waitFor<OrderView>(sc, EVENTS.orderUpdate, (o) => o.status === 'assigned');
ok((await call(`/driver/orders/${o1.id}/accept`, d2, {})).status === 200, 'D2 accepts');
ok((await assigned)?.driver?.name === 'Check D2', 'customer notified with driver details');
ok((await call(`/driver/orders/${o1.id}/accept`, d1, {})).status === 409, 'cannot accept an assigned order');
ok((await call(`/orders/${o1.id}`, cust2)).status === 404, 'other customer cannot see order');

const loc = waitFor<{ lat: number }>(sc, EVENTS.driverLocation);
s2.emit(EVENTS.location, { lat: C.lat + 0.001, lng: C.lng });
ok(!!(await loc), 'customer receives live driver location');

ok((await call(`/driver/orders/${o1.id}/start`, d2, { otp: o1.pickupOtp })).status === 409, 'cannot start before arriving');
await call(`/driver/orders/${o1.id}/arrived`, d2, {});
ok((await call(`/driver/orders/${o1.id}/start`, d2, { otp: '0000' })).status === 400, 'wrong pickup OTP rejected');
ok((await call(`/driver/orders/${o1.id}/start`, d2, { otp: o1.pickupOtp })).status === 200, 'correct OTP starts trip');
ok((await call(`/orders/${o1.id}/cancel`, cust, {})).status === 409, 'customer cannot cancel once in transit');
const completed = waitFor<OrderView>(sc, EVENTS.orderUpdate, (o) => o.status === 'completed');
ok((await call(`/driver/orders/${o1.id}/complete`, d2, {})).status === 200, 'driver completes trip');
ok(!!(await completed), 'customer notified of completion');
ok((await call(`/orders/${o1.id}/rate`, cust, { rating: 5 })).status === 200, 'customer rates trip');
const p2 = (await call('/driver/profile', d2)).data.driver;
ok(p2.busy === false && p2.todayEarnings >= o1.fare, `D2 free again, earnings ₹${p2.todayEarnings}`);

// Books an order and returns whichever driver was offered it (the nearest one).
async function bookAndGetOfferedDriver() {
  const which = Promise.race([
    waitFor<JobOffer>(s1, EVENTS.offer).then((o) => (o ? { token: d1, socket: s1 } : null)),
    waitFor<JobOffer>(s2, EVENTS.offer).then((o) => (o ? { token: d2, socket: s2 } : null)),
  ]);
  const order = (await call('/orders', cust, { pickup, drop, vehicleType: 'tata_ace' })).data.order as OrderView;
  return { order, driver: (await which)! };
}

// --- customer cancels while driver assigned -> driver freed and notified
const { order: o2, driver: dA } = await bookAndGetOfferedDriver();
ok((await call(`/driver/orders/${o2.id}/accept`, dA.token, {})).status === 200, 'nearest driver accepts');
const dCancelled = waitFor<OrderView>(dA.socket, EVENTS.orderUpdate, (o) => o.status === 'cancelled');
ok((await call(`/orders/${o2.id}/cancel`, cust, { reason: 'changed plans' })).status === 200, 'customer cancels assigned order');
ok(!!(await dCancelled), 'driver notified of cancellation');
ok((await call('/driver/profile', dA.token)).data.driver.busy === false, 'driver freed after cancel');

// --- driver cancels
const { order: o3, driver: dB } = await bookAndGetOfferedDriver();
await call(`/driver/orders/${o3.id}/accept`, dB.token, {});
ok((await call(`/driver/orders/${o3.id}/cancel`, dB.token, {})).status === 200, 'driver cancels trip');
ok((await call(`/orders/${o3.id}`, cust)).data.order.status === 'cancelled', 'order shows cancelled');

// --- no driver for a vehicle type -> no_driver
const noDriver = waitFor<OrderView>(sc, EVENTS.orderUpdate, (o) => o.status === 'no_driver');
const o4 = (await call('/orders', cust, { pickup, drop, vehicleType: 'pickup_8ft' })).data.order as OrderView;
ok(!!(await noDriver) && o4, 'no driver available -> no_driver');

// --- offline drivers get nothing
await call('/driver/online', d1, { online: false });
await call('/driver/online', d2, { online: false });
const noOffer = waitFor<JobOffer>(s1, EVENTS.offer, () => true, 3000);
const o5 = (await call('/orders', cust, { pickup, drop, vehicleType: 'tata_ace' })).data.order as OrderView;
ok((await noOffer) === null, 'offline driver receives no offer');
await sleep(500);
ok((await call(`/orders/${o5.id}`, cust)).data.order.status === 'no_driver', 'order with only offline drivers -> no_driver');

// --- histories, geo, admin
ok((await call('/orders', cust)).data.orders.length >= 5, 'customer order history');
ok((await call('/driver/orders', d2)).data.orders.some((o: OrderView) => o.id === o1.id), 'driver trip history');
const admin = await login('9999999999', 'admin');
ok((await call('/admin/summary', admin)).data.summary?.orders_today >= 5, 'admin summary');
ok((await call('/admin/summary', cust)).status === 403, 'customer cannot see admin');
const geo = await call('/geo/search?q=MG%20Road%20Bengaluru', cust);
ok(geo.status === 200 && geo.data.places.length > 0, `address search (${geo.data.places?.length ?? geo.data.error} results)`);
await sleep(1100);
const rev = await call(`/geo/reverse?lat=${C.lat}&lng=${C.lng}`, cust);
ok(rev.status === 200 && rev.data.place.address.length > 5, 'reverse geocode');

[s1, s2, sc].forEach((s) => s.close());
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
