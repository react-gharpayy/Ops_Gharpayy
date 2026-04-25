// Worker process — run with `npm run worker`. Handles BullMQ jobs (SLA breaches, follow-up reminders, etc.).
// For now: skeleton that consumes the events stream and logs. Add real automation rules in Phase 4.
import { Worker, Queue } from "bullmq";
import { redis, redisSub, REDIS_CHANNELS } from "../db/redis.js";
import { connectMongo } from "../db/mongo.js";
import type { DomainEvent } from "../../../src/contracts/events.js";

const QUEUE = "automation";

await connectMongo();

const queue = new Queue(QUEUE, { connection: redis });

await redisSub.subscribe(REDIS_CHANNELS.events);
redisSub.on("message", async (channel, raw) => {
  if (channel !== REDIS_CHANNELS.events) return;
  const evt = JSON.parse(raw) as DomainEvent;
  // Route every event to the automation queue. Worker decides if anything fires.
  await queue.add(evt.type, evt, { removeOnComplete: 1000, removeOnFail: 5000 });
});

new Worker<DomainEvent>(
  QUEUE,
  async (job) => {
    const evt = job.data;
    // TODO Phase 4: load rules from Mongo `automations` + run code rules. For now log.
    console.log(`[automation] ${evt.type}`, JSON.stringify(evt.payload));
  },
  { connection: redis, concurrency: 10 },
);

console.log("✓ Automation worker started. Listening on channel:", REDIS_CHANNELS.events);
