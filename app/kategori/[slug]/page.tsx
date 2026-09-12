import type { Metadata } from "next";
import StoreSubpageHeader from "../../store-subpage-header";
import StoreSiteFooter from "../../store-site-footer";
import { FloatingSocialLinks } from "../../store-shared-chrome";
import StoreTrustBar from "../../store-trust-bar";
import CategoryPageBody from "./category-page-body";
import { findCategoryBySlug } from "../../../lib/category-slugs";
import { categoryGroupLabel, findCategoryGroupBySlug, groupForCategory } from "../../../lib/category-groups";
import { subgroupsForGroup, tallyCategoryCounts } from "../../../lib/category-subgroups";
import type { Product } from "../../../lib/store-data";
import { readProducts, readSettings } from "../../../lib/store-db";
import { breadcrumbSchema, toJsonLd } from "../../../lib/seo/structured-data";

export const dynamic = "force-dynamic";

const SITE_URL = "https://www.terragolds.com";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ alt?: string }>;
};

/**
 * The [slug] segment accepts either a top-level nav group slug (e.g.
 * "kolyeler", spanning several raw categories) or a single raw category's
 * own slug — group match is checked first since it's the more specific,
 * curated nav entry point; single-category URLs keep working unchanged.
 *
 * For a group match, an optional `alt` subcategory slug (from the nav
 * dropdown) narrows the results further to one subgroup's raw category
 * values - subgroups are derived from the group's own products, the same
 * way the nav dropdown computes them, so the slug always resolves the same
 * set of raw categories here as it did when the link was built.
 */
function resolveCategoryOrGroup(products: Product[], slug: string, altSlug?: string) {
  const group = findCategoryGroupBySlug(slug);
  if (group) {
    const groupProducts = products.filter(
      (product) => groupForCategory(product.category)?.slug === group.slug,
    );
    if (altSlug) {
      const categoryCounts = tallyCategoryCounts(
        groupProducts.map((product) => product.category),
      );
      const subgroup = subgroupsForGroup(group, categoryCounts).find(
        (sub) => sub.slug === altSlug,
      );
      if (subgroup) {
        const categorySet = new Set(subgroup.categories);
        return {
          title: `${group.label} · ${subgroup.label}`,
          // Subgroup names are raw, untranslated supplier data (see
          // category-subgroups.ts) - only the curated group half has a
          // real English label, so it's the only part that can flip.
          titleEn: `${categoryGroupLabel(group, "en")} · ${subgroup.label}`,
          products: groupProducts.filter((product) => categorySet.has(product.category)),
        };
      }
    }
    return { title: group.label, titleEn: categoryGroupLabel(group, "en"), products: groupProducts };
  }
  const categories = [...new Set(products.map((product) => product.category))];
  const category = findCategoryBySlug(categories, slug);
  if (!category) return null;
  return {
    title: category,
    // Raw category data (supplier/admin free text) has no stored
    // translation - stays Turkish in both languages, see lib/i18n.ts.
    titleEn: null as string | null,
    products: products.filter((product) => product.category === category),
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { alt } = await searchParams;
  const products = await readProducts();
  const resolved = resolveCategoryOrGroup(products, slug, alt);

  if (!resolved) {
    return {
      title: "Kategori Bulunamadı",
      robots: { index: false, follow: false },
    };
  }

  const { title, products: categoryProducts } = resolved;
  const url = alt
    ? `${SITE_URL}/kategori/${slug}?alt=${alt}`
    : `${SITE_URL}/kategori/${slug}`;
  const heroImage = categoryProducts[0]?.image
    ? new URL(categoryProducts[0].image, SITE_URL).toString()
    : `${SITE_URL}/og.jpg`;
  const description = `${title} kategorisinde ${categoryProducts.length} seçilmiş ürün. Terragolds koleksiyonunu inceleyin.`;

  return {
    title: `${title} | Terragolds`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | Terragolds`,
      description,
      url,
      type: "website",
      images: [{ url: heroImage, alt: `${title} Terragolds` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Terragolds`,
      description,
      images: [heroImage],
    },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const { alt } = await searchParams;
  const [products, settings] = await Promise.all([
    readProducts(),
    readSettings(),
  ]);
  const resolved = resolveCategoryOrGroup(products, slug, alt);
  const title = resolved?.title ?? null;
  const titleEn = resolved?.titleEn ?? null;
  const categoryProducts = resolved?.products ?? [];

  const breadcrumbUrl = alt
    ? `${SITE_URL}/kategori/${slug}?alt=${alt}`
    : `${SITE_URL}/kategori/${slug}`;

  return (
    <main className="category-page">
      {title && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: toJsonLd(
              breadcrumbSchema([
                { name: "Ana Sayfa", url: `${SITE_URL}/` },
                { name: "Ürünler", url: `${SITE_URL}/#shop` },
                { name: title, url: breadcrumbUrl },
              ]),
            ),
          }}
        />
      )}
      <StoreSubpageHeader activeGroupSlug={slug} />
      <StoreTrustBar />

      <CategoryPageBody title={title} titleEn={titleEn} products={categoryProducts} />

      <StoreSiteFooter
        businessName={settings.businessName}
        address={[settings.address, settings.district, settings.city]
          .filter(Boolean)
          .join(", ")}
        phone={settings.phone}
        whatsapp={settings.whatsapp}
        email={settings.email}
        instagram={settings.instagram}
        facebook={settings.facebook}
        tiktok={settings.tiktok}
      />
      <FloatingSocialLinks />
    </main>
  );
}
