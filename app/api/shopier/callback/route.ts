import { handleShopierCallback } from "../../../../lib/shopier-callback";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleShopierCallback(request);
}
