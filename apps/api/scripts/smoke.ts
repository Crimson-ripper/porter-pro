// End-to-end check: books one order as a customer and waits for a simulated
// driver to deliver it. Run the API and `npm run simulate` first.
//
//   npm run smoke -w apps/api

import { io } from 'socket.io-client';
import { EVENTS, TEST_OTP, type OrderView } from '@porter/shared';

const API = process.env.API_URL ?? 'http://localhost:4000';

async function call<T>(path: string, token: string | null, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(`${path}: ${data.error}`);
  return data;
}

const phone = '8000000001';
const { token } = await call<{ token: string }>('/auth/otp/verify', null, { phone, role: 'customer', otp: TEST_OTP });

const { order: existing } = await call<{ order: OrderView | null }>('/orders/active', token);
if (existing) await call(`/orders/${existing.id}/cancel`, token, { reason: 'smoke test reset' });

const pickup = { lat: 28.6328, lng: 77.2197, address: 'Connaught Place, New Delhi' };
const drop = { lat: 28.6448, lng: 77.2167, address: 'Paharganj, New Delhi' };

const estimate = await call<{ distanceKm: number; options: { vehicleType: string; fare: number }[] }>(
  '/fare/estimate',
  token,
  { pickup, drop },
);
console.log(`Estimate: ${estimate.distanceKm} km`, estimate.options);

const socket = io(API, { auth: { token } });
let locations = 0;
socket.on(EVENTS.driverLocation, () => locations++);

const done = new Promise<OrderView>((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Timed out after 3 minutes')), 180_000);
  socket.on(EVENTS.orderUpdate, (o: OrderView) => {
    console.log(`status: ${o.status}${o.driver ? ` (driver ${o.driver.name}, ${o.driver.vehicleNumber})` : ''}`);
    if (['completed', 'cancelled', 'no_driver'].includes(o.status)) {
      clearTimeout(timeout);
      resolve(o);
    }
  });
});

await new Promise<void>((r) => socket.on('connect', () => r()));
const { order } = await call<{ order: OrderView }>('/orders', token, { pickup, drop, vehicleType: 'bike' });
console.log(`Booked ${order.id} for ₹${order.fare}, OTP ${order.pickupOtp}`);

const final = await done;
socket.close();
console.log(`Final status: ${final.status}, live location updates received: ${locations}`);
if (final.status !== 'completed') process.exit(1);
await call(`/orders/${final.id}/rate`, token, { rating: 5 });
console.log('Smoke test passed');
