import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PasseTeny vit dans un dossier du monorepo pass-io : indique à Turbopack
  // que la racine du projet est ici (package.json / package-lock.json).
  turbopack: {
    root: process.cwd(),
  },

  // Headers for PWA service worker and offline support
  async headers() {
    return [
      {
        // Service worker must be served from root scope with no-cache
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        // Offline fallback page
        source: "/offline",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
