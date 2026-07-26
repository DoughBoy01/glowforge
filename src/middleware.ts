import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/check-in(.*)",
  "/routine(.*)",
  // Exact, not "(.*)": the exercise videos are served from public/face-gym/,
  // and matching them here would run an auth check on every mp4 request.
  "/face-gym",
  "/settings(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // Anyone signed in who lands on "/" — home-screen icon, bookmark, the
  // wordmark in the app bar, a shared link — gets their own screen rather
  // than the sales pitch. Handled here rather than in the page so the
  // redirect happens before any of the marketing tree renders.
  if (req.nextUrl.pathname === "/") {
    const { userId } = await auth();
    if (userId) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
