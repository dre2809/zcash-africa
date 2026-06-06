/**
 * Sanity CMS client
 *
 * Why Sanity alongside PostgreSQL?
 *  - PostgreSQL/Prisma owns *structured, relational, queryable* data: users,
 *    roles, communities, RSVPs, analytics counters — anything the app needs
 *    to join, filter, or paginate transactionally.
 *  - Sanity owns *long-form editorial content*: rich-text blog bodies,
 *    landing-page sections, translated copy. Editors get a friendly studio
 *    UI and content can be previewed/versioned without shipping a deploy.
 *
 * BlogPost.content in Prisma stores Sanity Portable Text as JSON (or a
 * `sanityDocumentId` reference, depending on editorial workflow preference) —
 * see `docs/ARCHITECTURE.md` for the trade-off discussion.
 */

import { createClient, type SanityClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url/lib/types/types";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2025-01-01";

/**
 * Read-only client for public pages — uses the CDN for fast, cached responses.
 * Safe to call from Server Components.
 */
export const sanityClient: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: "published",
});

/**
 * Authenticated client for previews and write operations (e.g. syncing
 * published-status changes back from the dashboard). Never expose the write
 * token to the client bundle — this module is server-only.
 */
export const sanityWriteClient: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
  perspective: "raw",
});

const builder = imageUrlBuilder(sanityClient);

/** Build an optimized Sanity CDN image URL for a given image source/asset ref. */
export function urlForImage(source: SanityImageSource) {
  return builder.image(source);
}

// ─── GROQ query fragments ─────────────────────────────────────────────────────

/** Fetch a single editorial page (e.g. About, Mission) by its slug + locale. */
export const pageBySlugQuery = /* groq */ `
  *[_type == "page" && slug.current == $slug && locale == $locale][0]{
    _id,
    title,
    slug,
    locale,
    "sections": sections[]{
      _type,
      _key,
      heading,
      body,
      image
    }
  }
`;

/** Fetch translated UI strings for a locale (i18n future-proofing). */
export const translationsQuery = /* groq */ `
  *[_type == "translationSet" && locale == $locale][0].strings
`;
