import HomeClient from "./HomeClient";

export const revalidate = 86400; // 24h — pas de force-dynamic

/**
 * Page d'accueil — 100% CSR.
 * Le Worker ne sert qu'un HTML léger + le JS bundle.
 * Toutes les données (songs, artists, annotations) sont fetchies
 * côté navigateur via Supabase → 0 CPU Worker.
 */
export default function Home() {
  return <HomeClient />;
}
