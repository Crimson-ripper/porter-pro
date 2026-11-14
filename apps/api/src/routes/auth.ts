import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TEST_OTP, type DriverProfile, type Role, type UserView } from '@porter/shared';
import { HttpError, requireUser } from '../auth.ts';
import { config } from '../config.ts';
import { db } from '../db.ts';

const phone = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');
const role = z.enum(['customer', 'driver', 'admin']);

export async function getDriverProfile(userId: string): Promise<DriverProfile> {
  const [d] = await db.query<{
    vehicle_type: DriverProfile['vehicleType'];
    vehicle_number: string | null;
    online: boolean;
    busy: boolean;
  }>('SELECT vehicle_type, vehicle_number, online, busy FROM drivers WHERE user_id = $1', [userId]);
  const [today] = await db.query<{ trips: number; earnings: number }>(
    `SELECT count(*)::int AS trips, coalesce(sum(fare), 0)::int AS earnings
     FROM orders WHERE driver_id = $1 AND status = 'completed' AND updated_at >= date_trunc('day', now())`,
    [userId],
  );
  return {
    vehicleType: d?.vehicle_type ?? null,
    vehicleNumber: d?.vehicle_number ?? null,
    online: d?.online ?? false,
    busy: d?.busy ?? false,
    todayEarnings: today?.earnings ?? 0,
    todayTrips: today?.trips ?? 0,
  };
}

export async function authRoutes(app: FastifyInstance) {
  // PoC: no SMS is sent. Every number accepts TEST_OTP.
  app.post('/auth/otp/send', async (req) => {
    const body = z.object({ phone, role }).parse(req.body);
    req.log.info({ phone: body.phone }, `OTP for login is ${TEST_OTP}`);
    return { ok: true, hint: `Test mode: use OTP ${TEST_OTP}` };
  });

  app.post('/auth/otp/verify', async (req) => {
    const body = z.object({ phone, role, otp: z.string() }).parse(req.body);
    if (body.otp !== TEST_OTP) throw new HttpError(400, 'Wrong OTP');
    if (body.role === 'admin' && !config.adminPhones.includes(body.phone)) {
      throw new HttpError(403, 'This number is not an admin');
    }
    const [user] = await db.query<UserView>(
      `INSERT INTO users (phone, role) VALUES ($1, $2)
       ON CONFLICT (phone, role) DO UPDATE SET phone = EXCLUDED.phone
       RETURNING id, phone, name, role`,
      [body.phone, body.role satisfies Role],
    );
    if (body.role === 'driver') {
      await db.query('INSERT INTO drivers (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    }
    const token = app.jwt.sign({ id: user.id, role: user.role }, { expiresIn: '30d' });
    return { token, user };
  });

  app.get('/me', async (req) => {
    const { id } = await requireUser(req);
    const [user] = await db.query<UserView>('SELECT id, phone, name, role FROM users WHERE id = $1', [id]);
    if (!user) throw new HttpError(401, 'Please log in again');
    return { user, driver: user.role === 'driver' ? await getDriverProfile(id) : null };
  });

  app.patch('/me', async (req) => {
    const { id } = await requireUser(req);
    const body = z.object({ name: z.string().trim().min(2, 'Enter your name').max(60) }).parse(req.body);
    const [user] = await db.query<UserView>(
      'UPDATE users SET name = $2 WHERE id = $1 RETURNING id, phone, name, role',
      [id, body.name],
    );
    return { user };
  });
}
