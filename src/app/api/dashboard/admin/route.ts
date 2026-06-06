/**
 * GET /api/dashboard/admin
 *
 * Returns platform-wide statistics for the Super Admin dashboard.
 * Requires SUPER_ADMIN role.
 *
 * Response shape:
 * {
 *   totals: { communities, events, posts, ambassadors, users },
 *   monthly: { events, posts },   // last 6 months
 *   recentActivity: { posts[], events[] }
 * }
 */

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/middleware/rbac";
import { ok, serverError } from "@/lib/api-response";
import { type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(["SUPER_ADMIN"]);
  if (error) return error;

  try {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [
      totalCommunities,
      totalEvents,
      totalPosts,
      totalAmbassadors,
      totalUsers,
      recentPosts,
      recentEvents,
      pendingPosts,
      pendingEvents,
    ] = await Promise.all([
      prisma.community.count(),
      prisma.event.count({ where: { status: "PUBLISHED" } }),
      prisma.blogPost.count({ where: { status: "PUBLISHED" } }),
      prisma.ambassador.count(),
      prisma.user.count(),

      // Recent published content
      prisma.blogPost.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 5,
        select: {
          id: true, title: true, slug: true, publishedAt: true,
          author: { select: { name: true } },
          community: { select: { name: true } },
        },
      }),
      prisma.event.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { eventDate: "desc" },
        take: 5,
        select: {
          id: true, title: true, slug: true, eventDate: true,
          community: { select: { name: true } },
        },
      }),

      // Pending approval queue
      prisma.blogPost.count({ where: { status: "PENDING" } }),
      prisma.event.count({ where: { status: "PENDING" } }),
    ]);

    // ── Monthly growth (last 6 months) ──────────────────────────────────────
    // Build an array of { year, month, count } for events and posts
    const monthlyPostsRaw = await prisma.$queryRaw<
      { year: number; month: number; count: bigint }[]
    >`
      SELECT
        EXTRACT(YEAR  FROM "publishedAt")::int AS year,
        EXTRACT(MONTH FROM "publishedAt")::int AS month,
        COUNT(*)::bigint                        AS count
      FROM "BlogPost"
      WHERE status = 'PUBLISHED'
        AND "publishedAt" >= ${sixMonthsAgo}
      GROUP BY year, month
      ORDER BY year, month
    `;

    const monthlyEventsRaw = await prisma.$queryRaw<
      { year: number; month: number; count: bigint }[]
    >`
      SELECT
        EXTRACT(YEAR  FROM "eventDate")::int AS year,
        EXTRACT(MONTH FROM "eventDate")::int AS month,
        COUNT(*)::bigint                     AS count
      FROM "Event"
      WHERE status = 'PUBLISHED'
        AND "eventDate" >= ${sixMonthsAgo}
      GROUP BY year, month
      ORDER BY year, month
    `;

    const toMonthlyArray = (
      rows: { year: number; month: number; count: bigint }[]
    ) =>
      rows.map((r) => ({
        year: r.year,
        month: r.month,
        count: Number(r.count),
      }));

    return ok({
      totals: {
        communities: totalCommunities,
        events: totalEvents,
        posts: totalPosts,
        ambassadors: totalAmbassadors,
        users: totalUsers,
      },
      pending: {
        posts: pendingPosts,
        events: pendingEvents,
      },
      monthly: {
        posts: toMonthlyArray(monthlyPostsRaw),
        events: toMonthlyArray(monthlyEventsRaw),
      },
      recentActivity: {
        posts: recentPosts,
        events: recentEvents,
      },
    });
  } catch (e) {
    console.error("[GET /api/dashboard/admin]", e);
    return serverError();
  }
}
