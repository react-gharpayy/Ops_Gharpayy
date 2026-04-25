# CRM Execution-Ready Architecture Blueprint
**Stack**: MongoDB Atlas + Custom Node API (Fastify) + Socket.IO + BullMQ (Redis)
**Pattern**: Isomorphic commands · Hybrid automation · Event-sourced backbone
**Version**: 1.0 — 2026-04-25

## 1. Current System Audit
**Working in code**: Lead Identity (`src/lib/lead-identity/`), QuickAD (`src/lib/quickad-shared.ts`), Lead Drawer multi-tour (`src/components/LeadControlPanel.tsx`), MYT Schedule Tour, Supply Hub matcher, Flow Ops/TCM/War Room/HR dashboards, Owner module, Calendar, Coach, PiP, Notifications — ALL on Zustand+localStorage.

**Missing entirely**: Backend, auth, RBAC enforcement, persistent event log, cross-user sync, integrations (WA/dialer/payments stubs), scheduled jobs, audit trail, idempotency, server validation.

**Anti-patterns to fix**:
1. Zustand persist used as DB (must become cache).
2. Duplicate `LeadControlPanel.tsx` (root vs `src/myt/components/`) — consolidate.
3. Inventory math split between `inventory-intelligence.ts` and `supply-hub/lib/matcher.ts` — matcher is the only authority.
4. `src/owner/event-bus.ts` and `src/components/pip/usePipSync.ts` are local pub-subs — replace with universal bus.
5. Hardcoded `currentUser="u-self"` in identity store blocks RBAC.
6. Activity log inside lead store — must move to immutable event collection.

## 2. Roles & Permissions
**Tree**: Admin → · Sales → {Sales Lead (zone), Sales Agent (own)} · Ops → {Flow Ops (zone), TCM (assigned), HR (people)} · Owner (own properties).
Every user = one top-role + optional sub-role + scope filters (`zoneIds[]`, `propertyIds[]`).

**Matrix highlights**: `lead.create` (Admin/Sales/FlowOps), `lead.reassign` (Admin/SalesLead/FlowOps zone-scoped), `tour.schedule` (all ops roles), `inventory.update` (Ops + Owner own), `booking.confirm` (Admin/SalesLead/FlowOps), `automation.write` (Admin only).

**4 enforcement layers**: UI hide → command bus check → Mongo middleware re-check → WS channel auth at join.

## 3. Data Ownership
| Entity | Owner | PK | Realtime channel |
|---|---|---|---|
| user | Auth | userId | ws:user:{id} |
| lead | Lead Service | ulid | ws:lead:{ulid}, ws:zone:{z}:leads |
| tour | Tour Service | tourId | ws:tour:{id}, ws:zone:{z}:tours |
| booking | Booking | bookingId | ws:booking:{id} |
| property/room/roomBlock | Supply Hub | id | ws:property:{id} |
| accessRequest | Lead Service | reqId | ws:user:{ownerId} |
| notification | Notification | notifId | ws:user:{userId} |
| automation | Admin | ruleId | n/a |
| event (append-only log) | System | eventId | n/a |

**Rules**: one owning service per entity; cross-module reads via API or event snapshots only — NO cross-collection joins.

## 4. Universal Event Registry

**Envelope**: `{eventId, type, version, occurredAt, actorId, actorRole, aggregateType, aggregateId, causationId, correlationId, scope, payload, snapshot}`.

**Lead**: created, dedupMatched, merged, assigned, contactUpdated, qualified, disqualified, stateChanged, inactive(derived), highIntentDetected(derived), dropped, revived.

**Access/Ownership**: access.requested, access.granted, access.rejected, lead.ownerChanged.

**Tour**: scheduled, confirmed, rescheduled, cancelled, checkedIn, completed, noShow, feedbackSubmitted.

**Inventory**: room.blocked, room.unblocked, room.bedsChanged, room.priceChanged, property.statusChanged, match.recommended(derived).

**Booking/Money**: booking.created, payment.intentCreated, payment.received, payment.failed, booking.confirmed, booking.cancelled.

**Comms**: whatsappSent, whatsappDelivered, whatsappReplied, callPlaced, callCompleted.

