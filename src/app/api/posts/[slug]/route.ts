/**
 * GET    /api/posts/[slug]
 * PUT    /api/posts/[slug]
 * DELETE /api/posts/[slug]
 */

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requireAuth, requireCommunityAccess, canPublish } from "@/middleware/rbac";
import {
  ok, badRequest, notFound, forbidden, serverError, noContent, tooManyRequests,
} from "@/lib/api-response";
import { updatePostSchema } from "@/schemas/post";
import { type NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rl = await rateLimit(req);
  if (!rl.success) return tooManyRequests();

  const { slug } = await params;

  const post = await prisma.blogPost.findUnique({
    where: { slug },
    include: {
      author: { select: { name: true, image: true } },
      community: { select: { id: true, name: true, slug: true, logo: true } },
    },
  });

  if (!post || post.status !== "PUBLISHED") return notFound("Post");
  return ok(post);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rl = await rateLimit(req, { limit: 20, windowMs: 60_000 });
  if (!rl.success) return tooManyRequests();

  const { slug } = await params;
  const existing = await prisma.blogPost.findUnique({ where: { slug } });
  if (!existing) return notFound("Post");

  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  // Author can edit their own draft; admins can edit any post
  const isAuthor = existing.authorId === session!.user.id;
  const isAdmin  = ["SUPER_ADMIN", "COMMUNITY_ADMIN"].includes(session!.user.role);

  if (!isAuthor && !isAdmin) return forbidden("You can only edit your own posts");

  if (isAdmin) {
    const { error } = await requireCommunityAccess(existing.communityId);
    if (error) return error;
  }

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }

  const parsed = updatePostSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? "Validation error");

  if (parsed.data.status === "PUBLISHED" && !canPublish(session!.user.role)) {
    return forbidden("Only admins can publish posts");
  }

  const data: any = { ...parsed.data };
  if (parsed.data.status === "PUBLISHED" && !existing.publishedAt) {
    data.publishedAt = new Date();
  }

  try {
    const updated = await prisma.blogPost.update({ where: { slug }, data });
    return ok(updated);
  } catch (e: any) {
    if (e.code === "P2002") return badRequest("Slug already taken", "SLUG_CONFLICT");
    console.error("[PUT /api/posts/:slug]", e);
    return serverError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const existing = await prisma.blogPost.findUnique({ where: { slug } });
  if (!existing) return notFound("Post");

  const { error } = await requireCommunityAccess(existing.communityId);
  if (error) return error;

  try {
    await prisma.blogPost.delete({ where: { slug } });
    return noContent();
  } catch (e) {
    console.error("[DELETE /api/posts/:slug]", e);
    return serverError();
  }
}
