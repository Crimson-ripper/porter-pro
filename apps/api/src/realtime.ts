import type { Server } from 'socket.io';
import { EVENTS, type OrderView } from '@porter/shared';

let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}

export const userRoom = (id: string) => `user:${id}`;

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(userRoom(userId)).emit(event, payload);
}

// The customer sees the pickup OTP; the driver must not.
export function emitOrderUpdate(order: OrderView, customerId: string, driverId: string | null) {
  emitToUser(customerId, EVENTS.orderUpdate, order);
  if (driverId) {
    const { pickupOtp: _otp, ...forDriver } = order;
    emitToUser(driverId, EVENTS.orderUpdate, forDriver);
  }
}
