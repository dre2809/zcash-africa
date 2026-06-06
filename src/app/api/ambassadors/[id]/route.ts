/**
 * PUT    /api/ambassadors/[id]
 * DELETE /api/ambassadors/[id]
 */

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requireCommunityAccess } from "@/middleware/rbac";
import {
  ok, badRequest, notFound, serverError, noContent, tooManyRequests,
} from "@/lib/api-response";
import { updateAmbassadorSchema } from "@/schemas/ambassador";
import { type NextRequest } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = await rateLimit(req, { limit: 20, windowMs: 60_000 });
  if (!rl.success) return tooManyRequests();

  const { id } = await params;
  const existing = await prisma.ambassador.findUnique({ where: { id } });
  if (!existing) return notFound("Ambassador");

  const { error } = await requireCommunityAccess(existing.communityId);
  if (error) return error;

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }

  const parsed = updateAmbassadorSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? "Validation error");

  try {
    const updated = await prisma.ambassador.update({ where: { id }, data: parsed.data });
    return ok(updated);
  } catch (e) {
    console.error("[PUT /api/ambassadors/:id]", e);
    return serverError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await prisma.ambassador.findUnique({ where: { id } });
  if (!existing) return notFound("Ambassador");

  const { error } = await requireCommunityAccess(existing.communityId);
  if (error) return error;

  try {
    await prisma.ambassador.delete({ where: { id } });
    return noContent();
  } catch (e) {
    console.error("[DELETE /api/ambassadors/:id]", e);
    return serverError();
  }
}
