import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState } from "react";
import { useLiveLeads } from "@/hooks/useLiveLeads";
import { tokenStore } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/live-leads")({
  head: () => ({ meta: [{ title: "Live Leads (Mongo)" }] }),
  component: () => <AppShell><LiveLeadsPage /></AppShell>,
});

function LiveLeadsPage() {
  const { leads, loading, error, createLead } = useLiveLeads();
  const [form, setForm] = useState({ name: "", phone: "", budget: 12000, preferredArea: "Koramangala", moveInDate: new Date().toISOString().slice(0, 10) });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!tokenStore.get()) {
    return (
      <Card className="m-6 p-6">
        <h2 className="text-lg font-semibold mb-2">Sign in required</h2>
        <p className="text-sm text-muted-foreground mb-4">This page talks to your VPS Node API. Sign in to get a JWT.</p>
        <Link to="/login" className="text-primary underline">Go to login →</Link>
      </Card>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Live Leads <Badge variant="secondary">Mongo · Realtime</Badge></h1>
        <p className="text-sm text-muted-foreground">Every change is a command. Updates stream over Socket.IO to all open tabs.</p>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Create lead</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="Area" value={form.preferredArea} onChange={(e) => setForm({ ...form, preferredArea: e.target.value })} />
          <Input type="number" placeholder="Budget" value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} />
          <Input type="date" value={form.moveInDate} onChange={(e) => setForm({ ...form, moveInDate: e.target.value })} />
        </div>
        <Button
          disabled={submitting || !form.name || !form.phone}
          onClick={async () => {
            setSubmitting(true);
            setMsg(null);
            const r = await createLead(form);
            setSubmitting(false);
            setMsg(r.ok ? `✓ Created (events: ${r.eventIds.length})` : `✗ ${r.error}`);
            if (r.ok) setForm({ ...form, name: "", phone: "" });
          }}
        >
          {submitting ? "Creating…" : "Create lead"}
        </Button>
        {msg && <p className="text-sm">{msg}</p>}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{leads.length} leads</h2>
          {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
          {error && <span className="text-xs text-destructive">Error: {error}</span>}
        </div>
        <div className="divide-y">
          {leads.map((l) => (
            <div key={l._id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{l.name} <span className="text-xs text-muted-foreground">· {l.phone}</span></div>
                <div className="text-xs text-muted-foreground">{l.preferredArea} · ₹{l.budget} · move-in {l.moveInDate}</div>
              </div>
              <div className="flex gap-2 items-center">
                <Badge>{l.stage}</Badge>
                <Badge variant="outline">{l.intent}</Badge>
              </div>
            </div>
          ))}
          {!loading && leads.length === 0 && <p className="text-sm text-muted-foreground py-4">No leads yet. Create one above.</p>}
        </div>
      </Card>
    </div>
  );
}
