import type { Metadata } from "next";
import SongPageClient from "./SongPageClient";

interface SongPageProps {
  params: Promise<{ slug: string }>;
}

// Pré-génère à la demande (pas de force-dynamic → Worker ne fait que servir le HTML statique).
export const revalidate = 86400; // 24h

export async function generateMetadata({ params }: SongPageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug} — Pass'Teny`,
    description: `Lyrics et annotations de « ${slug} » sur Pass'Teny.`,
  };
}

/**
 * Page titre — 100% CSR.
 * Le Server Component ne renvoie qu'un <div> minimal + le Client Component.
 * Toutes les données (lyrics, annotations, profils) sont fetchies côté
 * navigateur via Supabase → 0 CPU Worker.
 */
export default async function SongPage({ params }: SongPageProps) {
  const { slug } = await params;
  return <SongPageClient slug={slug} />;
}
