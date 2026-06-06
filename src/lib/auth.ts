/**
 * NextAuth / Auth.js Configuration
 *
 * Supports:
 *  - Google OAuth (primary)
 *  - GitHub OAuth
 *  - Email magic-link (Resend adapter)
 *
 * Role assignment strategy:
 *  - First user ever created automatically becomes SUPER_ADMIN.
 *  - Subsequent sign-ups receive the PUBLIC role.
 *  - Admins manually promote users via the dashboard.
 */

import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

export const authConfig = {
  adapter: PrismaAdapter(prisma),

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    /**
     * Attach role and communityId to the JWT so downstream middleware and
     * route handlers don't need an extra DB round-trip.
     */
    async jwt({ token, user }) {
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          select: { id: true, role: true, communityId: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.communityId = dbUser.communityId ?? null;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.communityId = token.communityId as string | null;
      }
      return session;
    },
  },

  events: {
    /**
     * After a new user is created via OAuth, promote the very first account
     * to SUPER_ADMIN so the platform has an owner out of the box.
     */
    async createUser({ user }) {
      const count = await prisma.user.count();
      if (count === 1) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "SUPER_ADMIN" },
        });
      }
    },
  },

  session: { strategy: "jwt" },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

// ─── Type augmentation ───────────────────────────────────────────────────────
// Extend the built-in session / JWT types so TypeScript knows about our
// custom fields without casting everywhere.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      communityId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    communityId: string | null;
  }
}
