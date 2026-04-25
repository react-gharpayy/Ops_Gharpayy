// Live parser UI — paste anything, see fields extracted into the cmd.lead.create payload,
// fix any inline validation errors, then submit. No "intermediate random data".
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, Sparkles, Wand2 } from "lucide-react";
import { parseLeadText, type ParseIssue, type ExtractedLead, exampleCount } from "@/lib/lead-parser";
import { CreateLeadCmd } from "@/contracts";

type Field = keyof ExtractedLead;

const SAMPLE = `Hi team, new lead 👇
Rahul Sharma 9876543210
Looking for 2BHK in Koramangala
Budget: 25k
Move in: next week
Source: WhatsApp`;

interface Props {
  onSubmit: (payload: {
    name: string; phone: string; budget: number; preferredArea: string; moveInDate: string;
    source?: string; intent?: "hot" | "warm" | "cold"; tags?: string[];
  }) => Promise<{ ok: true; eventIds: string[] } | { ok: false; error: string }>;
}

export function LeadPasteParser({ onSubmit }: Props) {
  const [raw, setRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  // edited overrides — empty string means "use parsed", anything else is user override
  const [overrides, setOverrides] = useState<Partial<Record<Field, string>>>({});

  const parsed = useMemo(() => parseLeadText(raw), [raw]);

  const merged: ExtractedLead = useMemo(() => {
    const out: ExtractedLead = { ...parsed.extracted };
    for (const [k, v] of Object.entries(overrides) as [Field, string][]) {
      if (v === "" || v == null) continue;
      if (k === "budget") out.budget = Number(v);
      else (out as Record<string, unknown>)[k] = v;
    }
    return out;
  }, [parsed.extracted, overrides]);

  // Build the proposed cmd.lead.create payload and validate it with Zod
  const candidatePayload = useMemo(() => ({
    name: merged.name ?? "",
    phone: merged.phone ?? "",
    source: merged.source ?? "paste",
    budget: merged.budget ?? 0,
    moveInDate: merged.moveInDate ?? "",
    preferredArea: merged.preferredArea ?? "",
    zoneId: null,
    intent: merged.intent,
    tags: merged.bhk ? [merged.bhk] : undefined,
  }), [merged]);

  const zodCheck = useMemo(() => CreateLeadCmd.shape.payload.safeParse(candidatePayload), [candidatePayload]);

  const allIssues: ParseIssue[] = useMemo(() => {
    const issues: ParseIssue[] = [...parsed.issues.filter((i) => {
      // Suppress an issue if the user has manually filled that field
      const map: Record<string, Field> = { phone: "phone", name: "name", budget: "budget", preferredArea: "preferredArea", moveInDate: "moveInDate" };
      const f = map[i.field];
      return !(f && overrides[f]);
    })];
    if (!zodCheck.success && raw) {
      for (const e of zodCheck.error.errors) {
        const path = e.path.join(".");
        issues.push({
          field: (path as ParseIssue["field"]) || "general",
          severity: "error",
          message: e.message,
        });
      }
    }
    return dedupeIssues(issues);
  }, [parsed.issues, zodCheck, overrides, raw]);

  const blocking = allIssues.some((i) => i.severity === "error");

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Paste the lead</h3>
            <Badge variant="secondary">{exampleCount().toLocaleString()} patterns</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRaw(SAMPLE)}>
            <Sparkles className="h-3 w-3 mr-1" /> Try sample
          </Button>
        </div>
        <Textarea
          value={raw}
          onChange={(e) => { setRaw(e.target.value); setOverrides({}); setResult(null); }}
          placeholder="Paste WhatsApp message, portal lead, email signature, anything…"
          rows={8}
          className="font-mono text-xs"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Confidence: <strong className={parsed.confidence >= 80 ? "text-green-600" : parsed.confidence >= 50 ? "text-amber-600" : "text-destructive"}>{parsed.confidence}%</strong></span>
          <span>{Object.values(parsed.extracted).filter(Boolean).length} fields extracted</span>
        </div>
      </Card>

      {raw && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Review & fix</h3>
            {!blocking ? (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" /> Ready to create
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" /> {allIssues.filter(i => i.severity === "error").length} issue(s)
              </span>
            )}
          </div>

          <FieldRow label="Name" field="name" value={overrides.name ?? merged.name ?? ""} parsed={parsed.extracted.name} onChange={(v) => setOverrides({ ...overrides, name: v })} issues={allIssues} />
          <FieldRow label="Phone" field="phone" value={overrides.phone ?? merged.phone ?? ""} parsed={parsed.extracted.phone} onChange={(v) => setOverrides({ ...overrides, phone: v })} issues={allIssues} />
          <FieldRow label="Email (optional)" field="email" value={overrides.email ?? merged.email ?? ""} parsed={parsed.extracted.email} onChange={(v) => setOverrides({ ...overrides, email: v })} issues={allIssues} />
          <FieldRow label="Budget (₹/mo)" field="budget" type="number" value={String(overrides.budget ?? merged.budget ?? "")} parsed={merged.budget ? `₹${merged.budget.toLocaleString()}` : undefined} onChange={(v) => setOverrides({ ...overrides, budget: v })} issues={allIssues} />
          <FieldRow label="Preferred area" field="preferredArea" value={overrides.preferredArea ?? merged.preferredArea ?? ""} parsed={parsed.extracted.preferredArea} onChange={(v) => setOverrides({ ...overrides, preferredArea: v })} issues={allIssues} />
          <FieldRow label="Move-in date" field="moveInDate" type="date" value={overrides.moveInDate ?? merged.moveInDate ?? ""} parsed={parsed.extracted.moveInDate} onChange={(v) => setOverrides({ ...overrides, moveInDate: v })} issues={allIssues} />

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {merged.intent && <Badge variant={merged.intent === "hot" ? "destructive" : "secondary"}>{merged.intent} intent</Badge>}
            {merged.source && <Badge variant="outline">source: {merged.source}</Badge>}
            {merged.bhk && <Badge variant="outline">{merged.bhk}</Badge>}
          </div>

          {allIssues.filter((i) => i.field === "general").map((i, k) => (
            <div key={k} className="text-xs text-destructive">{i.message}</div>
          ))}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" onClick={() => { setRaw(""); setOverrides({}); setResult(null); }}>Clear</Button>
            <Button
              disabled={blocking || submitting}
              onClick={async () => {
                if (!zodCheck.success) return;
                setSubmitting(true);
                setResult(null);
                const r = await onSubmit(zodCheck.data);
                setSubmitting(false);
                setResult(r.ok ? `✓ Lead created (${r.eventIds.length} event)` : `✗ ${r.error}`);
                if (r.ok) { setRaw(""); setOverrides({}); }
              }}
            >
              {submitting ? "Creating…" : "Create lead from parsed data"}
            </Button>
          </div>
          {result && <p className="text-xs">{result}</p>}
        </Card>
      )}
    </div>
  );
}

function FieldRow({
  label, field, value, parsed, onChange, issues, type = "text",
}: {
  label: string;
  field: ParseIssue["field"];
  value: string;
  parsed?: string | undefined;
  onChange: (v: string) => void;
  issues: ParseIssue[];
  type?: string;
}) {
  const fieldIssues = issues.filter((i) => i.field === field);
  const error = fieldIssues.find((i) => i.severity === "error");
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {parsed && <span className="text-[10px] text-muted-foreground">parsed: {parsed}</span>}
      </div>
      <Input value={value} type={type} onChange={(e) => onChange(e.target.value)} className={error ? "border-destructive" : ""} />
      {fieldIssues.map((i, k) => (
        <p key={k} className={`text-[11px] ${i.severity === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {i.message}{i.suggestion ? ` — ${i.suggestion}` : ""}
        </p>
      ))}
    </div>
  );
}

function dedupeIssues(issues: ParseIssue[]): ParseIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const k = `${i.field}|${i.severity}|${i.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
