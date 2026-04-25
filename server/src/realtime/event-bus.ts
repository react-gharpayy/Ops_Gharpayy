import { col } from "../db/mongo.js";
import { redisPub, REDIS_CHANNELS } from "../db/redis.js";
import { ulid } from "../../../src/contracts/ids.js";
import { DomainEvent } from "../../../src/contracts/events.js";

interface EventDoc extends Record<string, unknown> {
  _id: string;
  type: string;
  occurredAt: string;
  actor: string;
  tenantId: string;
  correlationId: string;
  causationId: string | null;
  version: 1;
  payload: unknown;
}

/**
 * Append event to Mongo + publish to Redis. Single chokepoint — every state change goes here.
 * Idempotency: caller is responsible for ensuring command idempotency via command_ledger.
 */
export async function emit(event: DomainEvent): Promise<void> {
  // Validate at the boundary.
  const parsed = DomainEvent.parse(event);
  await col<EventDoc>("entity_event").insertOne(parsed as unknown as EventDoc);
  await redisPub.publish(REDIS_CHANNELS.events, JSON.stringify(parsed));
}

export function newEventId() { return ulid(); }