**HR**: user.shiftStarted/Ended, user.capacityBreached, team.zoneChanged.

**Owner**: invited, onboarded, mediaUpdated, roomUpdated, visitFeedbackPosted.

**System**: commandFailed, eventRetry, deadLetter, syncDelay, integration.webhookReceived, integration.tokenExpired.

**Sync vs async**: SYNC = validation, dedup, optimistic write, ack. ASYNC (BullMQ) = notifications, automations, derived events, integrations, analytics. REALTIME (Socket.IO) = every committed event ≤200ms.

**Priorities**: P0 (payment.received, tour.scheduled) <500ms commit / <200ms push · P1 (lead.created) <2s/<1s · P2 (derived) <30s · P3 (analytics) minutes.

**Gaps in current code**: no tour.noShow → blocks held forever; no lead.inactive → no nudge; no match.recommended → only recompute on page load; no payment.* at all; no system.* — zero failure visibility.

## 5. Command Engine

**Envelope**: `{commandId, type, version, issuedAt, actorId, actorRole, scope, input, correlationId, expectedAggregateVersion}` → Result `{ok, aggregateId, version, events[]} | {ok:false, error{code,message,retryable}}`.

**Catalog (key commands)**: lead.create/update/qualify/reassign/merge · access.request/decide · tour.schedule/reschedule/cancel/checkIn/complete/markNoShow · room.block/unblock/update · booking.create/confirm · payment.requestToken · notification.send · automation.upsert · team.assignZone · shift.start/end.

**Isomorphic flow**: UI → client bus dispatch → local zod + perm check → optimistic projection apply → POST /api/commands (idempotent on commandId) → server zod + perm + scope re-check → load aggregate, check version → handler emits events → tx: append events + update read model → publish to BullMQ + Socket.IO → return result → client reconciles (confirm or rollback) → other clients receive WS push.

**Idempotency**: commandId cached 24h; eventId ledger per listener (30d); webhook providers' keys mapped to commandId.

**Concurrency**: aggregate `__v` integer; mismatch → CONFLICT → client refetches.

## 6. Real-Time Architecture
Browser ⇄ Socket.IO Gateway (sticky session) ⇄ Redis adapter (pub/sub) ⇄ Command API publishes to: BullMQ (durable) + Socket.IO (broadcast) + Mongo events (audit/replay).

**Channels**: ws:user:{id}, ws:lead:{ulid}, ws:zone:{z}:leads/tours, ws:property:{id}, ws:tour:{id}, ws:admin:system. Server-authorized at join; revocation forces disconnect.

**Catch-up**: each client tracks lastEventSeq per channel; on reconnect server replays missed events from Mongo (last 500 / 1h); large gap → full re-hydrate.

**Latency budget**: commit P95 <500ms, fan-out P95 <1s, reconnect+replay <3s.

## 7. Automation Engine (Hybrid)

**Code rules** (`src/automation/rules/*.ts`): SLA breaches, ownership conflicts, dedup gating, payment reconciliation, security escalations.

**Mongo rules** (`automations` collection, editable in Admin UI): follow-up cadence, message templates, escalation thresholds, lead-aging windows, cooldowns, holiday calendar.

**Rule shape**: `{ruleId, enabled, scope, trigger:{event|schedule|derived}, conditions:JsonLogic, actions:[{kind:command|notify|scheduleJob, ...}], cooldown, priority}`.

**Default rules to seed**:
1. Lead created → no activity 24h → nudge owner WA + WS.
2. Qualified lead → no tour 48h → escalate to Sales Lead.
3. High intent (budget+area+moveIn<30d) → push to top + ping nearest agent.
4. Tour scheduled → confirm T-24h, remind T-2h.
5. Tour completed → post-visit gate +30min, follow-up sequence +24h.
6. Tour no-show after 30min grace → markNoShow + release block + revival in 7d.
7. Zone beds ≤2 → notify Flow Ops to push demand.
8. Payment received → booking.confirm + receipt + owner notify.
9. TCM >8 tours/day → stop assigning + alert HR.
10. Lead inactive 7d → drop → revival queue.
11. Owner unread feedback >48h → email digest.
12. Webhook 401 → pause integration + page admin.

