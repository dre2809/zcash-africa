/**
 * Role-Based Access Control (RBAC) helpers
 *
 * Usage inside a Route Handler:
 *
 *   const { session, error } = await requireRole(request, ["SUPER_ADMIN", "COMMUNITY_ADMIN"])
 *   if (error) return error
 *   // session.user is now typed and role-checked
 *
 * Community scoping:
 *   Use `requireCommunityAccess` when the resource belongs to a community.
 *   SUPER_ADMINs pass unconditionally; COMMUNITY_ADMINs must own the community.
 */

import { auth } from "@/lib/auth";
import { forbidden, unauthorized } from "@/lib/api-response";
import type { UserRole } from "@prisma/client";
import type { NextResponse } from "next/server";
import type { Session } from "next-auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthResult {
  session: Session | null;
  error: NextResponse | null;
}

// ─── Require authentication ───────────────────────────────────────────────────

/**
 * Ensures the request has a valid session.  Returns `error` if not.
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: unauthorized() };
  }
  return { session, error: null };
}

// ─── Require specific roles ───────────────────────────────────────────────────

/**
 * Ensures the caller has at least one of the allowed roles.
 */
export async function requireRole(
  allowedRoles: UserRole[]
): Promise<AuthResult> {
  const { session, error } = await requireAuth();
  if (error) return { session: null, error };

  if (!allowedRoles.includes(session!.user.role)) {
    return {
      session: null,
      error: forbidden(
        `Requires one of: ${allowedRoles.join(", ")}. Your role: ${session!.user.role}`
      ),
    };
  }
  return { session, error: null };
}

// ─── Community-scoped access ──────────────────────────────────────────────────

/**
 * Ensures the caller can modify resources in `communityId`.
 * - SUPER_ADMIN: always passes.
 * - COMMUNITY_ADMIN: must own that community.
 * - Others: rejected.
 */
export async function requireCommunityAccess(
  communityId: string
): Promise<AuthResult> {
  const { session, error } = await requireRole(["SUPER_ADMIN", "COMMUNITY_ADMIN"]);
  if (error) return { session: null, error };

  const user = session!.user;

  if (
    user.role === "COMMUNITY_ADMIN" &&
    user.communityId !== communityId
  ) {
    return {
      session: null,
      error: forbidden("You do not have access to this community."),
    };
  }

  return { session, error: null };
}

// ─── Role predicates (for use in server components / actions) ─────────────────

export const isSuperAdmin = (role: UserRole) => role === "SUPER_ADMIN";
export const isCommunityAdmin = (role: UserRole) => role === "COMMUNITY_ADMIN";
export const isContributor = (role: UserRole) => role === "CONTRIBUTOR";

/** Can create or edit draft content */
export const canCreateContent = (role: UserRole) =>
  ["SUPER_ADMIN", "COMMUNITY_ADMIN", "CONTRIBUTOR"].includes(role);

/** Can publish content (change status to PUBLISHED) */
export const canPublish = (role: UserRole) =>
  ["SUPER_ADMIN", "COMMUNITY_ADMIN"].includes(role);
