import { useMemo, useState } from "react";
import { Save, Repeat2, Sparkles, AlertTriangle, MapPin, Link2 } from "lucide-react";
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
  const [email, setEmail] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [budget, setBudget] = useState("");
  const [moveIn, setMoveIn] = useState(todayIso());
  const [room, setRoom] = useState("");
  const [need, setNeed] = useState("");
  const [type, setType] = useState("");
  const [notes, setNotes] = useState("");
  const [extra, setExtra] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const zone = useMemo(() => detectZone(areas), [areas]);

  const parse = (text = raw) => {
    const parsed = parseLead(text);
    if (!parsed) {
      toast.error("Could not parse this lead");
      return;
    }
    setName(parsed.name);
    setPhone(parsed.phone);
    setEmail(parsed.email);
    setAreas(parsed.areas?.length ? parsed.areas.join(", ") : parsed.location);
    setFullAddress(parsed.fullAddress);
    setBudget(parsed.budget);
    if (/^\d{4}-\d{2}-\d{2}$/.test(parsed.moveIn)) setMoveIn(parsed.moveIn);
    else if (parsed.moveIn) setMoveIn(parsed.moveIn);
    setType(parsed.type);
    setRoom(parsed.room);
    setNeed(parsed.need);
    setNotes(parsed.specialReqs || parsed.rawSource.slice(0, 160));
    setExtra(parsed.extraContent || "");
    setLinks(parsed.links || []);
    toast.success("Auto-parsed paste");
  };

  const reset = () => {
    setRaw(""); setName(""); setPhone(""); setEmail(""); setAreas(""); setFullAddress(""); setBudget(""); setMoveIn(todayIso()); setType(""); setRoom(""); setNeed(""); setNotes(""); setExtra(""); setLinks([]);
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
      name, phone, email, location: areas,
      areas: areas.split(",").map((a) => a.trim()).filter(Boolean),
      fullAddress, budget, moveIn, type, room, need,
      specialReqs: notes,
      extraContent: extra,
      links,
      geoIntel: {
        query: [areas, fullAddress].filter(Boolean).join(" · "),
        zone,
        areas: areas.split(",").map((a) => a.trim()).filter(Boolean),
        links,
        confidence: links.length || areas.includes(",") ? "high" : areas ? "medium" : "low",
        distanceHint: links.length ? "Map link attached for distance check" : areas ? "Area ready, exact map link pending" : "Needs location before distance check",
        syncStatus: areas || links.length ? links.length ? "ready" : "needs-map-link" : "needs-location",
      },
      inBLR: null, zone, rawSource: raw || `[PiP Capture] ${name}`,
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
        onChange={(e) => { setRaw(e.target.value); parse(e.target.value); }}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (!pasted) return;
          e.preventDefault();
          setRaw(pasted);
          parse(pasted);
        }}
        placeholder="Paste WhatsApp lead message here…"
        className="min-h-24 text-xs"
      />
      <div className="rounded-md border border-border bg-card p-2 text-[10px] text-muted-foreground flex items-start gap-1.5">
        <Sparkles className="h-3 w-3 text-primary mt-0.5" /> Paste only — parsing starts automatically, no parse click needed.
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="h-9 text-xs" />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="h-9 text-xs" />
      </div>
      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="h-9 text-xs" />
      <Input value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Areas / location" className="h-9 text-xs" />
      <Textarea value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} placeholder="Full address / map link" className="min-h-12 text-xs" />
      <div className="grid grid-cols-2 gap-2">
        <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget" className="h-9 text-xs" />
        <Input type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} className="h-9 text-xs" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="Type" className="h-9 text-xs" />
        <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room" className="h-9 text-xs" />
        <Input value={need} onChange={(e) => setNeed(e.target.value)} placeholder="Need" className="h-9 text-xs" />
      </div>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes / requirement" className="min-h-16 text-xs" />
      <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Extra pasted content kept for later review" className="min-h-16 text-xs" />
      <div className="rounded-md border border-border bg-card p-2 space-y-1 text-[10px]">
        <div className="flex items-center gap-1 text-foreground"><MapPin className="h-3 w-3 text-primary" /> Geo-intelligence · {zone || "Needs area"}</div>
        <div className="text-muted-foreground">{links.length ? "Map/link attached for distance sync" : "Add or paste a map link for exact distance sync"}</div>
        {links.map((link) => <div key={link} className="truncate text-primary flex gap-1"><Link2 className="h-3 w-3 shrink-0" />{link}</div>)}
      </div>

      <div className="sticky bottom-0 -mx-3 px-3 py-2 bg-background/95 border-t border-border flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => save(true)}><Repeat2 className="h-3.5 w-3.5" /> Save + Next</Button>
        <Button size="sm" className="flex-1 gap-1" onClick={() => save(false)}><Save className="h-3.5 w-3.5" /> Save</Button>
      </div>
      {!raw && <div className="text-[10px] text-muted-foreground flex gap-1"><AlertTriangle className="h-3 w-3" /> Keep this window over WhatsApp and paste each chat directly.</div>}
    </div>
  );
}
