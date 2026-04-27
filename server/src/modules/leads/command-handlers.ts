import { col } from "../../db/mongo.js";
import { ulid } from "../../../../src/contracts/ids.js";
import { Lead } from "../../../../src/contracts/entities.js";
import {
  CreateLeadCmd,
  UpdateLeadCmd,
  AssignLeadCmd,
  ChangeStageCmd,
  DeleteLeadCmd,
  type Command,
} from "../../../../src/contracts/commands.js";
import { emit, newEventId } from "../../realtime/event-bus.js";
import type { JwtClaims } from "../../auth/auth.js";
import { toE164 } from "../../platform/phone.js";
import { withRetry, isMongoConflict } from "../../platform/retry.js";
import { maybeReserveCommand } from "../../platform/dedup.js";
import { cmdCounter, cmdLatency } from "../../platform/metrics.js";

const LEADS = "leads";
const LEDGER = "command_ledger";
const PHONE_INDEX = "lead_phone_index";

interface LedgerDoc {
  _id: string;
  type: string;
  actor: string;
  tenantId: string;
  appliedAt: string;
  appliedAtTtl: Date;       // for TTL index
  result: { ok: true; eventIds: string[]; data?: Record<string, unknown> } | { ok: false; error: string };
}

interface PhoneIndexDoc {
  _id: string;              // `${tenantId}:${phoneE164}`
  tenantId: string;
  phoneE164: string;
  leadId: string;
  createdAt: string;
}

/** Idempotent: same command._id → same result. Two-tier dedup + conflict-aware retry. */
export async function dispatch(rawCmd: Command, user: JwtClaims) {
  const start = Date.now();
  const ledger = col<LedgerDoc>(LEDGER);

  // Tier 1: Redis fast path (cheap pre-DB reject; absorbs retry storms).
  // Tier 2: Mongo ledger (durable truth; survives Redis loss).
  await maybeReserveCommand(rawCmd._id);
  const existing = await ledger.findOne({ _id: rawCmd._id });
  if (existing) {
    cmdCounter.inc({ type: rawCmd.type, outcome: "replay" });
    cmdLatency.observe(Date.now() - start, { type: rawCmd.type, outcome: "replay" });
    return existing.result;
  }

  let result: LedgerDoc["result"];
  try {
    // Conflict-aware retry inside the bus. Handlers that hit a duplicate seq /
    // WriteConflict get up to 3 reloads with jitter — kills tail latency under
    // hot-aggregate contention without bubbling 5xx to clients.
    result = await withRetry(() => applyCommand(rawCmd, user), {
      tries: 3, baseMs: 10, jitterMs: 30, isRetriable: isMongoConflict,
    });
  } catch (e) {
    const err = e as Error & { code?: string };
    result = { ok: false, error: `${err.code ?? "INTERNAL"}: ${err.message}` };
  }

  try {
    await ledger.insertOne({
      _id: rawCmd._id, type: rawCmd.type, actor: user.sub, tenantId: user.tenantId,
      appliedAt: new Date().toISOString(), appliedAtTtl: new Date(), result,
    });
  } catch (e) {
    // Concurrent retry won the race → return its result instead of erroring.
    if (isMongoConflict(e)) {
      const won = await ledger.findOne({ _id: rawCmd._id });
      if (won) {
        cmdCounter.inc({ type: rawCmd.type, outcome: "replay-race" });
        cmdLatency.observe(Date.now() - start, { type: rawCmd.type, outcome: "replay-race" });
        return won.result;
      }
    }
    throw e;
  }

  cmdCounter.inc({ type: rawCmd.type, outcome: result.ok ? "ok" : "error" });
  cmdLatency.observe(Date.now() - start, { type: rawCmd.type, outcome: result.ok ? "ok" : "error" });
  return result;
}

