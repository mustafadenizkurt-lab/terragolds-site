import { readProductByIdOrSlug } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const product = await readProductByIdOrSlug(id);
  if (!product) {
    return Response.json({ error: "Ürün bulunamadı." }, { status: 404 });
  }
  return Response.json({ product });
}
