import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { getDb } from "@/db";
import { webhookEvents } from "@/db/schema";
import { setUserSubscription } from "@/db/queries/users";
import { getStripe } from "@/lib/stripe";
import { captureServerEvent } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

function planForStatus(status: Stripe.Subscription.Status): "free" | "pro" {
  return status === "active" || status === "trialing" ? "pro" : "free";
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const db = getDb();
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const item = subscription.items.data[0];
  const plan = planForStatus(subscription.status);

  const updated = await setUserSubscription(db, customerId, {
    plan,
    stripeSubscriptionId: subscription.id,
    stripePriceId: item?.price.id ?? null,
    stripeCurrentPeriodEnd: item
      ? new Date(item.current_period_end * 1000)
      : null,
  });

  if (updated) {
    captureServerEvent({
      distinctId: updated.id,
      event:
        plan === "pro"
          ? ANALYTICS_EVENTS.SUBSCRIPTION_ACTIVATED
          : ANALYTICS_EVENTS.SUBSCRIPTION_CANCELED,
      properties: { priceId: item?.price.id, status: subscription.status },
    });
  }
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  const body = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const db = getDb();
  const alreadyProcessed = await db.query.webhookEvents.findFirst({
    where: eq(webhookEvents.id, event.id),
  });
  if (alreadyProcessed) return new Response("OK (duplicate)", { status: 200 });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(subscription);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object);
      break;
    }
    default:
      break;
  }

  await db.insert(webhookEvents).values({
    id: event.id,
    source: "stripe",
    type: event.type,
  });

  return new Response("OK", { status: 200 });
}
