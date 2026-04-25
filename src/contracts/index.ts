// Shared contracts — single source of truth for events, commands, and entity shapes.
// Both frontend (this repo) and /server (your VPS Node API) import from here.
//
// Rule: NEVER mutate state outside a command. NEVER emit an event that isn't in the registry.

export * from "./ids";
export * from "./roles";
export * from "./entities";
export * from "./events";
export * from "./commands";
export * from "./errors";
