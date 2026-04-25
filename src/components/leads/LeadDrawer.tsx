// Salesforce-style lead detail drawer. Right-side sheet with:
//  - Header (name, phone, intent, stage badges, quick actions)
//  - Stage stepper (full sales motion: New → Contacted → Tour scheduled →
//    Tour done → Negotiation → Booked, plus Dropped)
//  - Tabs: Activity (timeline + composer) · Details · Tasks · Notes ·
//          Calls · Emails · Files · Related
//  - Quick actions: Call, Email, WhatsApp, Schedule visit, Add task
//
// Every state change goes through the typed command bus and is reflected via
// realtime events to ALL connected tabs.
import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Phone, Mail, MessageCircle, Calendar, ListTodo, ExternalLink, FileText, Activity as ActivityIcon, Info, Link2 } from "lucide-react";
import { useActivities } from "@/hooks/useActivities";
import { ActivityTimeline } from "@/components/activities/ActivityTimeline";
import { ActivityComposer } from "@/components/activities/ActivityComposer";
import { StageStepper } from "@/components/leads/StageStepper";
import { TodoPanel } from "@/components/todos/TodoPanel";
import type { Lead } from "@/contracts";

interface Props {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
  assignees?: { id: string; label: string }[];
}

export function LeadDrawer({ lead, open, onOpenChange, currentUserId, assignees = [] }: Props) {
  if (!lead) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col gap-0">
        <DrawerInner lead={lead} currentUserId={currentUserId} assignees={assignees} />
      </SheetContent>
    </Sheet>
  );
}

