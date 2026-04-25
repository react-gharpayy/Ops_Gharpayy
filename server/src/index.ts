import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { env, corsOrigins } from "./config/env.js";
import { connectMongo } from "./db/mongo.js";
import { redis } from "./db/redis.js";
import { attachSocketIO } from "./realtime/socket.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerLeadsRoutes } from "./modules/leads/routes.js";
import { registerTodosRoutes } from "./modules/todos/routes.js";
import { registerActivitiesRoutes } from "./modules/activities/routes.js";

async function main() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
    },
    trustProxy: true,
  });

  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute", redis });

  await connectMongo();

  app.get("/api/health", async () => ({ ok: true, ts: new Date().toISOString() }));

  registerAuthRoutes(app);
  registerLeadsRoutes(app);
  registerTodosRoutes(app);
  registerActivitiesRoutes(app);

  await attachSocketIO(app);

  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`✓ Gharpayy server listening on ${env.HOST}:${env.PORT}`);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
