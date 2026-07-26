import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getOrSyncUser } from "@/db/queries/users";
import { getStripe } from "@/lib/stripe";
import { APP_URL, PLANS } from "@/lib/constants";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const db = getDb();
  const user = await getOrSyncUser(db, userId);
  if (!user) return new Response("User not found", { status: 404 });

  const stripe = getStripe();

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { clerkUserId: user.id },
    });
    customerId = customer.id;
    await db
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(eq(users.id, user.id));
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: PLANS.pro.stripePriceId, quantity: 1 }],
    success_url: `${APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${APP_URL}/settings/billing`,
    subscription_data: {
      metadata: { clerkUserId: user.id },
    },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return new Response("Failed to create checkout session", { status: 500 });
  }

  return Response.json({ url: session.url });
}
