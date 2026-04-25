import { z } from "zod";

export const LeadStage = z.enum([
  "new",
  "contacted",
  "tour-scheduled",
  "tour-done",
  "negotiation",
  "booked",
  "dropped",
]);

export const Intent = z.enum(["hot", "warm", "cold"]);

export const Lead = z.object({
  _id: z.string(),                       // ULID
  name: z.string().min(1).max(120),
  phone: z.string().min(7).max(20),
  source: z.string().max(60).default("manual"),
  budget: z.number().int().min(0),
  moveInDate: z.string(),                // ISO date
  preferredArea: z.string().max(120),
  zoneId: z.string().nullable().default(null),
  assignedTcmId: z.string().nullable().default(null),
  stage: LeadStage.default("new"),
  intent: Intent.default("warm"),
  confidence: z.number().int().min(0).max(100).default(50),
  tags: z.array(z.string().max(30)).max(10).default([]),
  nextFollowUpAt: z.string().nullable().default(null),
  responseSpeedMins: z.number().int().min(0).default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Audit
  createdBy: z.string(),
  tenantId: z.string(),
});
export type Lead = z.infer<typeof Lead>;

// ------------------- TODO ENTITY -------------------
// A todo can be standalone (entityType = "none") OR attached to any entity.
export const TodoEntityType = z.enum(["none", "lead", "tour", "deal", "owner", "unit"]);
export type TodoEntityType = z.infer<typeof TodoEntityType>;

export const TodoStatus = z.enum([
  "open",          // created, awaiting acceptance if assigned
  "pending-accept",// assigned to someone other than creator, not yet accepted
  "accepted",      // assignee accepted, now actively owned
  "in-progress",   // marked started
  "done",
  "declined",      // assignee declined; bounces back to creator
  "cancelled",
]);
export type TodoStatus = z.infer<typeof TodoStatus>;

export const TodoPriority = z.enum(["low", "med", "high", "urgent"]);

export const Todo = z.object({
  _id: z.string(),                                     // ULID
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).default(""),
  // Attachment to a parent entity (or "none" for standalone My Tasks)
  entityType: TodoEntityType.default("none"),
  entityId: z.string().nullable().default(null),
  // People
  createdBy: z.string(),                               // userId
  assignedTo: z.string().nullable().default(null),     // userId, null = unassigned (My Tasks for creator)
  // State
  status: TodoStatus.default("open"),
  priority: TodoPriority.default("med"),
  dueAt: z.string().nullable().default(null),          // ISO
  completedAt: z.string().nullable().default(null),
  // Audit
  tenantId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Todo = z.infer<typeof Todo>;
