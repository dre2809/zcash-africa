/**
 * GET  /api/media  – list media for a community (COMMUNITY_ADMIN+)
 * POST /api/media  – upload an image to Cloudinary + store in DB
 *
 * Max payload size: enforced via next.config.ts bodyParser limit (5 MB)
 */

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requireCommunityAccess } from "@/middleware/rbac";
import { uploadImage } from "@/lib/cloudinary";
import {
  ok, created, badRequest, serverError, tooManyRequests, parsePagination,
} from "@/lib/api-response";
import { uploadMediaSchema } from "@/schemas/media";
import { type NextRequest } from "next/server";

const MAX_BASE64_BYTES = 5 * 1024 * 1024 * 1.37; // ~6.85 MB (base64 overhead)

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req);
  if (!rl.success) return tooManyRequests();

  const sp = req.nextUrl.searchParams;
  const communityId = sp.get("communityId");
  if (!communityId) return badRequest("communityId is required");

  const { error } = await requireCommunityAccess(communityId);
  if (error) return error;

  const { page, pageSize, skip } = parsePagination(sp);

  const [media, total] = await prisma.$transaction([
    prisma.media.findMany({
      where: { communityId },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.media.count({ where: { communityId } }),
  ]);

  return ok(media, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (!rl.success) return tooManyRequests();

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }

  const parsed = uploadMediaSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? "Validation error");

  if (parsed.data.imageData.length > MAX_BASE64_BYTES) {
    return badRequest("Image exceeds the 5 MB size limit");
  }

  const { session, error: accessError } = await requireCommunityAccess(parsed.data.communityId) as any;
  if (accessError) return accessError;

  try {
    const upload = await uploadImage(
      parsed.data.imageData,
      parsed.data.communityId
    );

    const media = await prisma.media.create({
      data: {
        title: parsed.data.title,
        altText: parsed.data.altText,
        imageUrl: upload.secureUrl,
        cloudinaryId: upload.publicId,
        communityId: parsed.data.communityId,
        uploadedById: session?.user?.id ?? null,
      },
    });

    return created(media);
  } catch (e) {
    console.error("[POST /api/media]", e);
    return serverError("Upload failed. Please try again.");
  }
}
