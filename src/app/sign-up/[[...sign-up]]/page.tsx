import { Suspense } from "react";
import { ThemedSignUp } from "@/components/providers/clerk-themed";
import { ReferralCapture } from "./referral-capture";

export default function SignUpPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4 pt-safe pb-safe">
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <ThemedSignUp />
    </div>
  );
}