async function applyCommand(cmd: Command, user: JwtClaims): Promise<LedgerDoc["result"]> {
  // Delegate todo commands
  if (cmd.type.startsWith("cmd.todo.")) {
    const { applyTodoCommand } = await import("../todos/command-handlers.js");
    return applyTodoCommand(cmd, user);
  }
  // Delegate activity commands
  if (cmd.type.startsWith("cmd.activity.")) {
    const { applyActivityCommand } = await import("../activities/command-handlers.js");
    return applyActivityCommand(cmd, user);
  }

  const { autoLogActivity } = await import("../activities/command-handlers.js");

  const now = new Date().toISOString();
  const correlationId = cmd._id;

  switch (cmd.type) {
    case "cmd.lead.create": {
      const p = CreateLeadCmd.parse(cmd).payload;
      const lead = Lead.parse({
        _id: ulid(),
        ...p,
        intent: p.intent ?? "warm",
        tags: p.tags ?? [],
        zoneId: p.zoneId ?? null,
        assignedTcmId: null,
        stage: "new",
        confidence: 50,
        nextFollowUpAt: null,
        responseSpeedMins: 0,
        createdAt: now,
        updatedAt: now,
        createdBy: user.sub,
        tenantId: user.tenantId,
      });
      await col(LEADS).insertOne(lead as unknown as Record<string, unknown>);
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.lead.created", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: { lead },
      });
      await autoLogActivity({
        entityType: "lead", entityId: lead._id, kind: "created",
        subject: `Lead created · ${lead.name}`,
        body: `Source: ${lead.source} · Budget: ₹${lead.budget?.toLocaleString()} · Area: ${lead.preferredArea}`,
        meta: { source: lead.source, intent: lead.intent },
        user, correlationId,
      });
      return { ok: true, eventIds: [evtId] };
    }

    case "cmd.lead.update": {
      const p = UpdateLeadCmd.parse(cmd).payload;
      const patch = { ...p.patch, updatedAt: now };
      const r = await col(LEADS).updateOne({ _id: p.leadId, tenantId: user.tenantId }, { $set: patch });
      if (r.matchedCount === 0) throw Object.assign(new Error("Lead not found"), { code: "NOT_FOUND" });
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.lead.updated", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: { leadId: p.leadId, patch },
      });
      const changedKeys = Object.keys(p.patch).filter((k) => k !== "updatedAt");
      if (changedKeys.length > 0) {
        await autoLogActivity({
          entityType: "lead", entityId: p.leadId, kind: "field_changed",
          subject: `Updated: ${changedKeys.join(", ")}`,
          body: changedKeys.map((k) => `${k}: ${JSON.stringify((p.patch as Record<string, unknown>)[k])}`).join(" · "),
          meta: { changedKeys, patch: p.patch },
          user, correlationId,
        });
      }
      return { ok: true, eventIds: [evtId] };
    }

    case "cmd.lead.assign": {
      const p = AssignLeadCmd.parse(cmd).payload;
      const r = await col(LEADS).updateOne(
        { _id: p.leadId, tenantId: user.tenantId },
        { $set: { assignedTcmId: p.tcmId, updatedAt: now } },
      );
      if (r.matchedCount === 0) throw Object.assign(new Error("Lead not found"), { code: "NOT_FOUND" });
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.lead.assigned", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: { leadId: p.leadId, tcmId: p.tcmId },
      });
      await autoLogActivity({
        entityType: "lead", entityId: p.leadId, kind: "assigned",
        subject: `Assigned to TCM`,
        body: `Now owned by ${p.tcmId}`,
        meta: { tcmId: p.tcmId },
        user, correlationId,
      });
      return { ok: true, eventIds: [evtId] };
    }

    case "cmd.lead.change_stage": {
      const p = ChangeStageCmd.parse(cmd).payload;
      const before = await col<{ stage: string }>(LEADS).findOne({ _id: p.leadId, tenantId: user.tenantId });
      if (!before) throw Object.assign(new Error("Lead not found"), { code: "NOT_FOUND" });
      await col(LEADS).updateOne({ _id: p.leadId, tenantId: user.tenantId }, { $set: { stage: p.to, updatedAt: now } });
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.lead.stage_changed", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: { leadId: p.leadId, from: before.stage, to: p.to },
      });
      await autoLogActivity({
        entityType: "lead", entityId: p.leadId, kind: "stage_changed",
        subject: `Stage: ${before.stage} → ${p.to}`,
        meta: { from: before.stage, to: p.to },
        user, correlationId,
      });
      return { ok: true, eventIds: [evtId] };
    }

    case "cmd.lead.delete": {
      const p = DeleteLeadCmd.parse(cmd).payload;
      const r = await col(LEADS).deleteOne({ _id: p.leadId, tenantId: user.tenantId });
      if (r.deletedCount === 0) throw Object.assign(new Error("Lead not found"), { code: "NOT_FOUND" });
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.lead.deleted", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: { leadId: p.leadId },
      });
      return { ok: true, eventIds: [evtId] };
    }
  }
  throw Object.assign(new Error(`Unknown command type: ${(cmd as { type: string }).type}`), { code: "BAD_COMMAND" });
}

