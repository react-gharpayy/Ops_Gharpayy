// Frontend API client. Reads VITE_API_URL from env. Sends Bearer token from localStorage.
// Server is hosted on YOUR VPS — set VITE_API_URL to e.g. https://api.gharpayy.com
//
// Falls back to a localStorage adapter when VITE_API_URL is unset or the
// server is unreachable — so todos / activities work end-to-end even before
// the VPS is provisioned. As soon as VITE_API_URL is set and reachable,
// real network mode kicks in automatically.
import { localAdapter, isLocalMode } from "./local-adapter";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

const TOKEN_KEY = "gharpayy.access_token";
export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new ApiError("NO_API_URL", "VITE_API_URL not configured", 0);
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const t = tokenStore.get();
  if (t) headers.set("Authorization", `Bearer ${t}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(body?.code ?? "INTERNAL", body?.message ?? res.statusText, res.status, body?.details);
  }
  return body as T;
}

// Try the network first; fall back to local adapter on any failure when in local mode.
async function safe<T>(networkFn: () => Promise<T>, localFn: () => T): Promise<T> {
  if (isLocalMode()) return localFn();
  try { return await networkFn(); }
  catch (e) {
    console.warn("[api] network failed, falling back to local adapter:", (e as Error).message);
    return localFn();
  }
}

export const api = {
  apiUrl: API_URL || "(local mode)",
  isLocalMode,

  health: () => request<{ ok: true; ts: string }>("/api/health"),

  signup: (b: { email: string; password: string; name: string; role?: string }) =>
    request<{ ok: true; userId: string }>("/api/auth/signup", { method: "POST", body: JSON.stringify(b) }),

  login: async (email: string, password: string) => {
    const r = await request<{ token: string; user: unknown }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    tokenStore.set(r.token);
    return r;
  },

  logout: async () => {
    await request("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    tokenStore.clear();
  },

  command: <R = unknown>(cmd: { _id: string; type: string; payload: Record<string, unknown> } & Record<string, unknown>) =>
    safe<R>(
      () => request<R>("/api/commands", {
        method: "POST",
        headers: { "Idempotency-Key": cmd._id },
        body: JSON.stringify(cmd),
      }),
      () => localAdapter.command(cmd) as unknown as R,
    ),

  leads: {
    list: (q: Record<string, string | number> = {}) =>
      safe<{ items: unknown[]; nextCursor: string | null }>(
        () => {
          const qs = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString();
          return request<{ items: unknown[]; nextCursor: string | null }>(`/api/leads${qs ? `?${qs}` : ""}`);
        },
        () => localAdapter.listLeads({ limit: typeof q.limit === "number" ? q.limit : Number(q.limit ?? 100) }),
      ),
    get: (id: string) => request<unknown>(`/api/leads/${id}`),
  },

  todos: {
    list: <T = import("@/contracts").Todo>(q: Record<string, string> = {}) =>
      safe<{ items: T[] }>(
        () => {
          const qs = new URLSearchParams(q).toString();
          return request<{ items: T[] }>(`/api/todos${qs ? `?${qs}` : ""}`);
        },
        () => localAdapter.listTodos(q) as unknown as { items: T[] },
      ),
  },

  activities: {
    list: <T = import("@/contracts").Activity>(q: { entityType: string; entityId: string; kind?: string; limit?: number }) =>
      safe<{ items: T[] }>(
        () => {
          const qs = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString();
          return request<{ items: T[] }>(`/api/activities?${qs}`);
        },
        () => localAdapter.listActivities(q) as unknown as { items: T[] },
      ),
  },

  users: {
    list: () =>
      safe<{ items: { _id: string; name: string; email: string; role: string }[] }>(
        () => request<{ items: { _id: string; name: string; email: string; role: string }[] }>("/api/users"),
        () => localAdapter.listUsers(),
      ),
  },
};
