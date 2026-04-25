import { z } from "zod";
import { Lead } from "./entities";

// Event registry — every event the system can emit. Server publishes, client + workers subscribe.
export const EventType = z.enum([
  "evt.lead.created",
  "evt.lead.updated",
  "evt.lead.assigned",
  "evt.lead.stage_changed",
  "evt.lead.deleted",
  // Future modules — declare now so contracts stay stable.
  "evt.tour.scheduled",
  "evt.tour.completed",
  "evt.tour.cancelled",
  "evt.room.blocked",
  "evt.room.released",
]);
export type EventType = z.infer<typeof EventType>;

const Envelope = z.object({
  _id: z.string(),               // event ULID
  type: EventType,
  occurredAt: z.string(),
  actor: z.string(),             // userId
  tenantId: z.string(),
  correlationId: z.string(),     // command that produced it
  causationId: z.string().nullable().default(null),
  version: z.literal(1),
});

export const LeadCreatedEvt = Envelope.extend({
  type: z.literal("evt.lead.created"),
  payload: z.object({ lead: Lead }),
});

export const LeadUpdatedEvt = Envelope.extend({
  type: z.literal("evt.lead.updated"),
  payload: z.object({
    leadId: z.string(),
    patch: Lead.partial(),
  }),
});

export const LeadAssignedEvt = Envelope.extend({
  type: z.literal("evt.lead.assigned"),
  payload: z.object({ leadId: z.string(), tcmId: z.string() }),
});

export const LeadStageChangedEvt = Envelope.extend({
  type: z.literal("evt.lead.stage_changed"),
  payload: z.object({ leadId: z.string(), from: z.string(), to: z.string() }),
});

export const LeadDeletedEvt = Envelope.extend({
  type: z.literal("evt.lead.deleted"),
  payload: z.object({ leadId: z.string() }),
});

export const DomainEvent = z.discriminatedUnion("type", [
  LeadCreatedEvt,
  LeadUpdatedEvt,
  LeadAssignedEvt,
  LeadStageChangedEvt,
  LeadDeletedEvt,
]);
export type DomainEvent = z.infer<typeof DomainEvent>;
