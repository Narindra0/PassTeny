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
 * équivalent ImageKit (les covers Cloudinary renvoient 401 systématiquement —
 * compte restreint — on sert donc directement le miroir ImageKit, dès le SSR)
 * → fallback custom → placeholder SVG.
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
 * 0 → équivalent ImageKit de src (les Cloudinary sont 401) ;
 * 1 → fallback custom ; 2+ → placeholder.
 * Le `skipImageKitFallback` (avatars artistes) garde la source d'origine en
 * première passe, car tous les ProfilePic Cloudinary pointent vers le même
 * fichier générique sur ImageKit.
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
    // Première passe : équivalent ImageKit si convertible (Cloudinary = 401),
    // sinon la source d'origine optimisée.
    if (!skipImageKitFallback) {
      const imageKitUrl = isCloudinaryUrl(src) ? cloudinaryToImageKitUrl(src) : null;
      if (imageKitUrl) return optimize(imageKitUrl, size);
    }
    return optimize(src, size);
  }

  // Fallback custom (ex. cover d'album pour un avatar artiste), puis placeholder.
  if (attempt === 1) {
    return resolveFallback(fallback, size);
  }

  // Terminus absolu : le placeholder est un data URI local, ne peut pas échouer.
  return DEFAULT_FALLBACK;
}
