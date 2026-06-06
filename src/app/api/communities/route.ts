/**
 * GET  /api/communities  – list all communities (public)
 * POST /api/communities  – create a community (SUPER_ADMIN only)
 */

import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { requireRole } from "@/middleware/rbac";
import {
  ok,
  created,
  badRequest,
  serverError,
  tooManyRequests,
  parsePagination,
} from "@/lib/api-response";
import { createCommunitySchema } from "@/schemas/community";
import { type NextRequest } from "next/server";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req);
  if (!rl.success) return tooManyRequests();

  const { page, pageSize, skip } = parsePagination(req.nextUrl.searchParams);

  const [communities, total] = await prisma.$transaction([
    prisma.community.findMany({
      skip,
      take: pageSize,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        region: true,
        logo: true,
        banner: true,
        website: true,
        telegram: true,
        xAccount: true,
        createdAt: true,
        _count: {
          select: {
            events: { where: { status: "PUBLISHED" } },
            posts: { where: { status: "PUBLISHED" } },
            ambassadors: true,
          },
        },
      },
    }),
    prisma.community.count(),
  ]);

  return ok(
    communities,
    { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    200
  );
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (!rl.success) return tooManyRequests();

  const { session, error } = await requireRole(["SUPER_ADMIN"]);
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = createCommunitySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.errors[0]?.message ?? "Validation error");
  }

  try {
    const community = await prisma.community.create({ data: parsed.data });
    return created(community);
  } catch (e: any) {
    if (e.code === "P2002") {
      return badRequest("A community with this slug already exists", "SLUG_CONFLICT");
    }
    console.error("[POST /api/communities]", e);
    return serverError();
  }
}
