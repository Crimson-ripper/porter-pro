import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError, requireUser } from '../auth.ts';
import { db } from '../db.ts';
import { listOrderRows, toView } from '../orders.ts';

// OpenStreetMap Nominatim: free, max 1 request/second, must send a User-Agent.
// Fine for a PoC; switch to Ola Maps for production volume.
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const UA = 'PorterPro-PoC/0.1 (github.com/Crimson-ripper/porter-pro)';

async function nominatim(path: string) {
  const res = await fetch(`${NOMINATIM}${path}`, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
  if (!res.ok) throw new HttpError(502, 'Address search is unavailable, try again');
  return res.json();
}

export async function miscRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true }));

  app.get('/geo/search', async (req) => {
    await requireUser(req);
    const { q, lat, lng } = z
      .object({ q: z.string().trim().min(3), lat: z.coerce.number().optional(), lng: z.coerce.number().optional() })
      .parse(req.query);
    const params = new URLSearchParams({ q, format: 'jsonv2', countrycodes: 'in', limit: '6' });
    if (lat !== undefined && lng !== undefined) {
      // Prefer results within ~30 km of the user.
      params.set('viewbox', `${lng - 0.3},${lat + 0.3},${lng + 0.3},${lat - 0.3}`);
    }
    const results = (await nominatim(`/search?${params}`)) as { display_name: string; lat: string; lon: string }[];
    return {
      places: results.map((r) => ({ address: r.display_name, lat: Number(r.lat), lng: Number(r.lon) })),
    };
  });

  app.get('/geo/reverse', async (req) => {
    await requireUser(req);
    const { lat, lng } = z.object({ lat: z.coerce.number(), lng: z.coerce.number() }).parse(req.query);
    const r = (await nominatim(`/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=17`)) as { display_name?: string };
    return { place: { lat, lng, address: r.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}` } };
  });

  app.get('/admin/summary', async (req) => {
    await requireUser(req, 'admin');
    const [counts] = await db.query(
      `SELECT
         (SELECT count(*)::int FROM orders WHERE created_at >= date_trunc('day', now())) AS orders_today,
         (SELECT count(*)::int FROM orders WHERE status IN ('searching','assigned','arrived','in_transit')) AS active_orders,
         (SELECT coalesce(sum(fare),0)::int FROM orders WHERE status = 'completed' AND updated_at >= date_trunc('day', now())) AS gmv_today,
         (SELECT count(*)::int FROM drivers WHERE online) AS drivers_online,
         (SELECT count(*)::int FROM drivers) AS drivers_total,
         (SELECT count(*)::int FROM users WHERE role = 'customer') AS customers_total`,
    );
    return { summary: counts };
  });

  app.get('/admin/orders', async (req) => {
    await requireUser(req, 'admin');
    const rows = await listOrderRows('true', [], 100);
    return { orders: rows.map((r) => toView(r, 'admin')) };
  });

  app.get('/admin/drivers', async (req) => {
    await requireUser(req, 'admin');
    const drivers = await db.query(
      `SELECT u.id, u.name, u.phone, d.vehicle_type, d.vehicle_number, d.online, d.busy, d.lat, d.lng, d.location_at
       FROM drivers d JOIN users u ON u.id = d.user_id ORDER BY d.online DESC, u.created_at DESC`,
    );
    return { drivers };
  });
}
