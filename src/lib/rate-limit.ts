/**
 * In-memory rate limiter for Next.js Route Handlers.
 *
 * For production at scale, replace this with an Upstash Redis-backed
 * implementation (e.g. @upstash/ratelimit) so limits are shared across
 * all Vercel edge/serverless instances.
 *
 * Usage:
 *   const result = await rateLimit(request, { limit: 30, windowMs: 60_000 })
 *   if (!result.success) return new Response("Too Many Requests", { status: 429 })
 */

interface RateLimitOptions {
  /** Max requests allowed within the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number; // Unix timestamp (ms) when the window resets
}

// Simple in-memory store: Map<ip, { count, resetAt }>
const store = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(
  request: Request,
  options: RateLimitOptions = { limit: 60, windowMs: 60_000 }
): Promise<RateLimitResult> {
  // Prefer the real IP forwarded by Vercel/CDN
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous";

  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    // Fresh window
    store.set(ip, { count: 1, resetAt: now + options.windowMs });
    return { success: true, remaining: options.limit - 1, reset: now + options.windowMs };
  }

  if (entry.count >= options.limit) {
    return { success: false, remaining: 0, reset: entry.resetAt };
  }

  entry.count += 1;
  return {
    success: true,
    remaining: options.limit - entry.count,
    reset: entry.resetAt,
  };
}

/** Convenience: build rate-limit response headers */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  };
}
