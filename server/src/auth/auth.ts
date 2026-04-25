import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";
import { col } from "../db/mongo.js";
import { ulid } from "../../../src/contracts/ids.js";
import { DEFAULT_SCOPES, type TopRole, type SubRole, type Scope } from "../../../src/contracts/roles.js";

const secret = new TextEncoder().encode(env.JWT_SECRET);

interface UserDoc {
  _id: string;
  email: string;
  passwordHash: string;
  name: string;
  tenantId: string;
  createdAt: string;
}

interface UserRoleDoc {
  _id: string;
  userId: string;
  role: TopRole;
  subRole: SubRole | null;
  zoneId: string | null;
  tenantId: string;
}

export interface JwtClaims {
  sub: string;
  email: string;
  role: TopRole;
  subRole: SubRole | null;
  zoneId: string | null;
  tenantId: string;
  scopes: Scope[];
}

export async function signAccessToken(claims: JwtClaims): Promise<string> {
  return new SignJWT(claims as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtClaims> {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as JwtClaims;
}

export async function signupUser(opts: { email: string; password: string; name: string; role?: TopRole; subRole?: SubRole | null; zoneId?: string | null }) {
  const email = opts.email.trim().toLowerCase();
  const exists = await col<UserDoc>("users").findOne({ email });
  if (exists) throw Object.assign(new Error("Email already registered"), { code: "CONFLICT" });

  const userId = ulid();
  const passwordHash = await argon2.hash(opts.password);
  const now = new Date().toISOString();
  const role: TopRole = opts.role ?? "sales";

  await col<UserDoc>("users").insertOne({
    _id: userId,
    email,
    passwordHash,
    name: opts.name,
    tenantId: env.DEFAULT_TENANT,
    createdAt: now,
  });

  await col<UserRoleDoc>("user_roles").insertOne({
    _id: ulid(),
    userId,
    role,
    subRole: opts.subRole ?? null,
    zoneId: opts.zoneId ?? null,
    tenantId: env.DEFAULT_TENANT,
  });

  return { userId, email, role };
}

export async function loginUser(email: string, password: string): Promise<JwtClaims> {
  const user = await col<UserDoc>("users").findOne({ email: email.trim().toLowerCase() });
  if (!user) throw Object.assign(new Error("Invalid credentials"), { code: "UNAUTHENTICATED" });
  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) throw Object.assign(new Error("Invalid credentials"), { code: "UNAUTHENTICATED" });

  const role = await col<UserRoleDoc>("user_roles").findOne({ userId: user._id });
  if (!role) throw Object.assign(new Error("User has no role"), { code: "FORBIDDEN" });

  return {
    sub: user._id,
    email: user.email,
    role: role.role,
    subRole: role.subRole,
    zoneId: role.zoneId,
    tenantId: user.tenantId,
    scopes: DEFAULT_SCOPES[role.role],
  };
}
