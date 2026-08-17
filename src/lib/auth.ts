import { auth as clerkAuth } from "@clerk/nextjs/server";

/**
 * Dev-only auth bypass. With `AUTH_BYPASS=1` in `.env.local`, every
 * `await auth()` in the app resolves to a fixed dev user instead of the
 * signed-in Clerk session, so the whole authenticated app is reachable in
 * `next dev` without creating an account or signing in. Returns the same
 * `{ userId }` shape as Clerk's `auth()`, so call sites don't change.
 *
 * Never active in production — the flag is only honored when
 * `NODE_ENV !== "production"`.
 */
export const DEV_USER_ID = "user_dev_bypass";
export const DEV_USER_EMAIL = "dev@suhoja.local";

export const isAuthBypassEnabled =
  process.env.NODE_ENV !== "production" && process.env.AUTH_BYPASS === "1";

export async function auth() {
  if (isAuthBypassEnabled) {
    return { userId: DEV_USER_ID };
  }
  return clerkAuth();
}