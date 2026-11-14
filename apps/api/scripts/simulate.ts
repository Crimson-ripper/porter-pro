// Fake drivers for testing dispatch without real phones.
//
//   npm run simulate                      10 drivers around Connaught Place, Delhi
//   npm run simulate -- --drivers 30 --lat 19.076 --lng 72.8777   (Mumbai)
//
// Each driver goes online, accepts offers after a short delay, drives to the
// pickup, starts the trip (reads the OTP through the admin API), drives to the
// drop and completes it. Book from the customer app near the same location.

import { parseArgs } from 'node:util';
import { io, type Socket } from 'socket.io-client';
import { EVENTS, TEST_OTP, VEHICLE_TYPES, type JobOffer, type LatLng, type OrderView } from '@porter/shared';

const { values } = parseArgs({
  options: {
    drivers: { type: 'string', default: '10' },
    lat: { type: 'string', default: '28.6315' },
    lng: { type: 'string', default: '77.2167' },
    api: { type: 'string', default: process.env.API_URL ?? 'http://localhost:4000' },
    speed: { type: 'string', default: '10' }, // simulated metres per second × speed-up
    'admin-phone': { type: 'string', default: '9999999999' },
  },
});

const API = values.api!;
const CENTER: LatLng = { lat: Number(values.lat), lng: Number(values.lng) };
const COUNT = Number(values.drivers);
const STEP_M = Number(values.speed) * 20; // metres moved per 2-second tick

async function call<T>(path: string, token: string | null, body?: unknown, method = body ? 'POST' : 'GET'): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(`${method} ${path}: ${data.error}`);
  return data;
}

async function login(phone: string, role: 'driver' | 'admin') {
  await call('/auth/otp/send', null, { phone, role });
  const { token } = await call<{ token: string }>('/auth/otp/verify', null, { phone, role, otp: TEST_OTP });
  return token;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function moveToward(from: LatLng, to: LatLng, metres: number): { pos: LatLng; arrived: boolean } {
  const dLat = (to.lat - from.lat) * 111_000;
  const dLng = (to.lng - from.lng) * 111_000 * Math.cos((from.lat * Math.PI) / 180);
  const dist = Math.hypot(dLat, dLng);
  if (dist <= metres) return { pos: to, arrived: true };
  const f = metres / dist;
  return { pos: { lat: from.lat + (to.lat - from.lat) * f, lng: from.lng + (to.lng - from.lng) * f }, arrived: false };
}

function randomNear(c: LatLng, km: number): LatLng {
  const r = (km / 111) * Math.sqrt(Math.random());
  const t = Math.random() * 2 * Math.PI;
  return { lat: c.lat + r * Math.cos(t), lng: c.lng + (r * Math.sin(t)) / Math.cos((c.lat * Math.PI) / 180) };
}

const adminToken = await login(values['admin-phone']!, 'admin');

class FakeDriver {
  pos = randomNear(CENTER, 4);
  busy = false;
  socket!: Socket;
  token = '';

  constructor(
    public n: number,
    public phone: string,
  ) {}

  log(msg: string) {
    console.log(`[driver ${String(this.n).padStart(2)}] ${msg}`);
  }

  async start() {
    this.token = await login(this.phone, 'driver');
    const vehicle = VEHICLE_TYPES[this.n % VEHICLE_TYPES.length];
    await call('/driver/profile', this.token, {
      name: `Sim Driver ${this.n}`,
      vehicleType: vehicle.id,
      vehicleNumber: `DL01SM${String(1000 + this.n)}`,
    }, 'PUT');
    await call('/driver/online', this.token, { online: true, ...this.pos });
    this.socket = io(API, { auth: { token: this.token } });
    this.socket.on(EVENTS.offer, (offer: JobOffer) => void this.onOffer(offer));
    this.log(`online with ${vehicle.name}`);
    // Keep location fresh while idle.
    setInterval(() => {
      if (!this.busy) this.socket.emit(EVENTS.location, this.pos);
    }, 30_000);
  }

  async onOffer({ order }: JobOffer) {
    if (this.busy) return;
    this.log(`offer ${order.id.slice(0, 8)} ₹${order.fare} — accepting in 2s`);
    await sleep(2000);
    try {
      await call(`/driver/orders/${order.id}/accept`, this.token, {});
    } catch (e) {
      return this.log(`could not accept: ${(e as Error).message}`);
    }
    this.busy = true;
    try {
      await this.runTrip(order);
    } catch (e) {
      this.log(`trip stopped: ${(e as Error).message}`);
    }
    this.busy = false;
  }

  async drive(to: LatLng, orderId: string) {
    for (;;) {
      const { order } = await call<{ order: OrderView }>(`/orders/${orderId}`, this.token);
      if (order.status === 'cancelled') throw new Error('cancelled by customer');
      const step = moveToward(this.pos, to, STEP_M);
      this.pos = step.pos;
      this.socket.emit(EVENTS.location, this.pos);
      if (step.arrived) return;
      await sleep(2000);
    }
  }

  async runTrip(order: OrderView) {
    this.log('driving to pickup');
    await this.drive(order.pickup, order.id);
    await call(`/driver/orders/${order.id}/arrived`, this.token, {});
    this.log('arrived at pickup, waiting 5s');
    await sleep(5000);
    const { order: withOtp } = await call<{ order: OrderView }>(`/orders/${order.id}`, adminToken);
    await call(`/driver/orders/${order.id}/start`, this.token, { otp: withOtp.pickupOtp });
    this.log('trip started, driving to drop');
    await this.drive(order.drop, order.id);
    await call(`/driver/orders/${order.id}/complete`, this.token, {});
    this.log(`delivered, earned ₹${order.fare}`);
  }
}

console.log(`Starting ${COUNT} fake drivers around ${CENTER.lat}, ${CENTER.lng} → ${API}`);
for (let i = 1; i <= COUNT; i++) {
  await new FakeDriver(i, `90000${String(i).padStart(5, '0')}`).start();
}
console.log('All drivers online. Press Ctrl+C to stop.');
