import { MongoClient, type Db, type Collection, type Document } from "mongodb";
import { env } from "../config/env.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(env.MONGO_URL, {
    maxPoolSize: 50,
    serverSelectionTimeoutMS: 8000,
  });
  await client.connect();
  db = client.db(env.MONGO_DB);
  await ensureIndexes(db);
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("Mongo not connected. Call connectMongo() first.");
  return db;
}

export function col<T extends Document = Document>(name: string): Collection<T & { _id?: string }> {
  return getDb().collection<T & { _id?: string }>(name);
}

async function ensureIndexes(db: Db) {
  // NOTE: do NOT manually create an index on `_id` — MongoDB creates a
  // unique `_id` index automatically and rejects any attempt to redefine it.
  const tasks: Array<{ name: string; run: () => Promise<unknown> }> = [
    {
      name: "leads",
      run: () =>
        db.collection("leads").createIndexes([
          { key: { tenantId: 1, createdAt: -1 } },
          { key: { tenantId: 1, phone: 1 }, unique: false },
          { key: { tenantId: 1, assignedTcmId: 1 } },
          { key: { tenantId: 1, stage: 1 } },
          { key: { tenantId: 1, zoneId: 1, stage: 1 } },
        ]),
    },
    {
      name: "entity_event",
      run: () =>
        db.collection("entity_event").createIndexes([
          { key: { tenantId: 1, occurredAt: -1 } },
          { key: { correlationId: 1 } },
          { key: { type: 1 } },
        ]),
    },
    { name: "users.email", run: () => db.collection("users").createIndex({ email: 1 }, { unique: true }) },
    { name: "user_roles.userId", run: () => db.collection("user_roles").createIndex({ userId: 1 }) },
    { name: "sessions.token", run: () => db.collection("sessions").createIndex({ token: 1 }, { unique: true }) },
    {
      name: "sessions.expiresAt",
      run: () => db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    },
  ];

  // Run sequentially with isolation: a single bad index must NOT prevent boot.
  for (const t of tasks) {
    try {
      await t.run();
    } catch (err) {
      console.warn(`[mongo] index '${t.name}' skipped:`, (err as Error).message);
    }
  }
}

export async function disconnectMongo() {
  await client?.close();
  client = null;
  db = null;
}
