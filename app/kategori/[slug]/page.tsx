import type { Metadata } from "next";
import Link from "next/link";
import StoreSubpageHeader from "../../store-subpage-header";
import StoreSiteFooter from "../../store-site-footer";
import { FloatingSocialLinks } from "../../store-shared-chrome";
import StoreTrustBar from "../../store-trust-bar";
import { categoryToSlug, findCategoryBySlug } from "../../../lib/category-slugs";
import { getDiscountedPrice } from "../../../lib/store-data";
import { readProducts, readSettings } from "../../../lib/store-db";

export const dynamic = "force-dynamic";

const SITE_URL = "https://www.terragolds.com";

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const products = await readProducts();
  const categories = [...new Set(products.map((product) => product.category))];
  const category = findCategoryBySlug(categories, slug);

  if (!category) {
    return {
      title: "Kategori Bulunamadı",
      robots: { index: false, follow: false },
    };
  }

  const categoryProducts = products.filter(
    (product) => product.category === category,
  );
  const url = `${SITE_URL}/kategori/${categoryToSlug(category)}`;
  const heroImage = categoryProducts[0]?.image
    ? new URL(categoryProducts[0].image, SITE_URL).toString()
    : `${SITE_URL}/og.png`;
  const description = `${category} kategorisinde ${categoryProducts.length} seçilmiş doğal taş ürünü. Terragolds kristal ve mineral koleksiyonunu inceleyin.`;

  return {
    title: `${category} | Terragolds`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${category} | Terragolds`,
      description,
      url,
      type: "website",
      images: [{ url: heroImage, alt: `${category} Terragolds` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${category} | Terragolds`,
      description,
      images: [heroImage],
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const [products, settings] = await Promise.all([
    readProducts(),
    readSettings(),
  ]);
  const categories = [...new Set(products.map((product) => product.category))];
  const category = findCategoryBySlug(categories, slug);
  const categoryProducts = category
    ? products.filter((product) => product.category === category)
    : [];

  return (
    <main className="category-page">
      <StoreSubpageHeader activeCategory={category} />
      <StoreTrustBar />

      <section className="category-hero section-shell">
        <div className="category-breadcrumb">
          <Link href="/">Ana Sayfa</Link>
          <span>/</span>
          <Link href="/#shop">Ürünler</Link>
          <span>/</span>
          <b>{category ?? "Kategori bulunamadı"}</b>
        </div>
        <p className="eyebrow">Koleksiyon</p>
        <h1>{category ?? "Kategori bulunamadı"}</h1>
        <p>
          {category
            ? `${categoryProducts.length} seçilmiş parça. Doğal form, yüzey ve renk karakteri korunmuş ürünleri inceleyin.`
            : "Aradığınız kategori bulunamadı. Tüm ürünlere geri dönebilirsiniz."}
        </p>
      </section>

      {category ? (
        <section className="category-products section-shell">
          <div className="category-grid">
            {categoryProducts.map((product) => {
              const currentPrice = getDiscountedPrice(product);
              return (
                <article className="category-product-card" key={product.id}>
                  <Link
                    className={`category-product-image${
                      product.hoverImage ? " has-hover-image" : ""
                    }`}
                    href={`/products/${product.slug || product.id}`}
                    aria-label={`${product.name} detaylarını gör`}
                  >
                    {product.stock > 0 && product.stock <= 3 ? (
                      <span>Son parçalar</span>
                    ) : product.discountPercent > 0 ? (
                      <span>%{product.discountPercent} indirim</span>
                    ) : product.badge ? (
                      <em>{product.badge}</em>
                    ) : null}
                    {product.hoverImage && (
                      <>
                        <i className="product-hover-zone left" />
                        <i className="product-hover-zone right" />
                      </>
                    )}
                    <img
                      className="product-hover-image primary"
                      src={product.image}
                      alt={product.name}
                    />
                    {product.hoverImage && (
                      <img
                        className="product-hover-image secondary"
                        src={product.hoverImage}
                        alt=""
                      />
                    )}
                    {product.hoverImage && (
                      <span className="product-image-progress" aria-hidden="true">
                        <i className="left" />
                        <i className="right" />
                      </span>
                    )}
                  </Link>
                  <div className="category-product-copy">
                    <small>{product.stone}</small>
                    <Link href={`/products/${product.slug || product.id}`}>{product.name}</Link>
                    <p>{product.description}</p>
                    <div className="category-product-price">
                      {product.discountPercent > 0 && (
                        <del>{money.format(product.price)}</del>
                      )}
                      <strong>{money.format(currentPrice)}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="category-products section-shell">
          <Link className="button button-dark" href="/#shop">
            Tüm ürünlere dön
          </Link>
        </section>
      )}
      <StoreSiteFooter
        businessName={settings.businessName}
        address={[settings.address, settings.district, settings.city]
          .filter(Boolean)
          .join(", ")}
      />
      <FloatingSocialLinks />
    </main>
  );
}
