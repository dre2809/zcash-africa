import { z } from "zod";

const urlOrEmpty = z.union([z.string().url(), z.literal("")]).optional();

export const createCommunitySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().max(2000).optional(),
  region: z.string().max(100).optional(),
  logo: z.string().url("Logo must be a valid URL").optional(),
  banner: z.string().url("Banner must be a valid URL").optional(),
  website: urlOrEmpty,
  telegram: urlOrEmpty,
  xAccount: z.string().max(50).optional(),
});

export const updateCommunitySchema = createCommunitySchema.partial();

export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;
export type UpdateCommunityInput = z.infer<typeof updateCommunitySchema>;
