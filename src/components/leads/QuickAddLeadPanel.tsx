// Quick Add Lead — lightweight floating panel optimised for one-hand use
// while chatting on WhatsApp. Pre-fills sensible defaults, supports
// "Save + Next" (panel stays open), and is keyboard-first (Enter saves).
//
// Designed to function correctly inside the PiP window AND the main tab.
import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useIdentityStore } from "@/lib/lead-identity/store";
import { detectZone, parseLead } from "@/lib/lead-identity/parser";
import { toast } from "sonner";
import { Save, Repeat2, Phone, MapPin, Sparkles } from "lucide-react";

interface Props { open: boolean; onClose: () => void; }

const todayIso = () => new Date().toISOString().slice(0, 10);

export function QuickAddLeadPanel({ open, onClose }: Props) {
  const createLead = useIdentityStore((s) => s.checkDuplicates);
  const create = useIdentityStore((s) => s.createLead);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [requirement, setRequirement] = useState("");
  const [moveIn, setMoveIn] = useState(todayIso());
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) setTimeout(() => nameRef.current?.focus(), 50); }, [open]);

  const zone = detectZone(location);

  const reset = () => {
    setName(""); setPhone(""); setLocation(""); setRequirement(""); setMoveIn(todayIso());
    setTimeout(() => nameRef.current?.focus(), 30);
  };

  const save = (keepOpen: boolean) => {
    if (!name.trim() || !phone.replace(/\D/g, "").match(/^[6-9]\d{9}$/)) {
      toast.error("Need a name and a valid 10-digit phone");
      return;
    }
    const dup = createLead({ name, phone, location });
    if (dup.type === "exact" || dup.type === "strong") {
      toast.warning(`Duplicate detected: ${dup.candidates[0]?.lead.name} — open it instead`);
      return;
    }
    const lead = create({
      name: name.trim(),
      phone: phone.trim(),
      email: "",
      location: location.trim(),
      budget: "",
      moveIn,
      type: "",
      room: "",
      need: "",
      specialReqs: requirement.trim(),
      inBLR: null,
      zone,
      rawSource: `[QuickAdd] ${name} ${phone}`,
    });
    toast.success(`Lead saved · ${lead.name}`);
    if (keepOpen) reset();
    else onClose();
  };

  // Paste WhatsApp message → auto-fill any field we can extract
  const onPaste = (raw: string) => {
    const parsed = parseLead(raw);
    if (!parsed) return;
    if (parsed.name) setName(parsed.name);
    if (parsed.phone) setPhone(parsed.phone);
    if (parsed.location) setLocation(parsed.location);
    if (parsed.specialReqs) setRequirement(parsed.specialReqs);
    if (parsed.moveIn) setMoveIn(parsed.moveIn.length === 10 ? parsed.moveIn : moveIn);
    toast.success("Auto-filled from clipboard");
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(false); }
        }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Quick Add Lead
          </SheetTitle>
          <p className="text-[11px] text-muted-foreground">
            Today · WhatsApp · New · keyboard-first · paste WhatsApp message into any field to auto-fill
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-3 mt-4">
          <div>
            <Label className="text-xs">Name *</Label>
            <Input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onPaste={(e) => {
                const txt = e.clipboardData.getData("text");
                if (txt && txt.length > 30) { e.preventDefault(); onPaste(txt); }
              }}
              placeholder="Rahul Sharma"
            />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1.5"><Phone className="h-3 w-3" /> Phone *</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s]/g, ""))}
              placeholder="98xxxxxxxx"
              inputMode="tel"
            />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Location</Label>
            <div className="relative">
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Koramangala, HSR Layout…"
              />
              {zone && <Badge variant="secondary" className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px]">{zone}</Badge>}
            </div>
          </div>
          <div>
            <Label className="text-xs">Move-in</Label>
            <Input type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Requirement (free text)</Label>
            <Textarea
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              rows={3}
              placeholder="Budget 12k, single sharing, near metro…"
            />
          </div>
        </div>

        <div className="border-t border-border pt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <Button onClick={() => save(true)} variant="outline" size="sm" className="flex-1 gap-1.5">
              <Repeat2 className="h-3.5 w-3.5" /> Save + Next
            </Button>
            <Button onClick={() => save(false)} size="sm" className="flex-1 gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            ⌘/Ctrl + Enter to save · Tab to move
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
