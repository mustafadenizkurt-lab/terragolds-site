"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StoreSubpageHeader from "../store-subpage-header";
import StoreSiteFooter from "../store-site-footer";
import QuickAddToCart from "../quick-add-to-cart";
import { getDiscountedPrice, type Product } from "../../lib/store-data";
import { useLanguage } from "../../lib/language-client";
import { decodeHtmlEntities } from "../../lib/text-utils";
import {
  COMPARE_STORAGE_KEY,
  readCompareList,
} from "../compare-toggle-button";

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const copy = {
  tr: {
    eyebrow: "Yan yana inceleyin",
    title: "Ürün Karşılaştır",
    subtitle:
      "Karşılaştırma listenize eklediğiniz ürünlerin fiyat, taş ve stok bilgilerini tek ekranda görün.",
    preparing: "Karşılaştırma listeniz hazırlanıyor…",
    emptyTitle: "Karşılaştırma listeniz henüz boş",
    emptyDetailBefore: 'Ürün kartlarındaki "',
    compareButtonLabel: "Karşılaştır",
    emptyDetailAfter:
      '" düğmesine dokunarak en fazla 4 ürünü yan yana inceleyebilirsiniz.',
    discoverProducts: "Ürünleri keşfet",
    comparingCount: (count: number) => `${count} ürün karşılaştırılıyor`,
    clearAll: "Tümünü temizle",
    removeFromCompare: (name: string) => `${name} ürününü karşılaştırmadan çıkar`,
    price: "Fiyat",
    category: "Kategori",
    stoneType: "Taş türü",
    rating: "Değerlendirme",
    noReviewsYet: "Henüz yorum yok",
    stockStatus: "Stok durumu",
    lastUnits: (stock: number) => `Son ${stock} adet`,
    inStock: "Stokta",
    outOfStock: "Tükendi",
    description: "Açıklama",
  },
  en: {
    eyebrow: "Compare side by side",
    title: "Compare Products",
    subtitle:
      "See the price, stone and stock details of the products you've added to your comparison list, all on one screen.",
    preparing: "Preparing your comparison list…",
    emptyTitle: "Your comparison list is empty",
    emptyDetailBefore: 'Tap the "',
    compareButtonLabel: "Compare",
    emptyDetailAfter: '" button on product cards to compare up to 4 products side by side.',
    discoverProducts: "Discover products",
    comparingCount: (count: number) => `Comparing ${count} products`,
    clearAll: "Clear all",
    removeFromCompare: (name: string) => `Remove ${name} from comparison`,
    price: "Price",
    category: "Category",
    stoneType: "Stone type",
    rating: "Rating",
    noReviewsYet: "No reviews yet",
    stockStatus: "Stock status",
    lastUnits: (stock: number) => `${stock} left`,
    inStock: "In stock",
    outOfStock: "Sold out",
    description: "Description",
  },
} as const;

function stars(rating: number) {
  return "★★★★★".slice(0, rating) + "☆☆☆☆☆".slice(rating);
}

export default function CompareClient({
  businessName,
  businessAddress,
  phone,
  whatsapp,
  email,
  instagram,
  facebook,
  tiktok,
}: {
  businessName?: string;
  businessAddress?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
} = {}) {
  const [language] = useLanguage();
  const t = copy[language];
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refresh = () => setCompareIds(readCompareList());
    refresh();
    window.addEventListener("terragolds-storage", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("terragolds-storage", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (compareIds.length === 0) {
      Promise.resolve().then(() => {
        setProducts([]);
        setLoading(false);
      });
      return;
    }
    fetch(`/api/products-by-ids?ids=${compareIds.join(",")}`, {
      cache: "no-store",
    })
      .then((response) => response.json() as Promise<{ products?: Product[] }>)
      .then((payload) => {
        // Keep the compare-list order, not the API's - a customer expects
        // the column order to match the order they added products in.
        const byId = new Map(
          (payload.products ?? []).map((product) => [product.id, product]),
        );
        setProducts(
          compareIds
            .map((id) => byId.get(id))
            .filter((product): product is Product => Boolean(product)),
        );
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [compareIds]);

  const removeProduct = (productId: number) => {
    const next = compareIds.filter((id) => id !== productId);
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("terragolds-storage"));
  };

  const clearAll = () => {
    window.localStorage.removeItem(COMPARE_STORAGE_KEY);
    window.dispatchEvent(new Event("terragolds-storage"));
  };

  return (
    <main className="compare-page">
      <StoreSubpageHeader />
      <section className="compare-content section-shell">
        <div className="compare-title">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <span>{t.subtitle}</span>
        </div>

        {loading ? (
          <div className="compare-empty">{t.preparing}</div>
        ) : products.length === 0 ? (
          <div className="compare-empty">
            <span aria-hidden="true">⇄</span>
            <h2>{t.emptyTitle}</h2>
            <p>
              {t.emptyDetailBefore}
              {t.compareButtonLabel}
              {t.emptyDetailAfter}
            </p>
            <Link href="/#shop">{t.discoverProducts}</Link>
          </div>
        ) : (
          <>
            <div className="compare-toolbar">
              <span>{t.comparingCount(products.length)}</span>
              <button type="button" onClick={clearAll}>
                {t.clearAll}
              </button>
            </div>
            <div className="compare-table-scroll">
              <table
                className="compare-table"
                style={{ ["--compare-columns" as string]: products.length }}
              >
                <thead>
                  <tr>
                    <th scope="col" className="compare-row-label" />
                    {products.map((product) => (
                      <th scope="col" key={product.id}>
                        <button
                          type="button"
                          className="compare-remove"
                          onClick={() => removeProduct(product.id)}
                          aria-label={t.removeFromCompare(product.name)}
                        >
                          ×
                        </button>
                        <Link href={`/products/${product.slug || product.id}`}>
                          <img src={product.image} alt={product.name} loading="lazy" />
                          <strong>{product.name}</strong>
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">{t.price}</th>
                    {products.map((product) => (
                      <td key={product.id}>
                        {product.discountPercent > 0 && (
                          <del>{money.format(product.price)}</del>
                        )}
                        <strong>{money.format(getDiscountedPrice(product))}</strong>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">{t.category}</th>
                    {products.map((product) => (
                      <td key={product.id}>{product.category}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">{t.stoneType}</th>
                    {products.map((product) => (
                      <td key={product.id}>{product.stone || "—"}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">{t.rating}</th>
                    {products.map((product) => (
                      <td key={product.id}>
                        {product.reviewCount ? (
                          <>
                            {stars(Math.round(product.reviewAverage ?? 0))}{" "}
                            <small>({product.reviewCount})</small>
                          </>
                        ) : (
                          t.noReviewsYet
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">{t.stockStatus}</th>
                    {products.map((product) => (
                      <td
                        key={product.id}
                        className={product.stock > 0 ? "in-stock" : "out-of-stock"}
                      >
                        {product.stock > 0
                          ? product.stock <= 3
                            ? t.lastUnits(product.stock)
                            : t.inStock
                          : t.outOfStock}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">{t.description}</th>
                    {products.map((product) => (
                      <td key={product.id} className="compare-description">
                        {decodeHtmlEntities(product.description)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" />
                    {products.map((product) => (
                      <td key={product.id}>
                        <QuickAddToCart product={product} />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <StoreSiteFooter
        businessName={businessName}
        address={businessAddress}
        phone={phone}
        whatsapp={whatsapp}
        email={email}
        instagram={instagram}
        facebook={facebook}
        tiktok={tiktok}
      />
    </main>
  );
}
