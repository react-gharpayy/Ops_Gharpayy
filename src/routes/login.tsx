import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api, tokenStore } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="p-6 w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-bold">Gharpayy CRM</h1>
          <p className="text-sm text-muted-foreground">{mode === "login" ? "Sign in" : "Create account"} on your VPS API</p>
        </div>
        {mode === "signup" && (
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="space-y-1">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button
          className="w-full"
          disabled={busy}
          onClick={async () => {
            setErr(null);
            setBusy(true);
            try {
              if (mode === "signup") {
                await api.signup({ email, password, name, role: "admin" });
              }
              await api.login(email, password);
              nav({ to: "/live-leads" });
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "…" : mode === "login" ? "Sign in" : "Create & sign in"}
        </Button>
        <button className="text-xs text-muted-foreground underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
        {tokenStore.get() && (
          <button className="text-xs text-destructive underline" onClick={async () => { await api.logout(); setErr("Logged out"); }}>
            Log out current session
          </button>
        )}
        <p className="text-xs text-muted-foreground">API: <code>{api.apiUrl}</code></p>
      </Card>
    </div>
  );
}
