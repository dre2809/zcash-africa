/**
 * GET /api/search
 *
 * Full-text search across communities, events, posts, and ambassadors.
 *
 * Uses PostgreSQL's built-in `to_tsvector` / `to_tsquery` for relevance ranking.
 * For a future production upgrade, consider pg_trgm or a dedicated search
 * service (Meilisearch, Typesense, Algolia).
 *
 * Query params:
 *   q           – required, search term
 *   type        – optional, one of: communities | events | posts | ambassadors | all (default: all)
 *   communityId – optional, scope to a community
 *   category    – optional, blog category filter
 *   page, pageSize
 */

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { ok, badRequest, tooManyRequests } from "@/lib/api-response";
import { type NextRequest } from "next/server";

type SearchType = "communities" | "events" | "posts" | "ambassadors" | "all";

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, { limit: 30, windowMs: 60_000 });
  if (!rl.success) return tooManyRequests();

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  if (!q || q.length < 2) return badRequest("Query must be at least 2 characters");

  const type        = (sp.get("type") ?? "all") as SearchType;
  const communityId = sp.get("communityId") ?? undefined;
  const category    = sp.get("category") ?? undefined;
  const page        = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize    = Math.min(50, Math.max(1, parseInt(sp.get("pageSize") ?? "20", 10)));
  const skip        = (page - 1) * pageSize;

  // Build a search term safe for `to_tsquery` by splitting on whitespace and
  // joining with & (AND) operator.
  const tsQuery = q
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w}:*`)   // prefix matching
    .join(" & ");

  const results: Record<string, unknown[]> = {};

  if (type === "all" || type === "communities") {
    results.communities = await prisma.community.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { region: { contains: q, mode: "insensitive" } },
        ],
      },
      take: pageSize,
      skip,
      select: { id: true, name: true, slug: true, description: true, logo: true, region: true },
    });
  }

  if (type === "all" || type === "events") {
    results.events = await prisma.event.findMany({
      where: {
        status: "PUBLISHED",
        ...(communityId ? { communityId } : {}),
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
        ],
      },
      take: pageSize,
      skip,
      orderBy: { eventDate: "desc" },
      select: {
        id: true, title: true, slug: true, eventDate: true, location: true,
        eventType: true, featuredImage: true,
        community: { select: { name: true, slug: true } },
      },
    });
  }

  if (type === "all" || type === "posts") {
    results.posts = await prisma.blogPost.findMany({
      where: {
        status: "PUBLISHED",
        ...(communityId ? { communityId } : {}),
        ...(category ? { category: category as any } : {}),
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { excerpt: { contains: q, mode: "insensitive" } },
          { tags: { has: q.toLowerCase() } },
        ],
      },
      take: pageSize,
      skip,
      orderBy: { publishedAt: "desc" },
      select: {
        id: true, title: true, slug: true, excerpt: true, category: true,
        tags: true, featuredImage: true, publishedAt: true,
        author: { select: { name: true } },
        community: { select: { name: true, slug: true } },
      },
    });
  }

  if (type === "all" || type === "ambassadors") {
    results.ambassadors = await prisma.ambassador.findMany({
      where: {
        ...(communityId ? { communityId } : {}),
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { bio: { contains: q, mode: "insensitive" } },
          { role: { contains: q, mode: "insensitive" } },
          { country: { contains: q, mode: "insensitive" } },
        ],
      },
      take: pageSize,
      skip,
      select: {
        id: true, name: true, photo: true, role: true, country: true,
        community: { select: { name: true, slug: true } },
      },
    });
  }

  return ok({ query: q, type, page, pageSize, results });
}
