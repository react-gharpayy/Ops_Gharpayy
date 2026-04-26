The server is failing for a specific MongoDB index bug, not because of your `.env` now.

Problem:
- `server/src/db/mongo.ts` creates this index on startup:
  ```ts
  db.collection("command_ledger").createIndex({ _id: 1 }, { unique: true })
  ```
- MongoDB automatically creates `_id` as a unique index for every collection.
- Atlas rejects manually creating an `_id` index with `{ unique: true }`, so startup crashes before Fastify begins listening.

Plan:
1. Remove the invalid manual `_id` index creation for `command_ledger`.
2. Keep all useful application indexes intact:
   - leads lookup indexes
   - entity event lookup indexes
   - unique user email index
   - user roles index
   - sessions token and expiry indexes
3. Make the index bootstrap safer so one invalid/non-critical index does not make the whole server impossible to start.
4. Build the server to confirm TypeScript compiles.
5. Give you the exact VPS commands to pull, rebuild, restart PM2, and verify `/api/health`.

Technical detail:
- The `_id` index already exists automatically in MongoDB. The correct fix is to delete only this line:
  ```ts
  db.collection("command_ledger").createIndex({ _id: 1 }, { unique: true }),
  ```
- We do not need to change your `.env` for this error.