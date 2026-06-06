/**
 * Prisma Client Singleton
 *
 * In Next.js development the module system hot-reloads on every file change,
 * which would create a new PrismaClient instance on each reload and quickly
 * exhaust the database connection pool.  We work around this by attaching the
 * client to the Node.js global object so it survives hot-reloads.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
