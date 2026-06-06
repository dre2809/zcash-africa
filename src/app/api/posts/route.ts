/**
 * GET  /api/posts  – list published posts (public)
 * POST /api/posts  – create post draft (CONTRIBUTOR+)
 *
 * Query params:
 *   communityId, category, tag, page, pageSize
 */

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requireAuth, requireCommunityAccess, canCreateContent, canPublish } from "@/middleware/rbac";
import {
  ok, created, badRequest, forbidden, serverError, tooManyRequests, parsePagination,
} from "@/lib/api-response";
import { createPostSchema } from "@/schemas/post";
import { BlogCategory, ContentStatus } from "@prisma/client";
import { type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req);
  if (!rl.success) return tooManyRequests();

  const sp = req.nextUrl.searchParams;
  const { page, pageSize, skip } = parsePagination(sp);
  const communityId = sp.get("communityId") ?? undefined;
  const category    = sp.get("category") as BlogCategory | null;
  const tag         = sp.get("tag") ?? undefined;
  const status      = (sp.get("status") as ContentStatus) ?? "PUBLISHED";

  const where = {
    status: status as ContentStatus,
    ...(communityId ? { communityId } : {}),
    ...(category ? { category } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
  };

  const [posts, total] = await prisma.$transaction([
    prisma.blogPost.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { publishedAt: "desc" },
      select: {
        id: true, title: true, slug: true, excerpt: true, featuredImage: true,
        category: true, tags: true, publishedAt: true,
        author: { select: { name: true, image: true } },
        community: { select: { id: true, name: true, slug: true, logo: true } },
      },
    }),
    prisma.blogPost.count({ where }),
  ]);

  return ok(posts, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { limit: 20, windowMs: 60_000 });
  if (!rl.success) return tooManyRequests();

  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  if (!canCreateContent(session!.user.role)) {
    return forbidden("Insufficient role to create posts");
  }

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }

  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? "Validation error");

  const { error: communityError } = await requireCommunityAccess(parsed.data.communityId);
  if (communityError) return communityError;

  try {
    const post = await prisma.blogPost.create({
      data: {
        ...parsed.data,
        tags: parsed.data.tags ?? [],
        authorId: session!.user.id,
        status: "DRAFT",
      },
    });
    return created(post);
  } catch (e: any) {
    if (e.code === "P2002") return badRequest("A post with this slug already exists", "SLUG_CONFLICT");
    console.error("[POST /api/posts]", e);
    return serverError();
  }
}
