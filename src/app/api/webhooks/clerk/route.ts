import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { webhookEvents } from "@/db/schema";
import { deleteUser, upsertUserFromWebhook } from "@/db/queries/users";

export async function POST(req: NextRequest) {
  // Svix's own delivery id — stable across retries of the same event,
  // unlike anything we'd derive from the payload.
  const svixId = req.headers.get("svix-id");

  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const db = getDb();
  const eventId = svixId ?? `clerk_${evt.type}_${evt.data.id}`;

  const alreadyProcessed = await db.query.webhookEvents.findFirst({
    where: eq(webhookEvents.id, eventId),
  });
  if (alreadyProcessed) return new Response("OK (duplicate)", { status: 200 });

  switch (evt.type) {
    case "user.created": {
      const referredByCode =
        typeof evt.data.public_metadata?.referredByCode === "string"
          ? evt.data.public_metadata.referredByCode
          : null;
      await upsertUserFromWebhook(db, evt.data, referredByCode);
      break;
    }
    case "user.updated": {
      await upsertUserFromWebhook(db, evt.data);
      break;
    }
    case "user.deleted": {
      if (evt.data.id) await deleteUser(db, evt.data.id);
      break;
    }
    default:
      break;
  }

  await db.insert(webhookEvents).values({
    id: eventId,
    source: "clerk",
    type: evt.type,
  });

  return new Response("OK", { status: 200 });
}
