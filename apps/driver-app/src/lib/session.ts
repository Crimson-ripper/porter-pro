import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { io, type Socket } from 'socket.io-client';
import { createApi } from '@porter/shared';

// In development the API runs on the same laptop as the Expo dev server, so we
// reuse the IP address the phone already uses to reach Expo. Set
// EXPO_PUBLIC_API_URL to point somewhere else (e.g. a Cloudflare Tunnel URL).
function resolveApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:4000`;
}

export const API_URL = resolveApiUrl();
const TOKEN_KEY = 'porter.driver.token';

let token: string | null = null;
let socket: Socket | null = null;

export const api = createApi(API_URL, () => token);

export async function loadToken() {
  token = await SecureStore.getItemAsync(TOKEN_KEY);
  return token;
}

export async function saveToken(value: string) {
  token = value;
  await SecureStore.setItemAsync(TOKEN_KEY, value);
}

export async function clearSession() {
  token = null;
  socket?.disconnect();
  socket = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function getSocket(): Socket {
  if (!socket) socket = io(API_URL, { auth: { token }, transports: ['websocket'] });
  return socket;
}
