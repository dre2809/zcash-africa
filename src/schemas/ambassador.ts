import { z } from "zod";

export const createAmbassadorSchema = z.object({
  name: z.string().min(2).max(100),
  photo: z.string().url().optional(),
  role: z.string().max(100).optional(),
  bio: z.string().max(2000).optional(),
  country: z.string().max(100).optional(),
  xAccount: z.string().max(50).optional(),
  telegram: z.string().max(50).optional(),
  communityId: z.string().cuid(),
});

export const updateAmbassadorSchema = createAmbassadorSchema
  .omit({ communityId: true })
  .partial();

export type CreateAmbassadorInput = z.infer<typeof createAmbassadorSchema>;
export type UpdateAmbassadorInput = z.infer<typeof updateAmbassadorSchema>;
