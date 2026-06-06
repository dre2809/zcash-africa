/**
 * GET  /api/events  – list published events (public), with filtering
 * POST /api/events  – create event (COMMUNITY_ADMIN, SUPER_ADMIN)
 *
 * Query params:
 *   communityId, status, eventType, page, pageSize
 */

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requireCommunityAccess, canCreateContent } from "@/middleware/rbac";
import { requireAuth } from "@/middleware/rbac";
import {
  ok, created, badRequest, forbidden, serverError, tooManyRequests, parsePagination,
} from "@/lib/api-response";
import { createEventSchema } from "@/schemas/event";
import { ContentStatus, EventType } from "@prisma/client";
import { type NextRequest } from "next/server";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req);
  if (!rl.success) return tooManyRequests();

  const sp = req.nextUrl.searchParams;
  const { page, pageSize, skip } = parsePagination(sp);

  const communityId = sp.get("communityId") ?? undefined;
  const eventType   = sp.get("eventType") as EventType | null;
  const status      = (sp.get("status") as ContentStatus) ?? "PUBLISHED";

  const where = {
    status: status as ContentStatus,
    ...(communityId ? { communityId } : {}),
    ...(eventType ? { eventType } : {}),
  };

  const [events, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { eventDate: "desc" },
      select: {
        id: true, title: true, slug: true, eventDate: true, location: true,
        eventType: true, featuredImage: true, attendance: true, status: true,
        community: { select: { id: true, name: true, slug: true, logo: true } },
      },
    }),
    prisma.event.count({ where }),
  ]);

  return ok(events, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { limit: 20, windowMs: 60_000 });
  if (!rl.success) return tooManyRequests();

  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  if (!canCreateContent(session!.user.role)) {
    return forbidden("Insufficient role to create events");
  }

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }

  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? "Validation error");

  const { error: communityError } = await requireCommunityAccess(parsed.data.communityId);
  if (communityError) return communityError;

  try {
    const event = await prisma.event.create({
      data: {
        ...parsed.data,
        gallery: parsed.data.gallery ?? [],
        authorId: session!.user.id,
        // Contributors submit as PENDING; admins can publish directly
        status: ["SUPER_ADMIN", "COMMUNITY_ADMIN"].includes(session!.user.role)
          ? "PENDING"
          : "DRAFT",
      },
    });
    return created(event);
  } catch (e: any) {
    if (e.code === "P2002") return badRequest("An event with this slug already exists", "SLUG_CONFLICT");
    console.error("[POST /api/events]", e);
    return serverError();
  }
}
