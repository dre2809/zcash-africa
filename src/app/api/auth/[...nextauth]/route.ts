/**
 * NextAuth catch-all route handler.
 * Handles all OAuth callbacks, sign-in, sign-out, CSRF, session checks, etc.
 */

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
