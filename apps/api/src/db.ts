import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.ts';

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
}

// Uses Postgres (e.g. Supabase) when DATABASE_URL is set, otherwise an embedded
// Postgres (PGlite) stored on disk so local development needs no setup.
async function connect(): Promise<Db> {
  if (config.databaseUrl) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: config.databaseUrl, ssl: { rejectUnauthorized: false } });
    return {
      query: async <T>(sql: string, params?: unknown[]) => (await pool.query(sql, params)).rows as T[],
      exec: async (sql) => {
        await pool.query(sql);
      },
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = fileURLToPath(new URL('../.data/pglite', import.meta.url));
  mkdirSync(dir, { recursive: true });
  const lite = await PGlite.create(dir);
  return {
    query: async <T>(sql: string, params?: unknown[]) => (await lite.query<T>(sql, params)).rows,
    exec: async (sql) => {
      await lite.exec(sql);
    },
  };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  name text NOT NULL DEFAULT '',
  role text NOT NULL CHECK (role IN ('customer', 'driver', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone, role)
);

CREATE TABLE IF NOT EXISTS drivers (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  vehicle_type text,
  vehicle_number text,
  online boolean NOT NULL DEFAULT false,
  busy boolean NOT NULL DEFAULT false,
  lat double precision,
  lng double precision,
  location_at timestamptz
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES users(id),
  driver_id uuid REFERENCES users(id),
  offered_driver_id uuid REFERENCES users(id),
  vehicle_type text NOT NULL,
  status text NOT NULL,
  pickup_lat double precision NOT NULL,
  pickup_lng double precision NOT NULL,
  pickup_address text NOT NULL,
  drop_lat double precision NOT NULL,
  drop_lng double precision NOT NULL,
  drop_address text NOT NULL,
  distance_km double precision NOT NULL,
  fare integer NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  pickup_otp text NOT NULL,
  cancel_reason text,
  customer_rating integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_driver_idx ON orders (driver_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_events (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  status text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
`;

export const db = await connect();
await db.exec(SCHEMA);
