"use client";

import { useMemo, useState } from "react";
import { optimizedImageUrl } from "../../lib/image-transform";
import { buildPageWindow } from "../../lib/pagination";
import type { Product } from "../../lib/store-data";

// XML tedarikçi senkronunun taslak olarak eklediği, henüz incelenmemiş
// ürünler (status = 'draft' + xml_sync_status = 'synced' - bkz.
// lib/xml-sync/syncSupplier.ts). Elle eklenen ürünler hiç 'synced' olmaz.
// Stoğu 0 olanlar burada değil "Stoğu Bitenler"de durur - yayına alınsa bile
// satılamazlar; tedarikçi stoğu geri gelince senkronla buraya geri düşerler.
export function isNewXmlProduct(product: Product): boolean {
  return product.status === "draft" && Boolean(product.xmlSynced) && product.stock > 0;
}

const PER_PAGE = 20;

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

function formatArrival(createdAt?: string): string {
  if (!createdAt) return "";
  const date = new Date(`${createdAt.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

async function readResponse(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    updated?: number;
    error?: string;
  };
  if (!response.ok) throw new Error(body.error || "İşlem tamamlanamadı.");
  return body;
}

export default function XmlNewProductsPanel({
  products,
  onOpenProduct,
  onChanged,
  onNotice,
}: {
  products: Product[];
  onOpenProduct: (product: Product) => void;
  onChanged: () => Promise<void> | void;
  onNotice: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const newProducts = useMemo(
    () => products.filter(isNewXmlProduct).sort((a, b) => b.id - a.id),
    [products],
  );
  const normalizedSearch = search.trim().toLocaleLowerCase("tr-TR");
  const filtered = normalizedSearch
    ? newProducts.filter((product) =>
        [product.name, product.category, product.xmlExternalId ?? ""]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(normalizedSearch),
      )
    : newProducts;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const visibleIds = visible.map((product) => product.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggle = (id: number) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const run = async (action: "publish" | "delete", ids: number[]) => {
    if (!ids.length) return;
    if (
      action === "delete" &&
      !window.confirm(
        `${ids.length} ürün silinsin mi? Silinen ürünler tedarikçi senkronuyla bir daha geri gelmez.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = await readResponse(
        await fetch("/api/admin/products/bulk", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, productIds: ids }),
        }),
      );
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      await onChanged();
      const count = Number(body.updated ?? ids.length);
      onNotice(action === "publish" ? `${count} ürün yayına alındı.` : `${count} ürün silindi.`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-xml-new-panel">
      <section className="admin-xml-new-intro">
        <p>
          XML tedarikçisinden <strong>taslak olarak</strong> gelen, henüz
          incelemediğiniz ürünler. Sitede ve pazaryerlerinde görünmezler;
          siz yayına alana kadar satışa çıkmazlar. Yayına aldığınız ya da
          sildiğiniz ürün bu listeden çıkar.
        </p>
        <strong>{newProducts.length} ürün bekliyor</strong>
      </section>

      {error && (
        <div className="admin-alert error" role="alert">
          <span>!</span>
          <p>{error}</p>
        </div>
      )}

      <section className="admin-xml-new-toolbar">
        <label className="admin-product-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Ürün adı, kategori veya ürün kodu ara"
            aria-label="Yeni gelen ürünlerde ara"
          />
        </label>
        <span>
          {selectedIds.length ? `${selectedIds.length} ürün seçildi` : "Toplu işlem için ürün seçin"}
        </span>
        <button
          type="button"
          className="admin-primary-button"
          disabled={busy || !selectedIds.length}
          onClick={() => void run("publish", selectedIds)}
        >
          Seçilenleri yayına al
        </button>
        <button
          type="button"
          className="admin-danger-button"
          disabled={busy || !selectedIds.length}
          onClick={() => void run("delete", selectedIds)}
        >
          Seçilenleri sil
        </button>
      </section>

      {filtered.length === 0 ? (
        <p className="admin-xml-new-empty">
          {newProducts.length === 0
            ? "İncelenmeyi bekleyen yeni ürün yok."
            : "Aramanızla eşleşen ürün yok."}
        </p>
      ) : (
        <>
          <label className="admin-xml-new-select-all">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={() =>
                setSelectedIds((current) =>
                  allVisibleSelected
                    ? current.filter((id) => !visibleIds.includes(id))
                    : [...new Set([...current, ...visibleIds])],
                )
              }
            />
            Bu sayfadakilerin tümünü seç
          </label>
          <ul className="admin-xml-new-list">
            {visible.map((product) => (
              <li key={product.id} className={selectedIds.includes(product.id) ? "selected" : ""}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(product.id)}
                  onChange={() => toggle(product.id)}
                  aria-label={`${product.name} seç`}
                />
                <button
                  type="button"
                  className="admin-xml-new-image"
                  onClick={() => onOpenProduct(product)}
                  aria-label={`${product.name} ürününü incele`}
                >
                  {product.image ? (
                    <img src={optimizedImageUrl(product.image, 240)} alt="" loading="lazy" />
                  ) : (
                    <span>Görsel yok</span>
                  )}
                </button>
                <div className="admin-xml-new-info">
                  <strong>{product.name}</strong>
                  <small>
                    {product.category}
                    {product.xmlExternalId ? ` · Kod: ${product.xmlExternalId}` : ""}
                  </small>
                  <small>
                    Satış: <b>{money.format(product.price)}</b>
                    {product.cost > 0 && <> · Maliyet: {money.format(product.cost)}</>}
                    {" · "}Stok: {product.stock}
                  </small>
                  <small className="admin-xml-new">Geliş: {formatArrival(product.createdAt)}</small>
                </div>
                <div className="admin-xml-new-actions">
                  <button
                    type="button"
                    className="admin-primary-button"
                    disabled={busy}
                    onClick={() => void run("publish", [product.id])}
                  >
                    Yayına al
                  </button>
                  <button type="button" disabled={busy} onClick={() => onOpenProduct(product)}>
                    İncele / Düzenle
                  </button>
                  <button
                    type="button"
                    className="admin-danger-button"
                    disabled={busy}
                    onClick={() => void run("delete", [product.id])}
                  >
                    Sil
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {pageCount > 1 && (
            <nav className="admin-xml-new-pagination" aria-label="Sayfalar">
              {buildPageWindow(safePage, pageCount).map((item, index) =>
                typeof item === "number" ? (
                  <button
                    key={item}
                    type="button"
                    className={item === safePage ? "active" : ""}
                    onClick={() => setPage(item)}
                  >
                    {item}
                  </button>
                ) : (
                  <span key={`gap-${index}`}>…</span>
                ),
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
