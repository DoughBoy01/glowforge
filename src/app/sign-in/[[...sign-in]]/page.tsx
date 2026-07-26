import { ThemedSignIn } from "@/components/providers/clerk-themed";

export default function SignInPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4 pt-safe pb-safe">
      <ThemedSignIn />
    </div>
  );
}
