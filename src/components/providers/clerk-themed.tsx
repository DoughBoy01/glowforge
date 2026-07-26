"use client";

import { useTheme } from "next-themes";
import { SignIn, SignUp, UserButton } from "@clerk/nextjs";
import { clerkAppearanceDark, clerkAppearanceLight } from "@/lib/clerk-appearance";

/**
 * Clerk resolves `appearance` once, at the provider. The root layout is a
 * server component and can't read the resolved theme, so each Clerk surface
 * we actually render takes its appearance from here instead — that's what
 * lets Clerk's UI follow the system light/dark preference along with the
 * rest of the app.
 */
function useClerkAppearance() {
  const { resolvedTheme } = useTheme();
  // Before hydration `resolvedTheme` is undefined; dark is the house style,
  // so that's the safer first paint.
  return resolvedTheme === "light" ? clerkAppearanceLight : clerkAppearanceDark;
}

export function ThemedUserButton(props: React.ComponentProps<typeof UserButton>) {
  return <UserButton appearance={useClerkAppearance()} {...props} />;
}

export function ThemedSignIn(props: React.ComponentProps<typeof SignIn>) {
  return <SignIn appearance={useClerkAppearance()} {...props} />;
}

export function ThemedSignUp(props: React.ComponentProps<typeof SignUp>) {
  return <SignUp appearance={useClerkAppearance()} {...props} />;
}
