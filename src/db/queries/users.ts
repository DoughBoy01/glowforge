import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import { users } from "@/db/schema";
import { generateReferralCode } from "@/lib/referral";
import { DEV_USER_ID, DEV_USER_EMAIL, isAuthBypassEnabled } from "@/lib/auth";
import type { User as ClerkUser, UserJSON } from "@clerk/nextjs/server";

type NormalizedClerkUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
};

/** SDK shape (camelCase) — e.g. from `clerkClient().users.getUser()`. */
function normalizeFromSdkUser(user: ClerkUser): NormalizedClerkUser {
  const primary = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId,
  );
  return {
    id: user.id,
    email: primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "",
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
  };
}

/** Webhook payload shape (snake_case) — e.g. from `verifyWebhook()`. */
function normalizeFromWebhookUser(data: UserJSON): NormalizedClerkUser {
  const primary = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id,
  );
  return {
    id: data.id,
    email: primary?.email_address ?? data.email_addresses[0]?.email_address ?? "",
    firstName: data.first_name,
    lastName: data.last_name,
    imageUrl: data.image_url,
  };
}

export async function getUserById(db: Database, id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

export async function getUserByStripeCustomerId(db: Database, stripeCustomerId: string) {
  return db.query.users.findFirst({
    where: eq(users.stripeCustomerId, stripeCustomerId),
  });
}

async function upsertUser(
  db: Database,
  normalized: NormalizedClerkUser,
  referredByCode?: string | null,
) {
  const existing = await getUserById(db, normalized.id);

  if (existing) {
    const [updated] = await db
      .update(users)
      .set(normalized)
      .where(eq(users.id, normalized.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({
      ...normalized,
      referralCode: generateReferralCode(),
      referredByCode: referredByCode ?? null,
    })
    .returning();
  return created;
}

export function upsertUserFromWebhook(
  db: Database,
  data: UserJSON,
  referredByCode?: string | null,
) {
  return upsertUser(db, normalizeFromWebhookUser(data), referredByCode);
}

export function upsertUserFromSdk(db: Database, user: ClerkUser) {
  return upsertUser(db, normalizeFromSdkUser(user));
}

export async function deleteUser(db: Database, id: string) {
  await db.delete(users).where(eq(users.id, id));
}

/** Idempotent: only writes if the user doesn't already have a referrer and
 * isn't self-referring. Safe to call on every request. */
export async function applyReferralIfNeeded(
  db: Database,
  userId: string,
  referralCode: string,
) {
  const user = await getUserById(db, userId);
  if (!user || user.referredByCode || user.referralCode === referralCode) {
    return null;
  }

  const [updated] = await db
    .update(users)
    .set({ referredByCode: referralCode })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

export async function setUserSubscription(
  db: Database,
  stripeCustomerId: string,
  fields: {
    plan: "free" | "pro";
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    stripeCurrentPeriodEnd: Date | null;
  },
) {
  const [updated] = await db
    .update(users)
    .set(fields)
    .where(eq(users.stripeCustomerId, stripeCustomerId))
    .returning();
  return updated;
}

/**
 * Fallback path for the (rare) case a request lands before the Clerk
 * webhook has synced the user row — e.g. immediately after sign-up.
 * Prefer `getUserById` + the webhook as the source of truth; only call this
 * where a missing row would otherwise break the request.
 */
export async function getOrSyncUser(db: Database, clerkUserId: string) {
  const existing = await getUserById(db, clerkUserId);
  if (existing) return existing;

  // Dev auth bypass: the fake user has no Clerk row, so create the D1 row
  // directly instead of calling the Clerk API for a user that doesn't exist.
  // onConflictDoNothing keeps this safe when two requests race to create it.
  if (isAuthBypassEnabled && clerkUserId === DEV_USER_ID) {
    await db
      .insert(users)
      .values({
        id: DEV_USER_ID,
        email: DEV_USER_EMAIL,
        firstName: "Dev",
        lastName: "User",
        imageUrl: null,
        referralCode: generateReferralCode(),
        referredByCode: null,
      })
      .onConflictDoNothing();
    return getUserById(db, clerkUserId);
  }

  const { clerkClient } = await import("@clerk/nextjs/server");
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkUserId);
  return upsertUserFromSdk(db, clerkUser);
}
