/**
 * GET  /api/ambassadors  – list ambassadors (public)
 * POST /api/ambassadors  – create ambassador (COMMUNITY_ADMIN+)
 *
 * Query params: communityId, page, pageSize
 */

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requireCommunityAccess } from "@/middleware/rbac";
import {
  ok, created, badRequest, serverError, tooManyRequests, parsePagination,
} from "@/lib/api-response";
import { createAmbassadorSchema } from "@/schemas/ambassador";
import { type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req);
  if (!rl.success) return tooManyRequests();

  const sp = req.nextUrl.searchParams;
  const { page, pageSize, skip } = parsePagination(sp);
  const communityId = sp.get("communityId") ?? undefined;

  const where = communityId ? { communityId } : {};

  const [ambassadors, total] = await prisma.$transaction([
    prisma.ambassador.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "asc" },
      include: {
        community: { select: { id: true, name: true, slug: true, logo: true } },
      },
    }),
    prisma.ambassador.count({ where }),
  ]);

  return ok(ambassadors, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { limit: 20, windowMs: 60_000 });
  if (!rl.success) return tooManyRequests();

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }

  const parsed = createAmbassadorSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? "Validation error");

  const { error } = await requireCommunityAccess(parsed.data.communityId);
  if (error) return error;

  try {
    const ambassador = await prisma.ambassador.create({ data: parsed.data });
    return created(ambassador);
  } catch (e) {
    console.error("[POST /api/ambassadors]", e);
    return serverError();
  }
}
