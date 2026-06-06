/**
 * GET    /api/communities/[slug]  – public
 * PUT    /api/communities/[slug]  – SUPER_ADMIN or owning COMMUNITY_ADMIN
 * DELETE /api/communities/[slug]  – SUPER_ADMIN only
 */

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requireRole, requireCommunityAccess } from "@/middleware/rbac";
import {
  ok,
  badRequest,
  notFound,
  serverError,
  noContent,
  tooManyRequests,
} from "@/lib/api-response";
import { updateCommunitySchema } from "@/schemas/community";
import { type NextRequest } from "next/server";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rl = await rateLimit(req);
  if (!rl.success) return tooManyRequests();

  const { slug } = await params;

  const community = await prisma.community.findUnique({
    where: { slug },
    include: {
      ambassadors: {
        orderBy: { createdAt: "asc" },
      },
      events: {
        where: { status: "PUBLISHED" },
        orderBy: { eventDate: "desc" },
        take: 5,
        select: {
          id: true, title: true, slug: true, eventDate: true,
          eventType: true, featuredImage: true, location: true, attendance: true,
        },
      },
      posts: {
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 5,
        select: {
          id: true, title: true, slug: true, excerpt: true,
          featuredImage: true, category: true, publishedAt: true,
          author: { select: { name: true, image: true } },
        },
      },
      _count: {
        select: {
          events: { where: { status: "PUBLISHED" } },
          posts: { where: { status: "PUBLISHED" } },
          ambassadors: true,
        },
      },
    },
  });

  if (!community) return notFound("Community");
  return ok(community);
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rl = await rateLimit(req, { limit: 20, windowMs: 60_000 });
  if (!rl.success) return tooManyRequests();

  const { slug } = await params;

  const existing = await prisma.community.findUnique({ where: { slug } });
  if (!existing) return notFound("Community");

  const { error } = await requireCommunityAccess(existing.id);
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = updateCommunitySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.errors[0]?.message ?? "Validation error");
  }

  try {
    const updated = await prisma.community.update({
      where: { slug },
      data: parsed.data,
    });
    return ok(updated);
  } catch (e: any) {
    if (e.code === "P2002") return badRequest("Slug already taken", "SLUG_CONFLICT");
    console.error("[PUT /api/communities/:slug]", e);
    return serverError();
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { error } = await requireRole(["SUPER_ADMIN"]);
  if (error) return error;

  const { slug } = await params;

  const existing = await prisma.community.findUnique({ where: { slug } });
  if (!existing) return notFound("Community");

  try {
    await prisma.community.delete({ where: { slug } });
    return noContent();
  } catch (e) {
    console.error("[DELETE /api/communities/:slug]", e);
    return serverError();
  }
}
