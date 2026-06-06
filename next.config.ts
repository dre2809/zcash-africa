import type { NextConfig } from "next";

/**
 * Next.js configuration
 *
 * - Remote image patterns are scoped to the exact hosts we use (Cloudinary,
 *   Sanity CDN, OAuth avatar providers) rather than wildcards, reducing the
 *   attack surface for image-proxy abuse.
 * - `typedRoutes` catches broken internal links at build time.
 * - Server actions body size is capped to keep gallery uploads sane; large
 *   binaries should go directly to Cloudinary via signed uploads instead.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "cdn.sanity.io" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },

  // Forward Sanity Studio requests if it's mounted at /studio in this app.
  async redirects() {
    return [];
  },

  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
