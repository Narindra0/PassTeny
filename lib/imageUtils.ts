/**
 * Utilitaires d'images — même système de fallback que Frontend4Fan (Pass'io).
 *
 * Chaîne de fallback : URL Cloudinary → équivalent ImageKit → placeholder SVG.
 * Les URLs Cloudinary du catalogue Pass'io renvoient 401 (compte restreint) ;
 * ImageKit (https://ik.imagekit.io/a6ywpqgqor) les héberge en doublon et
 * répond 200 — c'est lui qui sert d'optimiseur CDN + source de repli.
 */

export const IMAGEKIT_BASE_URL = "https://ik.imagekit.io/a6ywpqgqor";
export const IMAGEKIT_FALLBACK_BASE = IMAGEKIT_BASE_URL;

// Placeholder SVG neutre (dégradé zinc + note de musique), encodé en data URI.
const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">' +
  '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">' +
  '<stop offset="0%" stop-color="#2b2b2b"/><stop offset="100%" stop-color="#171717"/>' +
  "</linearGradient></defs>" +
  '<rect width="400" height="400" fill="url(#g)"/>' +
  '<g transform="translate(200,200)" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="3">' +
  '<circle cx="0" cy="0" r="110"/><circle cx="0" cy="0" r="75"/><circle cx="0" cy="0" r="40"/>' +
  "</g>" +
  '<path d="M170 130 L170 265 L245 235 L245 155 Z" fill="rgba(255,255,255,0.12)"/>' +
  "</svg>";

export const DEFAULT_FALLBACK = "data:image/svg+xml," + encodeURIComponent(PLACEHOLDER_SVG);

/** Dossiers connus du mapping Cloudinary → ImageKit (mêmes que Pass'io). */
const KNOWN_FOLDERS = ["Covers", "ProfilePic", "merch"];

export function isCloudinaryUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("res.cloudinary.com");
}

export function isImageKitUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("ik.imagekit.io") || url.startsWith(IMAGEKIT_BASE_URL);
}

/**
 * Convertit une URL Cloudinary vers son équivalent ImageKit pour le fallback.
 * Reproduit la logique de Frontend4Fan/src/utils/imageUtils.js :
 * on extrait le nom de fichier et on le replace dans le dossier connu
 * (`Covers/`, `ProfilePic/`, `merch/`), le sous-dossier `artist-xxx/` étant ignoré.
 */
export function cloudinaryToImageKitUrl(cloudinaryUrl: string | null | undefined): string | null {
  if (!cloudinaryUrl || !isCloudinaryUrl(cloudinaryUrl)) return null;

  try {
    const pathParts = cloudinaryUrl.split("/");
    const filename = pathParts[pathParts.length - 1].split("?")[0];
    if (!filename) return null;

    for (const folder of KNOWN_FOLDERS) {
      if (cloudinaryUrl.includes(`/${folder}/`)) {
        return `${IMAGEKIT_FALLBACK_BASE}/${folder}/${filename}`;
      }
    }

    const versionMatch = cloudinaryUrl.match(/\/v\d+\/([^/]+)\//);
    if (versionMatch) {
      return `${IMAGEKIT_FALLBACK_BASE}/${versionMatch[1]}/${filename}`;
    }

    return null;
  } catch {
    return null;
  }
}

/** Tailles standardisées (cache CDN ImageKit). */
export const IMAGE_SIZES = {
  thumb: 150,
  card: 400,
  detail: 600,
  hero: 800,
} as const;

export type ImageSize = keyof typeof IMAGE_SIZES | number;

function resolveWidth(size: ImageSize): number {
  return typeof size === "number" ? size : IMAGE_SIZES[size];
}

/**
 * Retourne une URL d'image optimisée :
 * - URLs ImageKit → paramètres de transformation `tr=w-XXX,q-80,f-auto`
 * - URLs Cloudinary → `q_auto/f_auto` (le fallback ImageKit interviendra si 401)
 * - autres URLs → inchangées
 */
export function getOptimizedImageUrl(
  originalUrl: string | null | undefined,
  size: ImageSize = "card"
): string | null {
  if (!originalUrl) return null;
  const width = resolveWidth(size);

  // ImageKit : ajouter les paramètres de transformation.
  // ⚠️ Séparateur VIRGULE (pas slash) : ImageKit interprète le slash comme des
  // transformations chaînées et ne redimensionne pas (renvoie l'image d'origine).
  // Vérifié empiriquement : tr=w-150,q-80,f-auto → 150px ; tr=w-150/q-80/f-auto → 80px.
  if (isImageKitUrl(originalUrl)) {
    let cleanUrl = originalUrl;
    try {
      const urlObj = new URL(originalUrl);
      urlObj.searchParams.delete("tr");
      cleanUrl = urlObj.toString();
    } catch {
      cleanUrl = originalUrl.split("?")[0];
    }
    const trString = `w-${width},q-80,f-auto`;
    const separator = cleanUrl.includes("?") ? "&" : "?";
    return `${cleanUrl}${separator}tr=${trString}`;
  }

  // Cloudinary : demander l'optimisation automatique
  if (isCloudinaryUrl(originalUrl)) {
    if (!originalUrl.includes("f_auto") && !originalUrl.includes("q_auto")) {
      return originalUrl.replace("/upload/", "/upload/q_auto/f_auto/");
    }
    return originalUrl;
  }

  return originalUrl;
}

/**
 * Renvoie l'URL finale à afficher pour une source donnée :
 * Cloudinary optimisé, ou déjà ImageKit (optimisé), ou placeholder.
 * Le fallback ImageKit est appliqué côté serveur pour la première passe ;
 * le composant CoverImage ré-applique onError → ImageKit → placeholder à l'exécution.
 */
export function resolveImageUrl(src: string | null | undefined): string {
  if (!src) return DEFAULT_FALLBACK;
  return getOptimizedImageUrl(src) ?? DEFAULT_FALLBACK;
}

/**
 * Résout la meilleure image d'un artiste, comme getArtistImage de Frontend4Fan :
 * sa photo de profil si elle existe, sinon la cover de sa release la plus récente.
 *
 * @returns { src, fallback } — `src` = photo de profil (peut être 401, le composant
 *   CoverImage basculera), `fallback` = cover de la release la plus récente (ou null).
 */
export function getArtistImage(
  profileUrl: string | null | undefined,
  releases: { coverUrl?: string | null; releaseDate?: string | null }[]
): { src: string | null; fallback: string | null } {
  const profile = profileUrl && profileUrl !== "null" ? profileUrl : null;

  // Cover de la release la plus récente (par date, sinon l'ordre fourni).
  const withCover = releases.filter((r) => r.coverUrl);
  let fallback: string | null = null;
  if (withCover.length > 0) {
    const sorted = [...withCover].sort((a, b) => {
      // getTime() || 0 : protège contre les dates malformées (NaN dans le comparateur).
      const da = new Date(a.releaseDate || 0).getTime() || 0;
      const db = new Date(b.releaseDate || 0).getTime() || 0;
      return db - da;
    });
    fallback = sorted[0].coverUrl || null;
  }

  return { src: profile, fallback };
}
