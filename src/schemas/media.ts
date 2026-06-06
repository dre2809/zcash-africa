import { z } from "zod";

export const uploadMediaSchema = z.object({
  title: z.string().max(200).optional(),
  altText: z.string().max(200).optional(),
  communityId: z.string().cuid(),
  // base64 data URI – validated format only, size checked server-side (5 MB max)
  imageData: z
    .string()
    .regex(/^data:image\/(jpeg|jpg|png|webp|gif);base64,/, {
      message: "imageData must be a base64 JPEG, PNG, WebP, or GIF",
    }),
});

export type UploadMediaInput = z.infer<typeof uploadMediaSchema>;
