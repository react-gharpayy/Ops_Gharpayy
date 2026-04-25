import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState } from "react";
import { useLiveLeads } from "@/hooks/useLiveLeads";
import { tokenStore } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadPasteParser } from "@/components/leads/LeadPasteParser";
import { TodoPanel } from "@/components/todos/TodoPanel";
import type { Lead } from "@/contracts";

export const Route = createFileRoute("/live-leads")({
  head: () => ({ meta: [{ title: "Live Leads (Mongo)" }] }),
  component: () => <AppShell><LiveLeadsPage /></AppShell>,
});

function LiveLeadsPage() {
  const { leads, loading, error, createLead } = useLiveLeads();
  const [selected, setSelected] = useState<Lead | null>(null);

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
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">Live Leads <Badge variant="secondary">Mongo · Realtime</Badge></h1>
        <p className="text-sm text-muted-foreground">Every change is a command. Updates stream over Socket.IO to all open tabs.</p>
      </div>

      <Tabs defaultValue="paste">
        <TabsList>
          <TabsTrigger value="paste">Paste & parse</TabsTrigger>
          <TabsTrigger value="list">All leads ({leads.length})</TabsTrigger>
          {selected && <TabsTrigger value="detail">{selected.name}</TabsTrigger>}
        </TabsList>

        <TabsContent value="paste">
          <LeadPasteParser onSubmit={(p) => createLead(p)} />
        </TabsContent>

        <TabsContent value="list">
          <Card className="p-4">
            {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="divide-y">
              {leads.map((l) => (
                <button key={l._id} type="button" onClick={() => setSelected(l)}
                  className="w-full text-left py-2 px-1 flex items-center justify-between hover:bg-muted/30 rounded">
                  <div>
                    <div className="font-medium">{l.name} <span className="text-xs text-muted-foreground">· {l.phone}</span></div>
                    <div className="text-xs text-muted-foreground">{l.preferredArea} · ₹{l.budget?.toLocaleString()} · move-in {l.moveInDate}</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge>{l.stage}</Badge>
                    <Badge variant="outline">{l.intent}</Badge>
                  </div>
                </button>
              ))}
              {!loading && leads.length === 0 && <p className="text-sm text-muted-foreground py-4">No leads yet. Use “Paste & parse” to add one.</p>}
            </div>
          </Card>
        </TabsContent>

        {selected && (
          <TabsContent value="detail">
            <Card className="p-4 mb-4">
              <h2 className="font-semibold">{selected.name}</h2>
              <p className="text-sm text-muted-foreground">{selected.phone} · {selected.preferredArea} · ₹{selected.budget?.toLocaleString()} · {selected.intent}</p>
            </Card>
            <TodoPanel entityType="lead" entityId={selected._id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
