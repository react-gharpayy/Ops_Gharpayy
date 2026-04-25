import { z } from "zod";

// 4 top-level roles + sub-roles (per locked memory).
export const TopRole = z.enum(["admin", "sales", "ops", "owner"]);
export type TopRole = z.infer<typeof TopRole>;

export const SubRole = z.enum([
  "flow-ops",
  "tcm",
  "hr",
  "manager",
  "property-owner",
  "agent",
]);
export type SubRole = z.infer<typeof SubRole>;

// RBAC scopes — checked server-side, used to hide UI client-side.
export const Scope = z.enum([
  "lead.read",
  "lead.create",
  "lead.update",
  "lead.assign",
  "lead.claim",
  "tour.read",
  "tour.schedule",
  "tour.complete",
  "inventory.read",
  "inventory.block",
  "automation.admin",
  "user.admin",
  "todo.read",
  "todo.create",
  "todo.update",
  "todo.assign",
  "activity.read",
  "activity.log",
  "activity.delete",
]);
export type Scope = z.infer<typeof Scope>;

// Default scope grants per top-role. Server is authoritative; this matches it.
export const DEFAULT_SCOPES: Record<TopRole, Scope[]> = {
  admin: Scope.options,
  sales: ["lead.read", "lead.create", "lead.update", "lead.claim", "tour.read", "tour.schedule", "tour.complete", "inventory.read", "todo.read", "todo.create", "todo.update", "todo.assign", "activity.read", "activity.log"],
  ops: ["lead.read", "lead.assign", "tour.read", "inventory.read", "inventory.block", "todo.read", "todo.create", "todo.update", "todo.assign", "activity.read", "activity.log"],
  owner: ["inventory.read", "todo.read", "todo.create", "todo.update", "activity.read"],
};
