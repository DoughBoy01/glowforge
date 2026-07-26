import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

/**
 * Server-only. Call inside route handlers, server actions, or server
 * components — never in client components. Cloudflare bindings are only
 * reachable through `getCloudflareContext()`, which requires the request
 * context OpenNext sets up per-request.
 */
export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

export type Database = ReturnType<typeof getDb>;
export * from "./schema";