**Engine**: BullMQ worker `automation-engine` consumes every committed event; loads matching rules (cached, invalidated on automation.upsert); evaluates JSONLogic (sandboxed); each action becomes a fresh Command with causationId — automations are commands, fully audited; cooldowns via Redis SET-NX TTL.

## 8. Failure & Recovery
| Failure | Detection | Response |
|---|---|---|
| Validation | sync | error, no event |
| Version conflict | sync | client refetches, retries |
| Listener throws | BullMQ | exp backoff 1s/5s/30s/2m/10m |
| Exhausted | BullMQ DLQ | system.deadLetter + page admin |
| External API timeout | connector | circuit breaker + queued retry |
| Webhook duplicate | provider key | dedup ledger |
| Mongo write fail mid-fan-out | tx | abort, no events emitted |
| WS push lost | client gap detect | replay from event log |
| Worker dies | heartbeat | jobs reclaimed |

**Idempotency**: every listener wraps `if (ledger.has(eventId)) return; doWork(); ledger.add(eventId)`.

**Observability**: every command/event has correlationId; surfaced in error toasts (`Trace abc123`); structured JSON logs; metrics for command throughput, P50/P95/P99 latency, DLQ depth, WS clients per channel; replay tool by correlationId.

## 9. External Integrations (event-driven)
**WhatsApp**: outbound via `cmd.notification.send` (channel:wa) → connector → `evt.comm.whatsappSent`. Inbound `/api/webhooks/whatsapp` → HMAC verify → `evt.comm.whatsappReplied` → automation matches lead by phoneE164 → may trigger lead.qualify or tour.confirm. Templates in Mongo, approved IDs cached.

**Dialer**: click-to-call → `cmd.comm.placeCall` → `evt.comm.callPlaced`. Webhook → `evt.comm.callCompleted` (duration+recording+disposition). TCM auto-dial 5min before slot.

**Payments**: `cmd.payment.requestToken` → intent → pay link → WA via notification rule. PG webhook → verify → `evt.payment.received` → `cmd.booking.confirm`.

**Analytics**: separate BullMQ queue → denormalized rows in `analytics.*` (Mongo, later ClickHouse). Dashboards never touch operational collections.

**Notifications**: one service consumes evt.notification.* → routes WS/WA/email/push per user prefs.

**Calendar**: every tour.* event → calendar adapter (Google/Outlook later) upserts.

## 10. Performance & Scale
**Targets**: 10k concurrent users, 50 cmd/s sustained, 500/s burst, 100k leads, 1M events.

**Levers**: Mongo indexes (phoneE164, primaryOwnerId+state, zoneId+state, tourDate+zoneId, event.aggregateId+occurredAt, correlationId); shard by zoneId at >5M leads; read replicas for analytics; Redis cluster at >1k WS; separate BullMQ queues (notifications, automation, analytics, integrations, dlq) with independent worker pools; sticky WS sessions behind LB with Redis pub/sub adapter.

**Why not Kafka now**: BullMQ on Redis covers durability+retry+DLQ for current scale. Migrate to Kafka only at >5k events/s sustained or when cross-team consumer groups needed. Document as v2.

**Cost discipline**: realtime fan-out is expensive — audit channels quarterly; batch derived events (one match.recommended per lead per minute, not per inventory change).

## 11. Module-to-Module Integration Map
```
Auth → (every module)
QuickAD/LeadDrawer ⇄ Lead Service ⇄ Tour Service
                       ↓                  ↓
                    Routing          Inventory (block)
                       ↓                  ↑
                  Notification ← Supply Hub ⇄ Matcher
                       ↓                  ↑
                  WA/Dialer          Owner Module
Tour Service → Booking → Payment → Lead state→converted

Cross-cutting: every committed event → Automation, Analytics, Audit, Socket.IO
```

**Isolation killers (enforce)**:
- HR cannot directly write lead owner → must emit `cmd.lead.reassign`.
- Owner cannot mark tour completed → only `cmd.owner.visitFeedbackPosted`.
- Coach is read-only on operational state, write-only on its own coachState.

