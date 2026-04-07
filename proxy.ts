import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/api/lanes(.*)",
  "/api/briefs(.*)",
  "/api/user(.*)",
  "/affiliates/dashboard(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  const res = NextResponse.next();

  // Capture affiliate ref code on first visit — set 90-day cookie
  const ref = req.nextUrl.searchParams.get("ref");
  if (ref && /^[a-zA-Z0-9_-]{3,32}$/.test(ref)) {
    const existing = req.cookies.get("lb_ref")?.value;
    if (!existing) {
      res.cookies.set("lb_ref", ref.toLowerCase(), {
        maxAge: 60 * 60 * 24 * 90, // 90 days
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: false,
      });
    }
  }

  return res;
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
