import type { Metadata } from "next";
import ChartClient from "./ChartClient";

export const revalidate = 86400; // 24h

export const metadata: Metadata = {
  title: "Le chart",
  description: "Les titres les plus vus, les contributeurs les plus actifs du catalogue Pass'Teny.",
};

/**
 * Page chart — 100% CSR.
 * 0 CPU Worker.
 */
export default function ChartPage() {
  return <ChartClient />;
}
