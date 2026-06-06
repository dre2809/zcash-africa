/**
 * GET /api/dashboard/community/[id]
 *
 * Community-scoped dashboard stats.
 * Accessible by: SUPER_ADMIN, COMMUNITY_ADMIN (own community only)
 */

import { prisma } from "@/lib/prisma";
import { requireCommunityAccess } from "@/middleware/rbac";
import { ok, notFound, serverError } from "@/lib/api-response";
import { type NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error } = await requireCommunityAccess(id);
  if (error) return error;

  const community = await prisma.community.findUnique({ where: { id } });
  if (!community) return notFound("Community");

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalEvents,
      totalPosts,
      totalAmbassadors,
      totalMedia,
      recentPosts,
      upcomingEvents,
      recentGallery,
      draftPosts,
      pendingPosts,
    ] = await Promise.all([
      prisma.event.count({ where: { communityId: id, status: "PUBLISHED" } }),
      prisma.blogPost.count({ where: { communityId: id, status: "PUBLISHED" } }),
      prisma.ambassador.count({ where: { communityId: id } }),
      prisma.media.count({ where: { communityId: id } }),

      prisma.blogPost.findMany({
        where: { communityId: id, status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 5,
        select: {
          id: true, title: true, slug: true, excerpt: true,
          featuredImage: true, category: true, publishedAt: true,
          author: { select: { name: true, image: true } },
        },
      }),

      prisma.event.findMany({
        where: {
          communityId: id,
          status: "PUBLISHED",
          eventDate: { gte: now },
        },
        orderBy: { eventDate: "asc" },
        take: 5,
        select: {
          id: true, title: true, slug: true, eventDate: true,
          location: true, eventType: true, featuredImage: true,
        },
      }),

      prisma.media.findMany({
        where: { communityId: id },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true, title: true, imageUrl: true, altText: true, createdAt: true,
        },
      }),

      prisma.blogPost.count({ where: { communityId: id, status: "DRAFT" } }),
      prisma.blogPost.count({ where: { communityId: id, status: "PENDING" } }),
    ]);

    return ok({
      community: {
        id: community.id,
        name: community.name,
        slug: community.slug,
        logo: community.logo,
        region: community.region,
      },
      stats: {
        totalEvents,
        totalPosts,
        totalAmbassadors,
        totalMedia,
        draftPosts,
        pendingPosts,
      },
      recentPosts,
      upcomingEvents,
      recentGallery,
    });
  } catch (e) {
    console.error("[GET /api/dashboard/community/:id]", e);
    return serverError();
  }
}
