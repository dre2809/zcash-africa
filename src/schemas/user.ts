import { z } from "zod";
import { UserRole } from "@prisma/client";

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
  communityId: z.string().cuid().nullable().optional(),
});

export const newsletterSubscribeSchema = z.object({
  email: z.string().email(),
  communityId: z.string().cuid().optional(),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;
