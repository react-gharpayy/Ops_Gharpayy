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

export function col<T extends Document = Document>(name: string): Collection<T & { _id: string }> {
  return getDb().collection<T & { _id: string }>(name);
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("leads").createIndexes([
      { key: { tenantId: 1, createdAt: -1 } },
      { key: { tenantId: 1, phone: 1 }, unique: false },
      { key: { tenantId: 1, assignedTcmId: 1 } },
      { key: { tenantId: 1, stage: 1 } },
      { key: { tenantId: 1, zoneId: 1, stage: 1 } },
    ]),
    db.collection("entity_event").createIndexes([
      { key: { tenantId: 1, occurredAt: -1 } },
      { key: { correlationId: 1 } },
      { key: { type: 1 } },
    ]),
    db.collection("command_ledger").createIndex({ _id: 1 }, { unique: true }),
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("user_roles").createIndex({ userId: 1 }),
    db.collection("sessions").createIndex({ token: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}

export async function disconnectMongo() {
  await client?.close();
  client = null;
  db = null;
}
