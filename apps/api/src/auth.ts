import type { FastifyRequest } from 'fastify';
import type { Role } from '@porter/shared';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; role: Role };
    user: { id: string; role: Role };
  }
}

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

// Verifies the bearer token and, if roles are given, that the user has one of them.
export async function requireUser(req: FastifyRequest, ...roles: Role[]) {
  try {
    await req.jwtVerify();
  } catch {
    throw new HttpError(401, 'Please log in again');
  }
  if (roles.length && !roles.includes(req.user.role)) throw new HttpError(403, 'Not allowed');
  return req.user;
}
