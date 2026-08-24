import { readProducts, readSettings } from "../../lib/store-db";

export const dynamic = "force-dynamic";

const siteUrl = "https://www.terragolds.com";

function escapeXml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function priceWithCurrency(price: number) {
  return `${Number(price).toFixed(2)} TRY`;
}

export async function GET() {
  const [products, settings] = await Promise.all([readProducts(), readSettings()]);
  const brand = settings.businessName || "Terragolds";
  const now = new Date().toISOString();

  const items = products
    .filter((product) => product.status === "published")
    .map((product) => {
      const finalPrice =
        product.discountPercent > 0
          ? Math.max(0, Math.round(product.price * (1 - product.discountPercent / 100)))
          : product.price;

      const salePrice =
        product.discountPercent > 0
          ? `    <g:sale_price>${escapeXml(priceWithCurrency(finalPrice))}</g:sale_price>\n`
          : "";

      return `  <item>
    <g:id>${product.id}</g:id>
    <title>${escapeXml(product.name)}</title>
    <description>${escapeXml(product.description || product.stone)}</description>
    <link>${escapeXml(`${siteUrl}/products/${product.id}`)}</link>
    <g:image_link>${escapeXml(absoluteUrl(product.image))}</g:image_link>
    <g:availability>${product.stock > 0 ? "in_stock" : "out_of_stock"}</g:availability>
    <g:price>${escapeXml(priceWithCurrency(product.price))}</g:price>
${salePrice}    <g:brand>${escapeXml(brand)}</g:brand>
    <g:condition>new</g:condition>
    <g:product_type>${escapeXml(product.category)}</g:product_type>
    <g:google_product_category>Home &amp; Garden &gt; Decor</g:google_product_category>
  </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>${escapeXml(brand)} Ürün Feed'i</title>
  <link>${siteUrl}</link>
  <description>${escapeXml(`${brand} doğal taş ürün kataloğu`)}</description>
  <lastBuildDate>${now}</lastBuildDate>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=1800",
    },
  });
}
