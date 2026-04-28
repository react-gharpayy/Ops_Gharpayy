// Hydrates the legacy zustand `useApp().leads` array from the VPS Mongo
// backend and keeps it in sync via Socket.IO events. Mount once near the
// top of the app (AppShell). Every legacy page that reads `leads` from the
// store now sees real data without any per-page refactor.
import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api/client";
import { onEvent, getSocket } from "@/lib/api/socket";
import type { Lead as LegacyLead, LeadStage, Intent } from "@/lib/types";
import type { Lead as WireLead, DomainEvent } from "@/contracts";

function toLegacy(w: WireLead, fallbackTcmId = ""): LegacyLead {
  return {
    id: w._id,
    name: w.name,
    phone: w.phone,
    source: w.source ?? "manual",
    budget: w.budget ?? 0,
    moveInDate: w.moveInDate ?? new Date().toISOString().slice(0, 10),
    preferredArea: w.preferredArea ?? "",
    assignedTcmId: w.assignedTcmId ?? fallbackTcmId,
    stage: (w.stage as LeadStage) ?? "new",
    intent: (w.intent as Intent) ?? "warm",
    confidence: w.confidence ?? 50,
    tags: w.tags ?? [],
    nextFollowUpAt: w.nextFollowUpAt ?? null,
    responseSpeedMins: w.responseSpeedMins ?? 0,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

export function LiveLeadsBridge() {
  const setLeads = useApp((s) => s.setLeads);
  const tcms = useApp((s) => s.tcms);

  useEffect(() => {
    let cancelled = false;
    const fallbackTcm = tcms[0]?.id ?? "";

    void (async () => {
      try {
        const r = await api.leads.list({ limit: 500 });
        if (cancelled) return;
        setLeads((r.items as WireLead[]).map((l) => toLegacy(l, fallbackTcm)));
      } catch (e) {
        console.warn("[LiveLeadsBridge] initial load failed:", (e as Error).message);
        if (!cancelled) setLeads([]);
      }
    })();

    getSocket();
    const off = onEvent((e: DomainEvent) => {
      const cur = useApp.getState().leads;
      if (e.type === "evt.lead.created") {
        const lead = toLegacy(e.payload.lead as WireLead, fallbackTcm);
        if (!cur.some((l) => l.id === lead.id)) setLeads([lead, ...cur]);
      } else if (e.type === "evt.lead.updated") {
        setLeads(cur.map((l) => (l.id === e.payload.leadId
          ? { ...l, ...(e.payload.patch as Partial<LegacyLead>), updatedAt: new Date().toISOString() }
          : l)));
      } else if (e.type === "evt.lead.assigned") {
        setLeads(cur.map((l) => (l.id === e.payload.leadId
          ? { ...l, assignedTcmId: e.payload.tcmId, updatedAt: new Date().toISOString() }
          : l)));
      } else if (e.type === "evt.lead.stage_changed") {
        setLeads(cur.map((l) => (l.id === e.payload.leadId
          ? { ...l, stage: e.payload.to as LeadStage, updatedAt: new Date().toISOString() }
          : l)));
      } else if (e.type === "evt.lead.deleted") {
        setLeads(cur.filter((l) => l.id !== e.payload.leadId));
      }
    });

    return () => { cancelled = true; off(); };
  }, [setLeads, tcms]);

  return null;
}
