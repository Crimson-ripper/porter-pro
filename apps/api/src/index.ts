import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { Server } from 'socket.io';
import { ZodError } from 'zod';
import { EVENTS } from '@porter/shared';
import { HttpError } from './auth.ts';
import { config } from './config.ts';
import { resumeSearchingOrders } from './dispatch.ts';
import { setIo, userRoom } from './realtime.ts';
import { authRoutes } from './routes/auth.ts';
import { customerRoutes } from './routes/customer.ts';
import { driverRoutes, updateDriverLocation } from './routes/driver.ts';
import { miscRoutes } from './routes/misc.ts';

const app = Fastify({ logger: { level: 'info' } });

await app.register(cors, { origin: true });
await app.register(jwt, { secret: config.jwtSecret });

app.setErrorHandler((err, req, reply) => {
  if (err instanceof HttpError) return reply.code(err.statusCode).send({ error: err.message });
  if (err instanceof ZodError) return reply.code(400).send({ error: err.issues[0]?.message ?? 'Invalid request' });
  req.log.error(err);
  return reply.code(500).send({ error: 'Something went wrong' });
});

await app.register(authRoutes);
await app.register(customerRoutes);
await app.register(driverRoutes);
await app.register(miscRoutes);

// Realtime: every logged-in socket joins its own room; the server pushes
// order updates, job offers and driver locations into those rooms.
const io = new Server(app.server, { cors: { origin: '*' } });
io.use((socket, next) => {
  try {
    socket.data.user = app.jwt.verify<{ id: string; role: string }>(socket.handshake.auth?.token);
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});
io.on('connection', (socket) => {
  const user = socket.data.user as { id: string; role: string };
  void socket.join(userRoom(user.id));
  if (user.role === 'driver') {
    socket.on(EVENTS.location, (p: { lat?: unknown; lng?: unknown }) => {
      if (typeof p?.lat === 'number' && typeof p?.lng === 'number') {
        updateDriverLocation(user.id, p.lat, p.lng).catch((e) => app.log.error(e));
      }
    });
  }
});
setIo(io);

await app.listen({ port: config.port, host: '0.0.0.0' });
app.log.info(`Database: ${config.databaseUrl ? 'Postgres (DATABASE_URL)' : 'local PGlite (apps/api/.data)'}`);
await resumeSearchingOrders();
