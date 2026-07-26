import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { getUserById } from "@/db/queries/users";
import { getStripe } from "@/lib/stripe";
import { APP_URL } from "@/lib/constants";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const db = getDb();
  const user = await getUserById(db, userId);
  if (!user?.stripeCustomerId) {
    return new Response("No billing account yet", { status: 400 });
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${APP_URL}/settings/billing`,
  });

  return Response.json({ url: session.url });
}
