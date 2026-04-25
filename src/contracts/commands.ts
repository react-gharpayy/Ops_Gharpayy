import { z } from "zod";
import { Lead, LeadStage, Intent, Todo, TodoEntityType, TodoPriority } from "./entities";

// Command registry — every state-changing intent. Validated client + server.
export const CommandType = z.enum([
  "cmd.lead.create",
  "cmd.lead.update",
  "cmd.lead.assign",
  "cmd.lead.change_stage",
  "cmd.lead.delete",
  // Todos
  "cmd.todo.create",
  "cmd.todo.update",
  "cmd.todo.assign",
  "cmd.todo.accept",
  "cmd.todo.decline",
  "cmd.todo.complete",
  "cmd.todo.cancel",
]);
export type CommandType = z.infer<typeof CommandType>;

const Base = z.object({
  _id: z.string(),                       // command ULID — used as Idempotency-Key
  issuedAt: z.string(),
  actor: z.string().optional(),          // server fills from JWT
  tenantId: z.string().optional(),       // server fills from JWT
});

// ---------- Leads ----------
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

// ---------- Todos ----------
export const CreateTodoCmd = Base.extend({
  type: z.literal("cmd.todo.create"),
  payload: Todo.pick({
    title: true,
    notes: true,
    entityType: true,
    entityId: true,
    priority: true,
    dueAt: true,
  }).partial({ notes: true, priority: true, dueAt: true, entityType: true, entityId: true }).extend({
    assignTo: z.string().nullable().optional(), // null/undefined = self
  }),
});

export const UpdateTodoCmd = Base.extend({
  type: z.literal("cmd.todo.update"),
  payload: z.object({
    todoId: z.string(),
    patch: z.object({
      title: z.string().min(1).max(200).optional(),
      notes: z.string().max(2000).optional(),
      priority: TodoPriority.optional(),
      dueAt: z.string().nullable().optional(),
      entityType: TodoEntityType.optional(),
      entityId: z.string().nullable().optional(),
    }),
  }),
});

export const AssignTodoCmd = Base.extend({
  type: z.literal("cmd.todo.assign"),
  payload: z.object({ todoId: z.string(), assignTo: z.string() }),
});

export const AcceptTodoCmd = Base.extend({
  type: z.literal("cmd.todo.accept"),
  payload: z.object({ todoId: z.string() }),
});

export const DeclineTodoCmd = Base.extend({
  type: z.literal("cmd.todo.decline"),
  payload: z.object({ todoId: z.string(), reason: z.string().max(500).optional() }),
});

export const CompleteTodoCmd = Base.extend({
  type: z.literal("cmd.todo.complete"),
  payload: z.object({ todoId: z.string() }),
});

export const CancelTodoCmd = Base.extend({
  type: z.literal("cmd.todo.cancel"),
  payload: z.object({ todoId: z.string() }),
});

export const Command = z.discriminatedUnion("type", [
  CreateLeadCmd,
  UpdateLeadCmd,
  AssignLeadCmd,
  ChangeStageCmd,
  DeleteLeadCmd,
  CreateTodoCmd,
  UpdateTodoCmd,
  AssignTodoCmd,
  AcceptTodoCmd,
  DeclineTodoCmd,
  CompleteTodoCmd,
  CancelTodoCmd,
]);
export type Command = z.infer<typeof Command>;
