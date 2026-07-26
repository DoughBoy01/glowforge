import { and, eq, asc } from "drizzle-orm";
import type { Database } from "@/db";
import { partnerLinks } from "@/db/schema";

export async function getActivePartnerLinks(db: Database, kind?: "affiliate" | "sponsor") {
  return db.query.partnerLinks.findMany({
    where: kind
      ? and(eq(partnerLinks.isActive, true), eq(partnerLinks.kind, kind))
      : eq(partnerLinks.isActive, true),
    orderBy: [asc(partnerLinks.sortOrder)],
  });
}
