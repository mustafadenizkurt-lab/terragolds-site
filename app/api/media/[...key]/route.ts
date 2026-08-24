import { getMediaBucket } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ key: string[] }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { key } = await context.params;
  const object = await getMediaBucket().get(key.join("/"));
  if (!object) return new Response("Görsel bulunamadı.", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
