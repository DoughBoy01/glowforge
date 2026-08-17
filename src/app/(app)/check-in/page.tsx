import Link from "next/link";
import { auth } from "@/lib/auth";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { getLatestScan } from "@/db/queries/scans";
import { FACE_AGE_LABEL } from "@/lib/face-age";
import { getCheckInEligibility } from "@/lib/home";
import { formatDate } from "@/lib/format";
import { CheckInForm } from "./check-in-form";

export const metadata = { title: "Check-in" };

export default async function CheckInPage() {
  const { userId } = await auth();
  const db = getDb();
  const latestScan = await getLatestScan(db, userId!);
  const eligibility = getCheckInEligibility({
    lastScanAt: latestScan?.capturedAt ?? null,
    lastScanFailed: latestScan?.analysis?.status === "failed",
  });

  if (!eligibility.eligible) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-24 text-center">
        <Clock className="size-8 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Not due yet</h1>
        <p className="text-sm text-muted-foreground">
          Scans run once every 28 days, so the reading has time to reflect real change instead of
          lighting or a bad night&apos;s sleep. Your next one opens up on{" "}
          {formatDate(eligibility.nextEligibleAt!)}
          {" "}
          ({eligibility.daysRemaining} day{eligibility.daysRemaining === 1 ? "" : "s"} left).
        </p>
        <Button render={<Link href="/">Back to today</Link>} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex flex-col gap-1 md:mb-6">
        <h1 className="text-2xl font-bold tracking-tight">New check-in</h1>
        {/* Names the output. This is the only screen in the app that writes a
            new face age, and a user who doesn't know that reads the whole thing
            as admin. */}
        <p className="text-sm text-muted-foreground">
          The one thing that re-measures your {FACE_AGE_LABEL.toLowerCase()}.
        </p>
      </div>
      <CheckInForm />
    </div>
  );
}
