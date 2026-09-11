"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StoreSubpageHeader from "../store-subpage-header";
import StoreSiteFooter from "../store-site-footer";
import QuickAddToCart from "../quick-add-to-cart";
import { getDiscountedPrice, type Product } from "../../lib/store-data";
import {
  COMPARE_STORAGE_KEY,
  readCompareList,
} from "../compare-toggle-button";

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

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
          <p className="eyebrow">Yan yana inceleyin</p>
          <h1>Ürün Karşılaştır</h1>
          <span>
            Karşılaştırma listenize eklediğiniz ürünlerin fiyat, taş ve stok
            bilgilerini tek ekranda görün.
          </span>
        </div>

        {loading ? (
          <div className="compare-empty">Karşılaştırma listeniz hazırlanıyor…</div>
        ) : products.length === 0 ? (
          <div className="compare-empty">
            <span aria-hidden="true">⇄</span>
            <h2>Karşılaştırma listeniz henüz boş</h2>
            <p>
              Ürün kartlarındaki &ldquo;Karşılaştır&rdquo; düğmesine dokunarak
              en fazla 4 ürünü yan yana inceleyebilirsiniz.
            </p>
            <Link href="/#shop">Ürünleri keşfet</Link>
          </div>
        ) : (
          <>
            <div className="compare-toolbar">
              <span>{products.length} ürün karşılaştırılıyor</span>
              <button type="button" onClick={clearAll}>
                Tümünü temizle
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
                          aria-label={`${product.name} ürününü karşılaştırmadan çıkar`}
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
                    <th scope="row">Fiyat</th>
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
                    <th scope="row">Kategori</th>
                    {products.map((product) => (
                      <td key={product.id}>{product.category}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Taş türü</th>
                    {products.map((product) => (
                      <td key={product.id}>{product.stone || "—"}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Değerlendirme</th>
                    {products.map((product) => (
                      <td key={product.id}>
                        {product.reviewCount ? (
                          <>
                            {stars(Math.round(product.reviewAverage ?? 0))}{" "}
                            <small>({product.reviewCount})</small>
                          </>
                        ) : (
                          "Henüz yorum yok"
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Stok durumu</th>
                    {products.map((product) => (
                      <td
                        key={product.id}
                        className={product.stock > 0 ? "in-stock" : "out-of-stock"}
                      >
                        {product.stock > 0
                          ? product.stock <= 3
                            ? `Son ${product.stock} adet`
                            : "Stokta"
                          : "Tükendi"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Açıklama</th>
                    {products.map((product) => (
                      <td key={product.id} className="compare-description">
                        {product.description}
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
