import { Server as SocketServer, type Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { FastifyInstance } from "fastify";
import { redisPub, redisSub, REDIS_CHANNELS } from "../db/redis.js";
import { verifyToken, type JwtClaims } from "../auth/auth.js";
import { corsOrigins } from "../config/env.js";
import type { DomainEvent } from "../../../src/contracts/events.js";

export let io: SocketServer | null = null;

export async function attachSocketIO(app: FastifyInstance) {
  io = new SocketServer(app.server, {
    cors: { origin: corsOrigins, credentials: true },
    transports: ["websocket", "polling"],
  });
  io.adapter(createAdapter(redisPub, redisSub));

  // JWT handshake auth.
  io.use(async (socket, next) => {
    const token = (socket.handshake.auth?.token as string | undefined)
      ?? (socket.handshake.query?.token as string | undefined);
    if (!token) return next(new Error("UNAUTHENTICATED"));
    try {
      const claims = await verifyToken(token);
      (socket.data as { user: JwtClaims }).user = claims;
      next();
    } catch {
      next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket.data as { user: JwtClaims }).user;
    // Personal channel + tenant-wide leads channel.
    socket.join(`user:${user.sub}`);
    socket.join(`tenant:${user.tenantId}:leads`);
    if (user.zoneId) socket.join(`zone:${user.zoneId}`);

    socket.on("subscribe", (channel: string) => {
      // Channel ACL — allow only documented patterns.
      const allowed = /^(lead|tour|zone|user):[A-Za-z0-9_-]+(:.+)?$/.test(channel);
      if (allowed) socket.join(channel);
    });
    socket.on("unsubscribe", (channel: string) => socket.leave(channel));
  });

  // Bridge Redis pub/sub → Socket.IO rooms.
  await redisSub.subscribe(REDIS_CHANNELS.events);
  redisSub.on("message", (channel, raw) => {
    if (channel !== REDIS_CHANNELS.events) return;
    try {
      const evt = JSON.parse(raw) as DomainEvent;
      const tenantRoom = `tenant:${evt.tenantId}:leads`;
      const leadId = (evt.payload as { lead?: { _id?: string }; leadId?: string }).lead?._id
        ?? (evt.payload as { leadId?: string }).leadId;
      io!.to(tenantRoom).emit("evt", evt);
      if (leadId) io!.to(`lead:${leadId}`).emit("evt", evt);
    } catch (err) {
      app.log.error({ err }, "[ws] bad event payload");
    }
  });
}
