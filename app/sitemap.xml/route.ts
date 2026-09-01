import { readProducts } from "../../lib/store-db";
import { categoryToSlug } from "../../lib/category-slugs";

export const dynamic = "force-dynamic";

const siteUrl = "https://www.terragolds.com";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** SQL `updated_at` timestamps ("YYYY-MM-DD HH:MM:SS") as a sitemap `<lastmod>` date. */
function toLastmod(updatedAt: string | undefined) {
  if (!updatedAt) return undefined;
  const date = updatedAt.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
}

type SitemapUrl = {
  loc: string;
  priority: string;
  frequency: string;
  lastmod?: string;
  images?: string[];
};

export async function GET() {
  const products = await readProducts();
  const categories = [...new Set(products.map((product) => product.category))];
  const categoryLastmod = new Map<string, string>();
  for (const product of products) {
    const lastmod = toLastmod(product.updatedAt);
    if (!lastmod) continue;
    const current = categoryLastmod.get(product.category);
    if (!current || lastmod > current) categoryLastmod.set(product.category, lastmod);
  }
  const urls: SitemapUrl[] = [
    { loc: `${siteUrl}/`, priority: "1.0", frequency: "weekly" },
    { loc: `${siteUrl}/support`, priority: "0.5", frequency: "monthly" },
    { loc: `${siteUrl}/hakkimizda`, priority: "0.6", frequency: "monthly" },
    {
      loc: `${siteUrl}/guvenli-alisveris`,
      priority: "0.5",
      frequency: "monthly",
    },
    { loc: `${siteUrl}/kvkk`, priority: "0.4", frequency: "yearly" },
    {
      loc: `${siteUrl}/gizlilik-politikasi`,
      priority: "0.4",
      frequency: "yearly",
    },
    {
      loc: `${siteUrl}/cerez-politikasi`,
      priority: "0.4",
      frequency: "yearly",
    },
    {
      loc: `${siteUrl}/mesafeli-satis-sozlesmesi`,
      priority: "0.5",
      frequency: "yearly",
    },
    {
      loc: `${siteUrl}/on-bilgilendirme-formu`,
      priority: "0.5",
      frequency: "yearly",
    },
    {
      loc: `${siteUrl}/teslimat-ve-iade`,
      priority: "0.5",
      frequency: "yearly",
    },
    {
      loc: `${siteUrl}/iptal-ve-iade-kosullari`,
      priority: "0.4",
      frequency: "yearly",
    },
    {
      loc: `${siteUrl}/kullanim-kosullari`,
      priority: "0.4",
      frequency: "yearly",
    },
    ...categories.map((category) => ({
      loc: `${siteUrl}/kategori/${categoryToSlug(category)}`,
      priority: "0.7",
      frequency: "weekly",
      lastmod: categoryLastmod.get(category),
    })),
    ...products.map((product) => ({
      loc: `${siteUrl}/products/${product.slug || product.id}`,
      priority: "0.8",
      frequency: "weekly",
      lastmod: toLastmod(product.updatedAt),
      images: [product.image, product.hoverImage]
        .filter((image): image is string => Boolean(image))
        .map((image) => new URL(image, siteUrl).toString()),
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <changefreq>${url.frequency}</changefreq>
    <priority>${url.priority}</priority>${
      url.lastmod ? `\n    <lastmod>${url.lastmod}</lastmod>` : ""
    }${(url.images ?? [])
      .map(
        (image) =>
          `\n    <image:image>\n      <image:loc>${escapeXml(image)}</image:loc>\n    </image:image>`,
      )
      .join("")}
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