## 12. Required Backend Changes
**Repos**: `apps/api` (Fastify), `apps/workers` (BullMQ), `packages/contracts` (zod schemas, EventType, CommandType, permissions), `packages/automation-runtime` (JSONLogic), `apps/web` (refactored).

**Mongo collections**: users, roles, leads, activities, events(time-series), tours, bookings, properties, rooms, room_blocks, access_requests, notifications, automations, processed_events, idempotency, analytics_funnel, analytics_team.

**Infra**: Atlas M30+ replica set with oplog · Redis (BullMQ + Socket.IO + caches) · Node API behind LB sticky sessions · workers auto-scale on queue depth · `/api/webhooks/*` with HMAC middleware · secrets via Doppler/Vault.

**Frontend refactors**:
1. Replace `useIdentityStore.currentUser` with auth session.
2. Wrap every mutation in `commandBus.dispatch()` — no direct `set()` in features.
3. Add `EventReducerProvider` subscribing WS → applies events to stores.
4. Move owner/event-bus + pip/usePipSync to universal bus.
5. Delete duplicate `src/myt/components/LeadControlPanel.tsx` after ref check.
6. Centralize matcher in `src/supply-hub/lib/matcher.ts`; `inventory-intelligence.ts` only orchestrates.

## 13. Roadmap
- **Phase 0 — Week 1**: `packages/contracts` (zod schemas, event/command enums, permissions). Frontend imports types — compile-time guarantee.
- **Phase 1 — Weeks 2-3**: Atlas + collections + indexes. Fastify `/api/commands` (idempotent), `/api/queries/*`, `/api/webhooks/*`. JWT auth with role/scope claims. Socket.IO + Redis adapter. BullMQ + DLQ + bull-board.
- **Phase 2 — Week 4**: Lead vertical slice. Migrate Lead Identity to backend. ws:lead:{ulid}, ws:zone:{z}:leads. Frontend → commandBus + WS reducers. Drop localStorage-as-DB for leads.
- **Phase 3 — Week 5**: Tours + Inventory. Tour Service. Room blocks behind cmd.room.block/unblock with TTL job. Matcher = query API, recompute on evt.room.*. Inline scheduling in lead drawer keeps UX, real backend.
- **Phase 4 — Week 6**: Automation engine worker. 5 P0 code rules + Admin UI for Mongo rules + 5 default seeded.
- **Phase 5 — Weeks 7-8**: WA + dialer + payments behind connector interface. Each ships with: connector, webhook normalizer, outbound command, default automations.
- **Phase 6 — Week 9**: Replay tool, correlationId in toasts, DLQ alerts. Owner module on real backend (invite, media, room edits).
- **Phase 7 — Week 10+**: Load test 500 cmd/s. Sharding plan at >5M leads. Kafka migration plan. SOC2 audit trail review.

## 14. Open Items (confirm before Phase 0 tickets)
1. Auth: Auth.js / Clerk / custom JWT?
2. Atlas region(s) — single or multi?
3. WhatsApp BSP: Meta direct / Gupshup / 360dialog / Twilio?
4. Dialer vendor (Exotel/Knowlarity/MyOperator)?
5. Payment gateway (Razorpay assumed)?
6. Email (Resend/SES/Postmark)?
7. Hosting (AWS/GCP/Render/Fly)?
8. SLA windows in §4 priorities — confirm?
9. Event log retention (suggest 13mo hot, archive cold)?
10. TCM scope: any-lead-in-zone vs explicitly-assigned-only?

## 15. Operating Principles (locked)
1. No mutation outside the command bus. Ever.
2. Every event must have a listener or be deleted.
3. Every listener must be idempotent (use ledger).
4. Every command replayable from its event chain.
5. No cross-collection joins from another service. Snapshot in events.
6. Optimistic UX, authoritative server. Reconcile, don't pretend.
7. Automations are commands. Same audit, same idempotency.
8. Every external integration is a connector behind a domain interface.
9. Realtime is a privilege not a default. Audit channels quarterly.
10. Errors carry correlationId. Support starts with the trace.

— end —
