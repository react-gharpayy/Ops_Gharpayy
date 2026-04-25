// Single Socket.IO connection, shared across the app. Auto-reconnect.
// Subscribes to per-entity channels on demand.
import { io, type Socket } from "socket.io-client";
import { api, tokenStore } from "./client";
import type { DomainEvent } from "@/contracts";

let socket: Socket | null = null;
const listeners = new Set<(e: DomainEvent) => void>();

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(api.apiUrl, {
    transports: ["websocket"],
    autoConnect: true,
    auth: () => ({ token: tokenStore.get() }),
  });
  socket.on("evt", (e: DomainEvent) => {
    listeners.forEach((l) => { try { l(e); } catch (err) { console.error("[ws]", err); } });
  });
  socket.on("connect_error", (err) => console.warn("[ws] connect_error", err.message));
  return socket;
}

export function onEvent(cb: (e: DomainEvent) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function subscribe(channel: string) {
  getSocket().emit("subscribe", channel);
  return () => getSocket().emit("unsubscribe", channel);
}
