import { z } from "zod";
import { Lead, LeadStage, Intent } from "./entities";

// Command registry — every state-changing intent. Validated client + server.
export const CommandType = z.enum([
  "cmd.lead.create",
  "cmd.lead.update",
  "cmd.lead.assign",
  "cmd.lead.change_stage",
  "cmd.lead.delete",
]);
export type CommandType = z.infer<typeof CommandType>;

const Base = z.object({
  _id: z.string(),                       // command ULID — used as Idempotency-Key
  issuedAt: z.string(),
  actor: z.string().optional(),          // server fills from JWT
  tenantId: z.string().optional(),       // server fills from JWT
});

export const CreateLeadCmd = Base.extend({
  type: z.literal("cmd.lead.create"),
  payload: Lead.pick({
    name: true,
    phone: true,
    source: true,
    budget: true,
    moveInDate: true,
    preferredArea: true,
    zoneId: true,
  }).extend({
    intent: Intent.optional(),
    tags: z.array(z.string()).max(10).optional(),
  }),
});

export const UpdateLeadCmd = Base.extend({
  type: z.literal("cmd.lead.update"),
  payload: z.object({
    leadId: z.string(),
    patch: Lead.partial().omit({ _id: true, tenantId: true, createdBy: true, createdAt: true }),
  }),
});

export const AssignLeadCmd = Base.extend({
  type: z.literal("cmd.lead.assign"),
  payload: z.object({ leadId: z.string(), tcmId: z.string() }),
});

export const ChangeStageCmd = Base.extend({
  type: z.literal("cmd.lead.change_stage"),
  payload: z.object({ leadId: z.string(), to: LeadStage }),
});

export const DeleteLeadCmd = Base.extend({
  type: z.literal("cmd.lead.delete"),
  payload: z.object({ leadId: z.string() }),
});

export const Command = z.discriminatedUnion("type", [
  CreateLeadCmd,
  UpdateLeadCmd,
  AssignLeadCmd,
  ChangeStageCmd,
  DeleteLeadCmd,
]);
export type Command = z.infer<typeof Command>;
