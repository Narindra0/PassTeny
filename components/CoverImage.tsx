"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_FALLBACK,
  cloudinaryToImageKitUrl,
  getOptimizedImageUrl,
  isCloudinaryUrl,
  type ImageSize,
} from "@/lib/imageUtils";

interface CoverImageProps {
  src?: string | null;
  alt: string;
  /** Classes Tailwind appliquées à l'<img> (taille, radius, object-fit…). */
  className?: string;
  /** Taille de transformation ImageKit (clé prédéfinie ou largeur px). */
  size?: ImageSize;
  /** Fallback supplémentaire (ex. cover d'album pour un avatar artiste). */
  fallback?: string | null;
  eager?: boolean;
  /**
   * Saute l'étape « équivalent ImageKit de la source » :
   * utile pour les avatars artistes dont tous les ProfilePic Cloudinary pointent
   * vers le même fichier générique sur ImageKit (tous les artistes auraient la
   * même photo). La chaîne devient src → fallback → placeholder, comme
   * handleArtistImageError de Frontend4Fan (cover d'album en data-fallback).
   */
  skipImageKitFallback?: boolean;
}

/**
 * Image avec la chaîne de fallback de Pass'io :
 * URL Cloudinary (optimisée) → équivalent ImageKit → fallback custom → placeholder SVG.
 * Reproduit OptimizedImage.jsx / handleImageError de Frontend4Fan.
 */
export default function CoverImage({
  src,
  alt,
  className = "",
  size = "card",
  fallback,
  eager = false,
  skipImageKitFallback = false,
}: CoverImageProps) {
  const [attempt, setAttempt] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset du compteur quand la source change (navigation client-side entre titres) :
  // sans cela, un attempt épuisé (placeholder) resterait figé pour la nouvelle source.
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setAttempt(0);
  }

  // Étape courante de la chaîne de fallback, recalculée à chaque saut.
  const currentSrc = resolveCurrentSrc(src, size, fallback, attempt, skipImageKitFallback);

  const handleError = () => {
    setAttempt((a) => a + 1);
  };

  // Le HTML SSR charge la première URL avant l'hydratation : si elle échoue
  // (ex. Cloudinary 401) avant que `onError` soit attaché, l'événement est perdu.
  // On vérifie donc l'état réel de l'image après montage et on bascule au besoin.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || attempt >= MAX_ATTEMPTS) return;
    if (img.complete && img.naturalWidth === 0) {
      handleError();
    }
  }, [attempt, src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- fallback chain Cloudinary→ImageKit, comme Frontend4Fan
    <img
      ref={imgRef}
      src={currentSrc}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={handleError}
    />
  );
}

/** Nombre d'étapes de la chaîne (src, imagekit, fallback, placeholder). */
const MAX_ATTEMPTS = 3;

/** Optimise une URL (paramètres ImageKit) sans conversion Cloudinary → ImageKit. */
function optimize(url: string | undefined, size: ImageSize): string {
  if (!url) return DEFAULT_FALLBACK;
  return getOptimizedImageUrl(url, size) ?? DEFAULT_FALLBACK;
}

/** Résout un fallback custom avec conversion Cloudinary → ImageKit (les covers sont aussi en 401). */
function resolveFallback(fallback: string | null | undefined, size: ImageSize): string {
  if (!fallback) return DEFAULT_FALLBACK;
  const imageKitUrl = isCloudinaryUrl(fallback) ? cloudinaryToImageKitUrl(fallback) : null;
  return getOptimizedImageUrl(imageKitUrl || fallback, size) ?? DEFAULT_FALLBACK;
}

/**
 * Chaîne de fallback indexée par `attempt` :
 * 0 → src (optimisée) ; 1 → équivalent ImageKit de src (sauf si skip) ;
 * 2 → fallback custom ; 3+ → placeholder.
 */
function resolveCurrentSrc(
  src: string | null | undefined,
  size: ImageSize,
  fallback: string | null | undefined,
  attempt: number,
  skipImageKitFallback: boolean
): string {
  if (!src) {
    return attempt >= 1 ? DEFAULT_FALLBACK : resolveFallback(fallback, size);
  }

  if (attempt === 0) {
    // Première passe : URL d'origine, optimisée (Cloudinary reste Cloudinary → 401 en dev).
    return optimize(src, size);
  }

  if (attempt === 1) {
    // Cloudinary 401 → tenter l'équivalent ImageKit (sauf si l'étape est sautée).
    if (!skipImageKitFallback) {
      const imageKitUrl = isCloudinaryUrl(src) ? cloudinaryToImageKitUrl(src) : null;
      if (imageKitUrl) return optimize(imageKitUrl, size);
    }
    // Pas de conversion possible → passer au fallback custom.
    return resolveFallback(fallback, size);
  }

  if (attempt === 2) {
    // Fallback custom (ex. cover d'album pour un avatar artiste).
    return resolveFallback(fallback, size);
  }

  // Terminus absolu : le placeholder est un data URI local, ne peut pas échouer.
  return DEFAULT_FALLBACK;
}
