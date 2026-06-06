/**
 * Cloudinary helpers
 *
 * Upload strategy:
 *  - Server-side signed uploads keep the API secret off the client.
 *  - Images are stored in a folder hierarchy: zcash-africa/<community-slug>/
 *  - Cloudinary's auto-format + auto-quality transformations reduce payload
 *    without sacrificing visual fidelity.
 */

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});

export { cloudinary };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

// ─── Upload helper ────────────────────────────────────────────────────────────

/**
 * Upload a base64 data URI or remote URL to Cloudinary.
 *
 * @param source   Base64 data URI ("data:image/...") or remote HTTPS URL
 * @param folder   Cloudinary folder path, e.g. "zcash-africa/nigeria"
 * @param publicId Optional stable public_id (useful for avatar replacements)
 */
export async function uploadImage(
  source: string,
  folder: string,
  publicId?: string
): Promise<UploadResult> {
  const result = await cloudinary.uploader.upload(source, {
    folder: `zcash-africa/${folder}`,
    public_id: publicId,
    overwrite: !!publicId,
    // Auto-select best format (WebP for modern browsers)
    fetch_format: "auto",
    quality: "auto",
    // Responsive breakpoints for Next.js Image component
    responsive_breakpoints: [
      { create_derived: true, max_width: 1200, max_images: 5 },
    ],
  });

  return {
    publicId: result.public_id,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  };
}

/**
 * Delete a Cloudinary asset by its public_id.
 * Called when a media record is deleted from the database.
 */
export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}

/**
 * Generate a signed upload URL for direct browser-to-Cloudinary uploads.
 * The frontend receives this URL and POSTs directly, keeping large binary
 * payloads off our Next.js server.
 */
export function generateSignedUploadParams(folder: string): {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
} {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { folder: `zcash-africa/${folder}`, timestamp };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!
  );

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    folder: `zcash-africa/${folder}`,
  };
}
