/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "qtienda.shop" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "cdn.qtienda.shop" },
      { protocol: "https", hostname: "**.cloudinary.com" },
      // Avatares de Google (login social) — Google reparte estas fotos
      // entre varios subdominios lhN.googleusercontent.com.
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },

  async headers() {
    return [
      // ── Seguridad general ────────────────────────────────
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },

      // ── Service Worker: nunca cachear ────────────────────
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },

      // ── Manifest: caché corto (actualizable) ────────────
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },

      // ── Íconos: caché largo ──────────────────────────────
      {
        source: "/icon/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
