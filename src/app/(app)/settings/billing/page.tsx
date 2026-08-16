import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UpgradeButton, ManageBillingButton } from "@/components/app/billing-buttons";
import { getDb } from "@/db";
import { getUserById } from "@/db/queries/users";
import { PLANS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const { userId } = await auth();
  const user = await getUserById(getDb(), userId!);
  const isPro = user?.plan === "pro";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 md:gap-6">
      {/* The app bar already reads "Billing" on mobile, so the visible
          heading is desktop-only. Two elements, but only ever one in the
          a11y tree — the other is display:none at that width. */}
      <h1 className="sr-only md:hidden">Billing</h1>
      <h1 className="hidden text-2xl font-bold tracking-tight md:block">Billing</h1>
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan
            <Badge variant={isPro ? "default" : "secondary"}>
              {isPro ? PLANS.pro.name : PLANS.free.name}
            </Badge>
          </CardTitle>
          <CardDescription>
            {isPro && user?.stripeCurrentPeriodEnd
              ? `Renews ${formatDate(user.stripeCurrentPeriodEnd)}`
              : "Upgrade for full history, AI-assisted scoring, and unlimited share cards."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPro ? <ManageBillingButton /> : <UpgradeButton />}
        </CardContent>
      </Card>
    </div>
  );
}
