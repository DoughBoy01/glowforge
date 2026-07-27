import { FACE_AGE_LABEL } from "@/lib/face-age";
import { CheckInForm } from "./check-in-form";

export const metadata = { title: "Check-in" };

export default function CheckInPage() {
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
