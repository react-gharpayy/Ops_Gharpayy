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
