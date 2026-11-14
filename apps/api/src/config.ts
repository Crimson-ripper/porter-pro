try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // .env is optional
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  adminPhones: (process.env.ADMIN_PHONES ?? '9999999999')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean),
  // Dispatch tuning
  offerTimeoutSec: 20,
  searchRadiusKm: 10,
  maxOfferAttempts: 5,
  driverLocationMaxAgeSec: 120,
};
