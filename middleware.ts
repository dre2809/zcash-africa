/**
 * Next.js Edge Middleware
 *
 * Responsibilities:
 *  1. Protect /dashboard/* routes – redirect unauthenticated visitors to sign-in.
 *  2. Protect /api/admin/* routes – reject non-admin requests at the edge.
 *  3. Add security headers to all responses.
 *
 * CSRF protection: Next.js App Router same-origin cookie behaviour plus the
 * custom `x-csrf-token` header check in route handlers provides CSRF protection
 * without a separate library.  The header is validated in mutating routes.
 */

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    // Match all paths except static files and _next internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export default auth(async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = (req as any).auth; // injected by NextAuth's auth() wrapper

  // ── Security headers ────────────────────────────────────────────────────────
  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://res.cloudinary.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://res.cloudinary.com https://avatars.githubusercontent.com https://lh3.googleusercontent.com",
      "font-src 'self'",
      "connect-src 'self' https://api.cloudinary.com",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  // ── Dashboard protection ────────────────────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      const signInUrl = new URL("/auth/signin", req.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // ── Admin-only API routes ───────────────────────────────────────────────────
  if (pathname.startsWith("/api/admin")) {
    if (!session || session.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
  }

  return response;
});
