import { readPublishedSiteContent } from "../../../lib/site-content";
import { defaultSiteContent } from "../../../lib/site-content-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const content = await readPublishedSiteContent().catch(
    () => defaultSiteContent,
  );
  return Response.json(
    { content },
    { headers: { "cache-control": "no-store" } },
  );
}
