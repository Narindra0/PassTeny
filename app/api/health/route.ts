import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    project: "pass-teny",
    version: "0.1.0",
    contentSource: config.useLocalContent ? "local" : "github",
    contentRepo: config.contentRepo,
  });
}
