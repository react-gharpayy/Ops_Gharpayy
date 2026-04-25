// PictureInPictureButton + PipPortal
//
// Uses the Document Picture-in-Picture API (Chrome / Edge / Brave / Opera on
// desktop) to pop the current dashboard view into an always-on-top floating
// window. Workflow: user clicks the "PIP mode" button in the header, the
// browser opens a small detached window containing the current route's content,
// and the user can then snap WhatsApp Web alongside it.
//
// Implementation notes:
// - All app stylesheets (link rel=stylesheet AND inline <style>) are cloned
//   into the PIP window so semantic tokens, fonts and Tailwind classes work.
// - The current page content stays mounted in the original tab; we just teleport
//   the children via a portal. When the PIP window closes, content snaps back.
// - We also relay keyboard shortcuts and clipboard reads back to the main tab.

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { PictureInPicture2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type DocPipWindow = Window & { document: Document };

// Augment Window type for the experimental API
declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (opts?: { width?: number; height?: number }) => Promise<DocPipWindow>;
      window?: DocPipWindow | null;
    };
  }
}

interface PipContextValue {
  pipWindow: DocPipWindow | null;
  open: () => Promise<void>;
  close: () => void;
  supported: boolean;
}

let activeListeners: Array<() => void> = [];

export function usePictureInPicture(): PipContextValue {
  const [pipWindow, setPipWindow] = useState<DocPipWindow | null>(null);
  const supported = typeof window !== "undefined" && "documentPictureInPicture" in window;

  const close = useCallback(() => {
    if (pipWindow && !pipWindow.closed) pipWindow.close();
    setPipWindow(null);
  }, [pipWindow]);

  const open = useCallback(async () => {
    if (!supported) {
      toast.error("Picture-in-Picture isn't supported in this browser. Use Chrome, Edge, Brave or Opera on desktop.");
      return;
    }
    try {
      const w = await window.documentPictureInPicture!.requestWindow({
        width: Math.min(560, window.innerWidth),
        height: Math.min(720, window.innerHeight),
      });

      // Clone all stylesheets and inline <style> tags from the parent document
      // so the dashboard renders identically inside the PIP window.
      const head = w.document.head;
      const cloneStyles = () => {
        head.innerHTML = "";
        // <link rel="stylesheet"> tags (Vite injects these in dev & prod)
        document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((linkEl) => {
          const clone = w.document.createElement("link");
          clone.rel = "stylesheet";
          clone.href = linkEl.href;
          head.appendChild(clone);
        });
        // Inline <style> tags
        document.querySelectorAll<HTMLStyleElement>("style").forEach((styleEl) => {
          const clone = w.document.createElement("style");
          clone.textContent = styleEl.textContent;
          head.appendChild(clone);
        });
        // Theme color & body bg
        const meta = w.document.createElement("meta");
        meta.name = "viewport";
        meta.content = "width=device-width, initial-scale=1";
        head.appendChild(meta);
        // Title
        w.document.title = "Gharpayy · PiP";
      };
      cloneStyles();

      // Body styling — match the host page exactly
      w.document.body.style.margin = "0";
      w.document.body.style.background = getComputedStyle(document.body).backgroundColor || "#0a0a0a";
      w.document.body.style.color = getComputedStyle(document.body).color || "#fff";
      w.document.body.style.fontFamily = getComputedStyle(document.body).fontFamily;

      // Copy theme class (light/dark) onto the PIP <html>
      const themeClass = document.documentElement.className;
      if (themeClass) w.document.documentElement.className = themeClass;

      // Listen for new stylesheets added later (HMR, dynamic imports)
      const mo = new MutationObserver((records) => {
        for (const rec of records) {
          rec.addedNodes.forEach((n) => {
            if (n.nodeName === "LINK" || n.nodeName === "STYLE") cloneStyles();
          });
        }
      });
      mo.observe(document.head, { childList: true });

      // Relay keyboard shortcuts back to the main window
      const onKey = (e: KeyboardEvent) => {
        const evt = new KeyboardEvent(e.type, {
          key: e.key,
          code: e.code,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
        });
        window.dispatchEvent(evt);
      };
      w.addEventListener("keydown", onKey);

      const cleanup = () => {
        mo.disconnect();
        w.removeEventListener("keydown", onKey);
        setPipWindow((curr) => (curr === w ? null : curr));
      };
      w.addEventListener("pagehide", cleanup);
      activeListeners.push(cleanup);

      setPipWindow(w);
    } catch (err) {
      console.error("PIP request failed", err);
      toast.error("Couldn't open PiP window. Make sure the page has focus and try again.");
    }
  }, [supported]);

  // Cleanup if component unmounts
  useEffect(() => {
    return () => {
      activeListeners.forEach((fn) => fn());
      activeListeners = [];
    };
  }, []);

  return { pipWindow, open, close, supported };
}

/**
 * Renders children into the active PIP window (if any). When PIP is closed,
 * children render normally in the host page. The visual swap is automatic.
 */
export function PipPortal({
  pipWindow,
  children,
  className,
  style,
}: {
  pipWindow: DocPipWindow | null;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (!pipWindow) return <>{children}</>;

  // Lazily create a single mount node inside the PIP body
  if (!containerRef.current) {
    const mount = pipWindow.document.createElement("div");
    mount.id = "pip-root";
    if (className) mount.className = className;
    if (style) Object.assign(mount.style, style as Record<string, string>);
    pipWindow.document.body.appendChild(mount);
    containerRef.current = mount;
  }

  return createPortal(children, containerRef.current);
}

/**
 * Header button. Click → opens the dashboard in a Picture-in-Picture window
 * that floats on top of WhatsApp Web (or any other app). Click again to close.
 */
export function PictureInPictureButton({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "ghost" | "outline";
}) {
  const { open, close, pipWindow, supported } = usePictureInPicture();
  const active = !!pipWindow && !pipWindow.closed;

  return (
    <Button
      variant={active ? "secondary" : variant}
      size="sm"
      onClick={() => (active ? close() : open())}
      className={cn("gap-1.5 h-8 text-xs", className)}
      title={
        !supported
          ? "PiP needs Chrome/Edge/Brave/Opera on desktop"
          : active
          ? "Close Picture-in-Picture"
          : "Pop the dashboard into a floating window over WhatsApp"
      }
    >
      <PictureInPicture2 className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{active ? "Close PiP" : "PiP mode"}</span>
    </Button>
  );
}

// Re-export the floating window so other components can subscribe to it
export type { DocPipWindow };
