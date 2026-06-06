import { z } from "zod";
import { BlogCategory, ContentStatus } from "@prisma/client";

export const createPostSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z
    .string()
    .min(3)
    .max(220)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  excerpt: z.string().max(500).optional(),
  // Content is a Sanity Portable Text JSON array or plain HTML string
  content: z.unknown().optional(),
  featuredImage: z.string().url().optional(),
  category: z.nativeEnum(BlogCategory).default(BlogCategory.COMMUNITY_UPDATES),
  tags: z.array(z.string().max(50)).max(10).optional(),
  communityId: z.string().cuid(),
});

export const updatePostSchema = createPostSchema
  .omit({ communityId: true })
  .extend({
    status: z.nativeEnum(ContentStatus).optional(),
    publishedAt: z.coerce.date().optional(),
  })
  .partial();

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
