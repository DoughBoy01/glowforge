import Link from "next/link";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyLinkButton } from "@/components/app/copy-link-button";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { ThemedUserButton } from "@/components/providers/clerk-themed";
import { getDb } from "@/db";
import { getUserById } from "@/db/queries/users";
import { APP_NAME, APP_URL } from "@/lib/constants";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { userId } = await auth();
  const user = await getUserById(getDb(), userId!);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 md:gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {/* The app chrome no longer advertises who's signed in, so this is
          where the account lives — profile, email, and sign-out, one tap
          from the "You" tab. */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your profile, email, and sign-out.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemedUserButton showName />
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Follows your device by default, so {APP_NAME} switches with everything else.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Referral link</CardTitle>
          <CardDescription>
            Share your link — anyone who signs up through it is tied back to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CopyLinkButton value={`${APP_URL}/sign-up?ref=${user?.referralCode ?? ""}`} />
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>Manage your plan and payment method.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            render={<Link href="/settings/billing">Go to billing</Link>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
