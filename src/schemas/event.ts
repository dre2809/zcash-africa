import { z } from "zod";
import { EventType, ContentStatus } from "@prisma/client";

export const createEventSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z
    .string()
    .min(3)
    .max(220)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().max(10_000).optional(),
  eventDate: z.coerce.date(),
  location: z.string().max(300).optional(),
  eventType: z.nativeEnum(EventType).default(EventType.OTHER),
  featuredImage: z.string().url().optional(),
  gallery: z.array(z.string().url()).max(50).optional(),
  attendance: z.number().int().nonnegative().optional(),
  communityId: z.string().cuid(),
});

export const updateEventSchema = createEventSchema
  .omit({ communityId: true })
  .extend({
    status: z.nativeEnum(ContentStatus).optional(),
  })
  .partial();

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
