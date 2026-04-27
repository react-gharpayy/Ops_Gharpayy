// Offline-first adapter: persists todos + activities to localStorage and
// emits the same Domain events the VPS would emit, so realtime UI works
// before the backend is deployed. Auto-engaged when VITE_API_URL is unset
// or the server is unreachable.
import { ulid } from "@/contracts";
import type { Todo, Activity, DomainEvent, Lead } from "@/contracts";

const TODOS_KEY = "gharpayy.local.todos";
const ACTS_KEY = "gharpayy.local.activities";
const LEADS_KEY = "gharpayy.local.leads";
const TENANT = "local";
const USER = "local-user";

// Seed a handful of demo leads on first load so the live-leads UI isn't empty.
const SEED_LEADS: Lead[] = [
  { _id: "LD000000000000000000000001", name: "Aarav Mehta", phone: "+919812345671", source: "instagram", budget: 12000, moveInDate: "2026-05-10", preferredArea: "Koramangala", zoneId: "z-blr-south", assignedTcmId: null, stage: "new", intent: "warm", confidence: 60, tags: [], nextFollowUpAt: null, responseSpeedMins: 0, createdAt: new Date(Date.now() - 86_400_000).toISOString(), updatedAt: new Date(Date.now() - 86_400_000).toISOString(), createdBy: USER, tenantId: TENANT },
  { _id: "LD000000000000000000000002", name: "Riya Sharma",  phone: "+919812345672", source: "google",    budget: 18000, moveInDate: "2026-05-15", preferredArea: "HSR Layout",  zoneId: "z-blr-south", assignedTcmId: null, stage: "contacted", intent: "hot", confidence: 78, tags: ["urgent"], nextFollowUpAt: null, responseSpeedMins: 4, createdAt: new Date(Date.now() - 3_600_000).toISOString(), updatedAt: new Date().toISOString(), createdBy: USER, tenantId: TENANT },
  { _id: "LD000000000000000000000003", name: "Karan Verma",  phone: "+919812345673", source: "referral",  budget: 9500,  moveInDate: "2026-06-01", preferredArea: "Whitefield",  zoneId: "z-blr-east",  assignedTcmId: null, stage: "tour-scheduled", intent: "warm", confidence: 65, tags: [], nextFollowUpAt: null, responseSpeedMins: 12, createdAt: new Date(Date.now() - 7_200_000).toISOString(), updatedAt: new Date().toISOString(), createdBy: USER, tenantId: TENANT },
];

type Listener = (e: DomainEvent) => void;
const listeners = new Set<Listener>();
export function onLocalEvent(cb: Listener): () => void { listeners.add(cb); return () => listeners.delete(cb); }
function emit(e: DomainEvent) { listeners.forEach((l) => { try { l(e); } catch (err) { console.error(err); } }); }

const read = <T,>(k: string): T[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(k) || "[]") as T[]; } catch { return []; }
};
const write = <T,>(k: string, v: T[]) => { if (typeof window !== "undefined") localStorage.setItem(k, JSON.stringify(v)); };

const nowISO = () => new Date().toISOString();
const env = (correlationId: string) => ({
  _id: ulid(), occurredAt: nowISO(), actor: USER, tenantId: TENANT,
  correlationId, causationId: null, version: 1 as const,
});

type CmdIn = { _id: string; type: string; payload: Record<string, unknown> };

