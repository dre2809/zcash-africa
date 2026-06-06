/**
 * GET    /api/events/[slug]  – public
 * PUT    /api/events/[slug]  – COMMUNITY_ADMIN of owning community, SUPER_ADMIN
 * DELETE /api/events/[slug]  – COMMUNITY_ADMIN of owning community, SUPER_ADMIN
 */

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requireCommunityAccess, canPublish } from "@/middleware/rbac";
import { requireAuth } from "@/middleware/rbac";
import {
  ok, badRequest, notFound, forbidden, serverError, noContent, tooManyRequests,
} from "@/lib/api-response";
import { updateEventSchema } from "@/schemas/event";
import { type NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rl = await rateLimit(req);
  if (!rl.success) return tooManyRequests();

  const { slug } = await params;

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      community: { select: { id: true, name: true, slug: true, logo: true } },
      author: { select: { name: true, image: true } },
    },
  });

  if (!event || event.status !== "PUBLISHED") return notFound("Event");
  return ok(event);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rl = await rateLimit(req, { limit: 20, windowMs: 60_000 });
  if (!rl.success) return tooManyRequests();

  const { slug } = await params;
  const existing = await prisma.event.findUnique({ where: { slug } });
  if (!existing) return notFound("Event");

  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: accessError } = await requireCommunityAccess(existing.communityId);
  if (accessError) return accessError;

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }

  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? "Validation error");

  // Only admins can flip status to PUBLISHED
  if (parsed.data.status === "PUBLISHED" && !canPublish(session!.user.role)) {
    return forbidden("Only admins can publish events");
  }

  try {
    const updated = await prisma.event.update({ where: { slug }, data: parsed.data });
    return ok(updated);
  } catch (e: any) {
    if (e.code === "P2002") return badRequest("Slug already taken", "SLUG_CONFLICT");
    console.error("[PUT /api/events/:slug]", e);
    return serverError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const existing = await prisma.event.findUnique({ where: { slug } });
  if (!existing) return notFound("Event");

  const { error } = await requireCommunityAccess(existing.communityId);
  if (error) return error;

  try {
    await prisma.event.delete({ where: { slug } });
    return noContent();
  } catch (e) {
    console.error("[DELETE /api/events/:slug]", e);
    return serverError();
  }
}
