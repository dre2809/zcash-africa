/**
 * POST /api/newsletter  – subscribe to newsletter (public)
 */

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { ok, badRequest, conflict, serverError, tooManyRequests } from "@/lib/api-response";
import { newsletterSubscribeSchema } from "@/schemas/user";
import { type NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (!rl.success) return tooManyRequests();

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }

  const parsed = newsletterSubscribeSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? "Validation error");

  try {
    await prisma.newsletterSubscriber.create({
      data: {
        email: parsed.data.email,
        communityId: parsed.data.communityId ?? null,
      },
    });
    return ok({ message: "Subscribed successfully. Please check your email to confirm." });
  } catch (e: any) {
    if (e.code === "P2002") {
      return conflict("This email is already subscribed.");
    }
    console.error("[POST /api/newsletter]", e);
    return serverError();
  }
}
