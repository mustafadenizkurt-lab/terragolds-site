import { readProducts, readSettings } from "../../lib/store-db";
import { SITE_URL, escapeXml, absoluteUrl, priceWithCurrency, googleProductCategory, finalPriceFor } from "../../lib/product-feed";

export const dynamic = "force-dynamic";

// Instagram/Facebook Shop (Meta Commerce Manager) kataloğu için ürün
// feed'i. merchant.xml (Google Merchant) ile aynı temel RSS 2.0 + "g:"
// ad alanı formatını kullanıyor - Meta da bu formatı kabul ediyor, ayrı
// bir feed yazmamızın tek gerçek sebebi g:availability DEĞERİ: Google
// "in_stock"/"out_of_stock" (alt çizgili) beklerken Meta'nın resmi katalog
// spesifikasyonu "in stock"/"out of stock" (boşluklu) istiyor - birini
// diğerine göndermek ürünlerin sessizce reddedilmesine/yanlış
// sınıflanmasına yol açabiliyordu.
export async function GET() {
  const [products, settings] = await Promise.all([readProducts(), readSettings()]);
  const brand = settings.businessName || "Terragolds";
  const now = new Date().toISOString();

  const items = products
    .filter((product) => product.status === "published")
    .map((product) => {
      const finalPrice = finalPriceFor(product);

      const salePrice =
        product.discountPercent > 0
          ? `    <g:sale_price>${escapeXml(priceWithCurrency(finalPrice))}</g:sale_price>\n`
          : "";

      return `  <item>
    <g:id>${product.id}</g:id>
    <title>${escapeXml(product.name)}</title>
    <description>${escapeXml(product.description || product.stone)}</description>
    <link>${escapeXml(`${SITE_URL}/products/${product.slug || product.id}`)}</link>
    <g:image_link>${escapeXml(absoluteUrl(product.image))}</g:image_link>
    <g:availability>${product.stock > 0 ? "in stock" : "out of stock"}</g:availability>
    <g:price>${escapeXml(priceWithCurrency(product.price))}</g:price>
${salePrice}    <g:brand>${escapeXml(brand)}</g:brand>
    <g:condition>new</g:condition>
    <g:product_type>${escapeXml(product.category)}</g:product_type>
    <g:google_product_category>${escapeXml(googleProductCategory(product))}</g:google_product_category>
  </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>${escapeXml(brand)} Meta Katalog Feed'i</title>
  <link>${SITE_URL}</link>
  <description>${escapeXml(`${brand} takı ve aksesuar ürün kataloğu (Instagram/Facebook Shop)`)}</description>
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
