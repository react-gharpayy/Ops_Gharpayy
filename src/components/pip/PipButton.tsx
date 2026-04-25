import { PictureInPicture2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePip } from "./PipProvider";

export function PipButton({ className }: { className?: string }) {
  const { open, close, active, supported } = usePip();

  return (
    <Button
      variant={active ? "secondary" : "default"}
      size="sm"
      onClick={() => (active ? close() : open())}
      disabled={!supported && !active}
      className={cn(
        "gap-1.5 h-8 text-xs font-medium shadow-sm",
        active && "bg-primary/15 text-primary hover:bg-primary/20",
        className,
      )}
      title={
        !supported
          ? "PiP needs Chrome, Edge, Brave or Opera on desktop"
          : active
          ? "Close the floating dashboard window"
          : "Pop the dashboard out as a floating always-on-top window over WhatsApp"
      }
    >
      {active ? <X className="h-3.5 w-3.5" /> : <PictureInPicture2 className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{active ? "Exit PiP" : "PiP mode"}</span>
    </Button>
  );
}
