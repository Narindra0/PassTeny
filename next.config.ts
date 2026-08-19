import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PasseTeny vit dans un dossier du monorepo pass-io : indique à Turbopack
  // que la racine du projet est ici (package.json / package-lock.json).
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
