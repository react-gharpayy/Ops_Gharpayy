// Frontend API client. Reads VITE_API_URL from env. Sends Bearer token from localStorage.
// Server is hosted on YOUR VPS — set VITE_API_URL to e.g. https://api.gharpayy.com

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";

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

export const api = {
  apiUrl: API_URL,
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

  command: <R = unknown>(cmd: { _id: string } & Record<string, unknown>) =>
    request<R>("/api/commands", {
      method: "POST",
      headers: { "Idempotency-Key": cmd._id },
      body: JSON.stringify(cmd),
    }),

  leads: {
    list: (q: Record<string, string | number> = {}) => {
      const qs = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString();
      return request<{ items: unknown[]; nextCursor: string | null }>(`/api/leads${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => request<unknown>(`/api/leads/${id}`),
  },
};
