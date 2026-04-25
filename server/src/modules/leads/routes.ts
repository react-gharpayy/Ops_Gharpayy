import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { col } from "../../db/mongo.js";
import { Command } from "../../../../src/contracts/commands.js";
import { Lead } from "../../../../src/contracts/entities.js";
import { dispatch } from "./command-handlers.js";
import { requireAuth, requireScope } from "../../middleware/auth.js";

const ListQuery = z.object({
  stage: z.string().optional(),
  assignedTcmId: z.string().optional(),
  zoneId: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  cursor: z.string().optional(),       // ULID cursor (createdAt-sorted)
});

export function registerLeadsRoutes(app: FastifyInstance) {
  // POST /api/commands — single command bus endpoint.
  app.post("/api/commands", { preHandler: [requireAuth] }, async (req, reply) => {
    const idem = req.headers["idempotency-key"];
    if (typeof idem !== "string" || idem.length < 10) {
      return reply.code(400).send({ code: "VALIDATION_FAILED", message: "Idempotency-Key header required" });
    }
    const parsed = Command.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ code: "VALIDATION_FAILED", message: "Invalid command", details: parsed.error.flatten() });
    }
    const cmd = parsed.data;
    if (cmd._id !== idem) {
      return reply.code(400).send({ code: "VALIDATION_FAILED", message: "Idempotency-Key must match command._id" });
    }
    // Scope check per command type.
    const scopeMap: Record<string, string[]> = {
      "cmd.lead.create": ["lead.create"],
      "cmd.lead.update": ["lead.update"],
      "cmd.lead.assign": ["lead.assign"],
      "cmd.lead.change_stage": ["lead.update"],
      "cmd.lead.delete": ["lead.update"],
    };
    const need = scopeMap[cmd.type] ?? [];
    if (!need.every((s) => req.user!.scopes.includes(s as never))) {
      return reply.code(403).send({ code: "FORBIDDEN", message: `Missing scope: ${need.join(",")}` });
    }
    const result = await dispatch(cmd, req.user!);
    return reply.send(result);
  });

  // GET /api/leads — list + filter.
  app.get("/api/leads", { preHandler: [requireAuth, requireScope("lead.read")] }, async (req, reply) => {
    const q = ListQuery.parse(req.query);
    const filter: Record<string, unknown> = { tenantId: req.user!.tenantId };
    if (q.stage) filter.stage = q.stage;
    if (q.assignedTcmId) filter.assignedTcmId = q.assignedTcmId;
    if (q.zoneId) filter.zoneId = q.zoneId;
    if (q.cursor) filter._id = { $lt: q.cursor };
    const items = await col<Lead>("leads")
      .find(filter)
      .sort({ _id: -1 })
      .limit(q.limit)
      .toArray();
    return reply.send({ items, nextCursor: items.length === q.limit ? items[items.length - 1]._id : null });
  });

  app.get("/api/leads/:id", { preHandler: [requireAuth, requireScope("lead.read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const lead = await col<Lead>("leads").findOne({ _id: id, tenantId: req.user!.tenantId });
    if (!lead) return reply.code(404).send({ code: "NOT_FOUND", message: "Lead not found" });
    return reply.send(lead);
  });
}