export const localAdapter = {
  isLocal: true,

  // ---------- Queries ----------
  listTodos(q: { entityType?: string; entityId?: string; scope?: string }) {
    let items = read<Todo>(TODOS_KEY);
    if (q.entityType) items = items.filter((t) => t.entityType === q.entityType);
    if (q.entityId) items = items.filter((t) => t.entityId === q.entityId);
    if (q.scope === "mine") items = items.filter((t) => t.assignedTo === USER || (t.createdBy === USER && !t.assignedTo));
    return { items: items.sort((a, b) => b._id.localeCompare(a._id)) };
  },

  listActivities(q: { entityType: string; entityId: string; kind?: string; limit?: number }) {
    let items = read<Activity>(ACTS_KEY).filter((a) => a.entityType === q.entityType && a.entityId === q.entityId);
    if (q.kind) items = items.filter((a) => a.kind === q.kind);
    items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return { items: items.slice(0, q.limit ?? 200) };
  },

  listUsers() {
    return { items: [{ _id: USER, name: "Me (local)", email: "me@local", role: "admin" }] };
  },

  // ---------- Commands ----------
  command(cmd: CmdIn): { ok: true; eventIds: string[] } | { ok: false; error: string } {
    try {
      const correlationId = cmd._id;
      const t = cmd.type;

      if (t === "cmd.todo.create") {
        const p = cmd.payload as Record<string, unknown>;
        const assignTo = (p.assignTo as string | null) ?? null;
        const todo: Todo = {
          _id: ulid(),
          title: String(p.title ?? ""),
          notes: (p.notes as string) ?? "",
          status: assignTo && assignTo !== USER ? "pending-accept" : "open",
          priority: (p.priority as Todo["priority"]) ?? "med",
          dueAt: (p.dueAt as string | null) ?? null,
          entityType: (p.entityType as Todo["entityType"]) ?? "none",
          entityId: (p.entityId as string | null) ?? null,
          createdBy: USER,
          assignedTo: assignTo,
          tenantId: TENANT,
          createdAt: nowISO(),
          updatedAt: nowISO(),
          completedAt: null,
        };
        const list = read<Todo>(TODOS_KEY); list.unshift(todo); write(TODOS_KEY, list);
        const evt = { ...env(correlationId), type: "evt.todo.created" as const, payload: { todo } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id] };
      }

      if (t.startsWith("cmd.todo.")) {
        const todoId = (cmd.payload as { todoId: string }).todoId;
        const list = read<Todo>(TODOS_KEY);
        const idx = list.findIndex((x) => x._id === todoId);
        if (idx < 0) return { ok: false, error: "Todo not found" };
        const cur = list[idx];
        const patch: Partial<Todo> = { updatedAt: nowISO() };
        let evtType: DomainEvent["type"] = "evt.todo.updated";
        let payload: Record<string, unknown> = { todoId, patch };
        if (t === "cmd.todo.accept")   { patch.status = "accepted";  evtType = "evt.todo.accepted";  payload = { todoId, by: USER }; }
        if (t === "cmd.todo.decline")  { patch.status = "cancelled"; evtType = "evt.todo.declined";  payload = { todoId, by: USER, reason: (cmd.payload as { reason?: string }).reason ?? null }; }
        if (t === "cmd.todo.complete") { patch.status = "done"; patch.completedAt = nowISO(); evtType = "evt.todo.completed"; payload = { todoId, by: USER }; }
        if (t === "cmd.todo.cancel")   { patch.status = "cancelled"; evtType = "evt.todo.cancelled"; payload = { todoId, by: USER }; }
        if (t === "cmd.todo.assign")   {
          const assignTo = (cmd.payload as { assignTo: string }).assignTo;
          patch.assignedTo = assignTo; patch.status = assignTo === USER ? "accepted" : "pending-accept";
          evtType = "evt.todo.assigned"; payload = { todoId, assignTo, pending: assignTo !== USER };
        }
        list[idx] = { ...cur, ...patch }; write(TODOS_KEY, list);
        const evt = { ...env(correlationId), type: evtType, payload } as unknown as DomainEvent;
        emit(evt);
        return { ok: true, eventIds: [evt._id] };
      }

      if (t === "cmd.activity.log") {
        const p = cmd.payload as Record<string, unknown>;
        const activity: Activity = {
          _id: ulid(),
          entityType: p.entityType as Activity["entityType"],
          entityId: String(p.entityId),
          kind: p.kind as Activity["kind"],
          subject: String(p.subject ?? ""),
          body: (p.body as string) ?? "",
          direction: (p.direction as Activity["direction"]) ?? "internal",
          outcome: (p.outcome as Activity["outcome"]) ?? null,
          durationSec: (p.durationSec as number) ?? 0,
          occurredAt: (p.occurredAt as string) ?? nowISO(),
          scheduledFor: (p.scheduledFor as string | null) ?? null,
          relatedTodoId: (p.relatedTodoId as string | null) ?? null,
          meta: (p.meta as Record<string, unknown>) ?? {},
          actor: USER, tenantId: TENANT, createdAt: nowISO(),
        };
        const list = read<Activity>(ACTS_KEY); list.unshift(activity); write(ACTS_KEY, list);
        const evt = { ...env(correlationId), type: "evt.activity.logged" as const, payload: { activity } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id] };
      }

      if (t === "cmd.activity.delete") {
        const activityId = (cmd.payload as { activityId: string }).activityId;
        const list = read<Activity>(ACTS_KEY);
        const item = list.find((a) => a._id === activityId);
        if (!item) return { ok: false, error: "Activity not found" };
        write(ACTS_KEY, list.filter((a) => a._id !== activityId));
        const evt = { ...env(correlationId), type: "evt.activity.deleted" as const, payload: { activityId, entityType: item.entityType, entityId: item.entityId } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id] };
      }

      // Lead commands aren't simulated locally yet — those still flow through useApp store.
      return { ok: true, eventIds: [] };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};

export const isLocalMode = (): boolean => {
  if (typeof window === "undefined") return true;
  // Local mode if no VITE_API_URL was set, OR user explicitly opted in.
  const explicit = localStorage.getItem("gharpayy.force_local") === "1";
  const url = import.meta.env.VITE_API_URL as string | undefined;
  return explicit || !url;
};