function DrawerInner({ lead, currentUserId, assignees }: { lead: Lead; currentUserId?: string; assignees: { id: string; label: string }[] }) {
  const { activities, loading, log, remove } = useActivities({ entityType: "lead", entityId: lead._id });

  const counts = useMemo(() => ({
    calls:   activities.filter((a) => a.kind === "call").length,
    emails:  activities.filter((a) => a.kind === "email").length,
    notes:   activities.filter((a) => a.kind === "note").length,
    msgs:    activities.filter((a) => a.kind === "whatsapp" || a.kind === "sms").length,
    visits:  activities.filter((a) => a.kind === "site_visit" || a.kind === "meeting").length,
  }), [activities]);

  const telHref = lead.phone ? `tel:${lead.phone.replace(/\s+/g, "")}` : undefined;
  const waHref = lead.phone ? `https://wa.me/${lead.phone.replace(/\D+/g, "")}` : undefined;

  return (
    <>
      {/* Header */}
      <SheetHeader className="px-5 py-4 border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SheetTitle className="text-lg truncate">{lead.name}</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {lead.phone} · {lead.preferredArea} · ₹{lead.budget?.toLocaleString()} · move-in {lead.moveInDate}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge>{lead.stage}</Badge>
              <Badge variant="outline" className="capitalize">{lead.intent}</Badge>
              <Badge variant="secondary">Source: {lead.source}</Badge>
              {lead.assignedTcmId && <Badge variant="outline">TCM: {lead.assignedTcmId.slice(-6)}</Badge>}
              <Badge variant="outline">Confidence {lead.confidence}%</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <a href={telHref} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="w-full justify-start gap-1.5"><Phone className="h-3.5 w-3.5" />Call</Button>
            </a>
            <a href={waHref} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="w-full justify-start gap-1.5"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</Button>
            </a>
          </div>
        </div>

        <div className="mt-3">
          <StageStepper lead={lead} />
        </div>
      </SheetHeader>

      {/* Tabs */}
      <Tabs defaultValue="activity" className="flex-1 flex flex-col min-h-0">
        <TabsList className="rounded-none border-b w-full justify-start overflow-x-auto h-auto px-3">
          <TabsTrigger value="activity" className="gap-1.5"><ActivityIcon className="h-3.5 w-3.5" />Activity <Badge variant="secondary" className="ml-1 text-[10px]">{activities.length}</Badge></TabsTrigger>
          <TabsTrigger value="details" className="gap-1.5"><Info className="h-3.5 w-3.5" />Details</TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5"><ListTodo className="h-3.5 w-3.5" />Tasks</TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5">Notes {counts.notes > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{counts.notes}</Badge>}</TabsTrigger>
          <TabsTrigger value="calls" className="gap-1.5">Calls {counts.calls > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{counts.calls}</Badge>}</TabsTrigger>
          <TabsTrigger value="emails" className="gap-1.5">Emails {counts.emails > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{counts.emails}</Badge>}</TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5">Messages {counts.msgs > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{counts.msgs}</Badge>}</TabsTrigger>
          <TabsTrigger value="visits" className="gap-1.5">Visits {counts.visits > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{counts.visits}</Badge>}</TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Files</TabsTrigger>
          <TabsTrigger value="related" className="gap-1.5"><Link2 className="h-3.5 w-3.5" />Related</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <TabsContent value="activity" className="m-0 space-y-4">
            <div className="rounded-md border bg-card p-3">
              <ActivityComposer onLog={log} />
            </div>
            <Separator />
            <ActivityTimeline activities={activities} loading={loading} onDelete={remove} />
          </TabsContent>

          <TabsContent value="details" className="m-0">
            <DetailsGrid lead={lead} />
          </TabsContent>

          <TabsContent value="tasks" className="m-0">
            <TodoPanel entityType="lead" entityId={lead._id} currentUserId={currentUserId} assignees={assignees} />
          </TabsContent>

          <TabsContent value="notes" className="m-0">
            <ActivityTimeline activities={activities.filter((a) => a.kind === "note")} loading={loading} onDelete={remove} emptyHint="No notes yet. Use the Activity tab to add one." />
          </TabsContent>
          <TabsContent value="calls" className="m-0">
            <ActivityTimeline activities={activities.filter((a) => a.kind === "call")} loading={loading} onDelete={remove} emptyHint="No call logs yet." />
          </TabsContent>
          <TabsContent value="emails" className="m-0">
            <ActivityTimeline activities={activities.filter((a) => a.kind === "email")} loading={loading} onDelete={remove} emptyHint="No emails logged." />
          </TabsContent>
          <TabsContent value="messages" className="m-0">
            <ActivityTimeline activities={activities.filter((a) => a.kind === "whatsapp" || a.kind === "sms")} loading={loading} onDelete={remove} emptyHint="No messages logged." />
          </TabsContent>
          <TabsContent value="visits" className="m-0">
            <ActivityTimeline activities={activities.filter((a) => a.kind === "site_visit" || a.kind === "meeting")} loading={loading} onDelete={remove} emptyHint="No site visits or meetings yet." />
          </TabsContent>

          <TabsContent value="files" className="m-0">
            <p className="text-sm text-muted-foreground py-6 text-center">File attachments arrive in the next module. Logged via <code className="text-xs">document_shared</code> activities for now.</p>
          </TabsContent>
          <TabsContent value="related" className="m-0">
            <RelatedPanel lead={lead} />
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}

function DetailsGrid({ lead }: { lead: Lead }) {
  const rows: Array<[string, React.ReactNode]> = [
    ["Name", lead.name],
    ["Phone", lead.phone],
    ["Source", lead.source],
    ["Budget", `₹${lead.budget?.toLocaleString()}`],
    ["Move-in", lead.moveInDate],
    ["Preferred area", lead.preferredArea],
    ["Zone", lead.zoneId ?? "—"],
    ["Assigned TCM", lead.assignedTcmId ?? "—"],
    ["Stage", lead.stage],
    ["Intent", lead.intent],
    ["Confidence", `${lead.confidence}%`],
    ["Tags", lead.tags?.join(", ") || "—"],
    ["Next follow-up", lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleString() : "—"],
    ["Response speed", `${lead.responseSpeedMins} min`],
    ["Created", new Date(lead.createdAt).toLocaleString()],
    ["Updated", new Date(lead.updatedAt).toLocaleString()],
  ];
  return (
    <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-col py-1.5 border-b border-border/50 last:border-0">
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</dt>
          <dd className="text-foreground break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function RelatedPanel({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md border p-3 flex items-center justify-between">
        <div>
          <div className="font-medium">Tours scheduled</div>
          <div className="text-xs text-muted-foreground">Tours module ships next.</div>
        </div>
        <Button size="sm" variant="outline" disabled className="gap-1.5"><Calendar className="h-3.5 w-3.5" />Schedule tour</Button>
      </div>
      <div className="rounded-md border p-3 flex items-center justify-between">
        <div>
          <div className="font-medium">Owner / Property</div>
          <div className="text-xs text-muted-foreground">Inventory linkage arrives with the Inventory module.</div>
        </div>
        <Button size="sm" variant="outline" disabled className="gap-1.5"><ExternalLink className="h-3.5 w-3.5" />Link unit</Button>
      </div>
      <div className="rounded-md border p-3 text-xs text-muted-foreground">
        Lead ID: <code>{lead._id}</code>
      </div>
    </div>
  );
}
