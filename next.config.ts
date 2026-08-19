import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PasseTeny vit dans un dossier du monorepo pass-io : indique à Turbopack
  // que la racine du projet est ici (package.json / package-lock.json).
  turbopack: {
    root: process.cwd(),
  },
  // Désactive l'auto-hébergement des polices Google Fonts pour
  // compatibilité avec OpenNext Cloudflare (esbuild ne gère pas les .woff2).
  optimizeFonts: false,
};

export default nextConfig;
