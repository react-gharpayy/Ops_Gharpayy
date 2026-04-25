import { useMemo, useState } from "react";
import { ClipboardPaste, Save, Repeat2, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { parseLead, detectZone } from "@/lib/lead-identity/parser";
import { useIdentityStore } from "@/lib/lead-identity/store";
import { toast } from "sonner";

const todayIso = () => new Date().toISOString().slice(0, 10);

export function LeadCapturePipPanel() {
  const checkDuplicates = useIdentityStore((s) => s.checkDuplicates);
  const createLead = useIdentityStore((s) => s.createLead);
  const [raw, setRaw] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [areas, setAreas] = useState("");
  const [budget, setBudget] = useState("");
  const [moveIn, setMoveIn] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const zone = useMemo(() => detectZone(areas), [areas]);

  const parse = (text = raw) => {
    const parsed = parseLead(text);
    if (!parsed) {
      toast.error("Could not parse this lead");
      return;
    }
    setName(parsed.name);
    setPhone(parsed.phone);
    setAreas(parsed.areas?.length ? parsed.areas.join(", ") : parsed.location);
    setBudget(parsed.budget);
    if (/^\d{4}-\d{2}-\d{2}$/.test(parsed.moveIn)) setMoveIn(parsed.moveIn);
    setNotes(parsed.specialReqs || parsed.rawSource.slice(0, 160));
    toast.success("Lead parsed");
  };

  const reset = () => {
    setRaw(""); setName(""); setPhone(""); setAreas(""); setBudget(""); setMoveIn(todayIso()); setNotes("");
  };

  const save = (keepOpen: boolean) => {
    if (!name.trim() || !phone.replace(/\D/g, "").match(/^[6-9]\d{9}$/)) {
      toast.error("Name and valid phone are required");
      return;
    }
    const dup = checkDuplicates({ name, phone, location: areas });
    if (dup.type === "exact" || dup.type === "strong") {
      toast.warning(`Duplicate: ${dup.candidates[0]?.lead.name}`);
      return;
    }
    createLead({
      name, phone, email: "", location: areas,
      areas: areas.split(",").map((a) => a.trim()).filter(Boolean),
      fullAddress: "", budget, moveIn, type: "", room: "", need: "",
      specialReqs: notes, inBLR: null, zone, rawSource: raw || `[PiP Capture] ${name}`,
    }, { stage: "MYT [TENANT]", quality: budget ? "good" : null });
    toast.success("Lead added");
    if (keepOpen) reset();
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-3 space-y-3 pip-compact">
      <div className="sticky top-0 z-10 -mx-3 -mt-3 px-3 py-2 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-base font-semibold flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> PiP Add Lead</h1>
            <p className="text-[10px] text-muted-foreground">Paste WhatsApp text, parse, save, next.</p>
          </div>
          {zone && <Badge variant="secondary" className="text-[10px]">{zone}</Badge>}
        </div>
      </div>

      <Textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onPaste={(e) => setTimeout(() => parse(e.currentTarget.value), 0)}
        placeholder="Paste WhatsApp lead message here…"
        className="min-h-24 text-xs"
      />
      <Button size="sm" className="w-full gap-1.5" onClick={() => parse()}><ClipboardPaste className="h-3.5 w-3.5" /> Parse pasted lead</Button>

      <div className="grid grid-cols-2 gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="h-9 text-xs" />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="h-9 text-xs" />
      </div>
      <Input value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Areas" className="h-9 text-xs" />
      <div className="grid grid-cols-2 gap-2">
        <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget" className="h-9 text-xs" />
        <Input type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} className="h-9 text-xs" />
      </div>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes / requirement" className="min-h-16 text-xs" />

      <div className="sticky bottom-0 -mx-3 px-3 py-2 bg-background/95 border-t border-border flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => save(true)}><Repeat2 className="h-3.5 w-3.5" /> Save + Next</Button>
        <Button size="sm" className="flex-1 gap-1" onClick={() => save(false)}><Save className="h-3.5 w-3.5" /> Save</Button>
      </div>
      {!raw && <div className="text-[10px] text-muted-foreground flex gap-1"><AlertTriangle className="h-3 w-3" /> Keep this window over WhatsApp and paste each chat directly.</div>}
    </div>
  );
}
