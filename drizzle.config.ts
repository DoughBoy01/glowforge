import { defineConfig } from "drizzle-kit";

// Migrations are generated here as plain SQL, then applied with
// `wrangler d1 migrations apply` (see package.json db:migrate:* scripts) —
// not `drizzle-kit push`/`migrate`, since the target is D1, not a live
// Postgres/SQLite connection drizzle-kit can talk to directly.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
