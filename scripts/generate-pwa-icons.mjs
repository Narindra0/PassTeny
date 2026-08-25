#!/usr/bin/env node

/**
 * Generate PWA icons for Pass'Teny.
 *
 * Creates SVG icons at multiple sizes with the lamba diamond mark
 * on the brand background. These SVGs are referenced in manifest.json
 * and used by the browser for install prompts and home screen icons.
 *
 * Usage: node scripts/generate-pwa-icons.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ICONS_DIR = resolve(ROOT, "public", "icons");

// Ensure the icons directory exists
mkdirSync(ICONS_DIR, { recursive: true });

// ── Brand colors (from globals.css :root) ──
const COLORS = {
  paper: "#f7f1e4",
  red: "#a63a2b",
  redDark: "#7f2a1e",
  green: "#43633f",
  mustard: "#c4912e",
  ink: "#211b12",
};

/**
 * Generate an SVG icon with the lamba diamond mark centered on a
 * rounded-rectangle background.
 */
function generateIconSVG(size) {
  const padding = Math.round(size * 0.18);
  const diamondSize = Math.round(size * 0.38);
  const cornerRadius = Math.round(size * 0.16);
  const half = size / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="${COLORS.paper}"/>

  <!-- Lamba diamond — 4-color conic gradient (simulated with 4 paths) -->
  <g transform="translate(${half}, ${half}) rotate(45)">
    <!-- Top-left: red -->
    <path d="M0,${-diamondSize / 2} L${-diamondSize / 2},0 L0,${diamondSize / 2} Z" fill="${COLORS.red}"/>
    <!-- Top-right: paper -->
    <path d="M0,${-diamondSize / 2} L${diamondSize / 2},0 L0,${diamondSize / 2} Z" fill="${COLORS.paper}"/>
    <!-- Bottom-left: green -->
    <path d="M0,0 L${-diamondSize / 2},0 L0,${diamondSize / 2} Z" fill="${COLORS.green}"/>
    <!-- Bottom-right: mustard -->
    <path d="M0,0 L${diamondSize / 2},0 L0,${diamondSize / 2} Z" fill="${COLORS.mustard}"/>

    <!-- Border -->
    <rect x="${-diamondSize / 2}" y="${-diamondSize / 2}"
          width="${diamondSize}" height="${diamondSize}"
          rx="3" fill="none" stroke="${COLORS.ink}" stroke-width="${Math.max(1, size * 0.015)}"/>
  </g>

  <!-- Text label below the diamond -->
  <text x="${half}" y="${size - padding * 0.35}"
        font-family="system-ui, -apple-system, sans-serif"
        font-weight="700"
        font-size="${Math.round(size * 0.12)}"
        text-anchor="middle"
        fill="${COLORS.ink}"
        letter-spacing="-0.02em">PASS'TENY</text>
</svg>`;
}

// ── Sizes needed ──
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

console.log("Generating PWA icons…");

for (const size of SIZES) {
  const svg = generateIconSVG(size);
  const filePath = resolve(ICONS_DIR, `icon-${size}.svg`);
  writeFileSync(filePath, svg, "utf-8");
  console.log(`  ✓ icon-${size}.svg`);
}

// ── Also generate a simple apple-touch-icon SVG (180×180) ──
const appleSvg = generateIconSVG(180);
writeFileSync(resolve(ICONS_DIR, "apple-touch-icon.svg"), appleSvg, "utf-8");
console.log("  ✓ apple-touch-icon.svg");

// ── Favicon SVG ──
const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <g transform="translate(16, 16) rotate(45)">
    <path d="M0,-10 L-10,0 L0,10 Z" fill="${COLORS.red}"/>
    <path d="M0,-10 L10,0 L0,10 Z" fill="${COLORS.paper}"/>
    <path d="M0,0 L-10,0 L0,10 Z" fill="${COLORS.green}"/>
    <path d="M0,0 L10,0 L0,10 Z" fill="${COLORS.mustard}"/>
    <rect x="-10" y="-10" width="20" height="20" rx="2" fill="none" stroke="${COLORS.ink}" stroke-width="1.5"/>
  </g>
</svg>`;
writeFileSync(resolve(ICONS_DIR, "favicon.svg"), faviconSvg, "utf-8");
console.log("  ✓ favicon.svg");

console.log("\nDone! Icons generated in public/icons/");
console.log("Note: Convert .svg to .png for production (use sharp, canvas, or online tool).");
console.log("For now, the manifest references SVGs which modern browsers support.");
