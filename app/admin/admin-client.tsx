"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PaymentProvidersPanel from "./payment-providers-panel";
import DiscountCodesPanel from "./discount-codes-panel";
import ReturnRequestsPanel from "./return-requests-panel";
import DashboardOverview from "./dashboard-overview";
import ShippingPanel from "./shipping-panel";
import ShippingTrackingSettingsPanel from "./shipping-tracking-settings";
import CategoriesPanel from "./categories-panel";
import ContentManagementPanel from "./content-management-panel";
import SystemTestCenter from "./system-test-center";
import CustomersPanel from "./customers-panel";
import OperationsPanel from "./operations-panel";
import ReportsPanel from "./reports-panel";
import MediaLibraryPanel from "./media-library-panel";
import SavedCardsPanel from "./saved-cards-panel";
import SupplierImportPanel from "./supplier-import-panel";
import XmlSuppliersPanel from "./xml-suppliers-panel";
import XmlCodeBackfillPanel from "./xml-code-backfill-panel";
import {
  defaultSettings,
  getDiscountedPrice,
  type Product,
  type StoreSettings,
} from "../../lib/store-data";
import type {
  AdminDashboardData,
  DashboardPeriod,
} from "../../lib/admin-dashboard-types";
import type { ProductCategory } from "../../lib/category-types";
import { buildPageWindow } from "../../lib/pagination";

type AdminView =
  | "overview"
  | "products"
  | "editor"
  | "categories"
  | "content"
  | "supplierImport"
  | "xmlSuppliers"
  | "xmlPricing"
  | "xmlLogs"
  | "skuBackfill"
  | "customers"
  | "operations"
  | "reports"
  | "media"
  | "savedCards"
  | "shipping"
  | "payments"
  | "discounts"
  | "returnRequests"
  | "tests"
  | "settings";

type ProductDraft = Omit<Product, "id"> & { id?: number };

const PRODUCTS_PER_PAGE = 10;

const emptyProduct: ProductDraft = {
  name: "",
  stone: "",
  category: "",
  price: 0,
  cost: 0,
  stock: 1,
  image: "/stone-collection.jpg",
  hoverImage: "",
  badge: "",
  campaignLabel: "",
  discountPercent: 0,
  description: "",
  status: "draft",
  shopierUrl: "",
  shopierProductId: "",
  shopierSyncStatus: "manual",
  slug: "",
  metaTitle: "",
  metaDescription: "",
  featured: false,
  sortOrder: 0,
};

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

async function readJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(body.error ?? "İşlem tamamlanamadı."));
  }
  return body;
}

export default function AdminClient({
  user,
}: {
  user: { name: string; email: string };
}) {
  const [view, setView] = useState<AdminView>("overview");
  const [editSupplierId, setEditSupplierId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] =
    useState<StoreSettings>(defaultSettings);
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [dashboardPeriod, setDashboardPeriod] =
    useState<DashboardPeriod>("week");
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(emptyProduct);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("publish");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkLabel, setBulkLabel] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productStatusFilter, setProductStatusFilter] = useState("all");
  const [productPage, setProductPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadAdminData = async () => {
    setLoading(true);
    setError("");
    try {
      const [
        productsResponse,
        settingsResponse,
        dashboardResponse,
        categoriesResponse,
      ] =
        await Promise.all([
          fetch("/api/admin/products", { cache: "no-store" }),
          fetch("/api/admin/settings", { cache: "no-store" }),
          fetch("/api/admin/dashboard?period=week", {
            cache: "no-store",
          }),
          fetch("/api/admin/categories", { cache: "no-store" }),
        ]);
      const productsBody = await readJson(productsResponse);
      const settingsBody = await readJson(settingsResponse);
      const dashboardBody = await readJson(dashboardResponse);
      const categoriesBody = await readJson(categoriesResponse);
      setProducts((productsBody.products as Product[]) ?? []);
      setCategories(
        (categoriesBody.categories as ProductCategory[]) ?? [],
      );
      setSettings(
        (settingsBody.settings as StoreSettings) ?? defaultSettings,
      );
      setDashboard(
        (dashboardBody.dashboard as AdminDashboardData) ?? null,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Yönetim verileri alınamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The initial request hydrates the protected panel from durable store data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAdminData();
  }, []);

  const loadDashboard = async (period = dashboardPeriod) => {
    setDashboardLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/dashboard?period=${period}`,
        { cache: "no-store" },
      );
      const body = await readJson(response);
      setDashboard((body.dashboard as AdminDashboardData) ?? null);
      setDashboardPeriod(period);
    } catch (dashboardError) {
      setError(
        dashboardError instanceof Error
          ? dashboardError.message
          : "Yönetim özeti güncellenemedi.",
      );
    } finally {
      setDashboardLoading(false);
    }
  };

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

  const openNewProduct = () => {
    setDraft({
      ...emptyProduct,
      sortOrder: products.length + 1,
    });
    setView("editor");
  };

  const openProduct = (product: Product) => {
    setDraft({ ...product });
    setView("editor");
  };

  const openNewProductInCategory = (categoryName: string) => {
    setDraft({
      ...emptyProduct,
      category: categoryName,
      sortOrder: products.length + 1,
    });
    setView("editor");
  };

  const duplicateProduct = (product: Product) => {
    setDraft({
      ...product,
      id: undefined,
      name: `${product.name} Kopya`,
      status: "draft",
      sortOrder: products.length + 1,
      // A fresh slug is generated on save — copying the original's would collide.
      slug: "",
    });
    setView("editor");
    flash("Ürün kopyalandı, taslak olarak düzenleyebilirsiniz.");
  };

  const quickUpdateStock = async (product: Product, nextStock: number) => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...product,
          stock: Math.max(0, nextStock),
        }),
      });
      await readJson(response);
      await loadAdminData();
      flash(`${product.name} stoku güncellendi.`);
    } catch (stockError) {
      setError(
        stockError instanceof Error
          ? stockError.message
          : "Stok güncellenemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        draft.id ? `/api/admin/products/${draft.id}` : "/api/admin/products",
        {
          method: draft.id ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      await readJson(response);
      await loadAdminData();
      setView("products");
      flash(draft.id ? "Ürün güncellendi." : "Yeni ürün oluşturuldu.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Ürün kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    if (
      !window.confirm(
        `${product.name} kalıcı olarak silinecek. Devam edilsin mi?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "DELETE",
      });
      await readJson(response);
      await loadAdminData();
      flash("Ürün silindi.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Ürün silinemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const applyBulkUpdate = async () => {
    if (!selectedProductIds.length) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/products/bulk", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productIds: selectedProductIds,
          action: bulkAction,
          value: bulkValue ? Number(bulkValue) : undefined,
          label: bulkLabel,
          category: bulkCategory,
        }),
      });
      const body = await readJson(response);
      await loadAdminData();
      setSelectedProductIds([]);
      setBulkValue("");
      setBulkLabel("");
      setBulkCategory("");
      flash(`${Number(body.updated ?? 0)} ürün toplu olarak güncellendi.`);
    } catch (bulkError) {
      setError(
        bulkError instanceof Error
          ? bulkError.message
          : "Toplu ürün işlemi tamamlanamadı.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (
    event: React.FormEvent<HTMLFormElement>,
    successMessage = "İletişim ve mağaza ayarları yayınlandı.",
  ) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const body = await readJson(response);
      setSettings(body.settings as StoreSettings);
      flash(successMessage);
    } catch (settingsError) {
      setError(
        settingsError instanceof Error
          ? settingsError.message
          : "Ayarlar kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (
    event: React.ChangeEvent<HTMLInputElement>,
    target: "image" | "hoverImage" = "image",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const body = await readJson(response);
      setDraft((current) => ({ ...current, [target]: String(body.url) }));
      flash(target === "image" ? "Ürün görseli yüklendi." : "İkinci görsel yüklendi.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Görsel yüklenemedi.",
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const normalizedProductSearch = productSearch
    .trim()
    .toLocaleLowerCase("tr-TR");
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      !normalizedProductSearch ||
      [product.name, product.stone, product.category]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(normalizedProductSearch);
    const matchesCategory =
      productCategoryFilter === "all" ||
      product.category === productCategoryFilter;
    const matchesStatus =
      productStatusFilter === "all" ||
      product.status === productStatusFilter ||
      (productStatusFilter === "low-stock" && product.stock <= 2);
    return matchesSearch && matchesCategory && matchesStatus;
  });
  const productPageCount = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE),
  );
  const safeProductPage = Math.min(productPage, productPageCount);
  const productPageWindow = buildPageWindow(
    safeProductPage,
    productPageCount,
  );
  const productPageStart = (safeProductPage - 1) * PRODUCTS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(
    productPageStart,
    productPageStart + PRODUCTS_PER_PAGE,
  );
  const visibleProductIds = paginatedProducts.map((product) => product.id);
  const allVisibleProductsSelected =
    visibleProductIds.length > 0 &&
    visibleProductIds.every((id) => selectedProductIds.includes(id));

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/" aria-label="Terragolds mağaza">
          <div>
            <strong>
              <span>TERRA</span>GOLDS
            </strong>
            <small>Yönetim merkezi</small>
          </div>
        </Link>

        <nav className="admin-nav" aria-label="Yönetim menüsü">
          <button
            type="button"
            className={view === "overview" ? "active" : ""}
            onClick={() => setView("overview")}
          >
            <span>⌂</span> Genel bakış
          </button>
          <button
            type="button"
            className={
              view === "products" || view === "editor" ? "active" : ""
            }
            onClick={() => setView("products")}
          >
            <span>◇</span> Ürünler
          </button>
          <button
            type="button"
            className={view === "customers" ? "active" : ""}
            onClick={() => setView("customers")}
          >
            <span>◎</span> Müşteriler
          </button>
          <button
            type="button"
            className={view === "categories" ? "active" : ""}
            onClick={() => setView("categories")}
          >
            <span>⌗</span> Kategoriler
          </button>
          <button
            type="button"
            className={view === "content" ? "active" : ""}
            onClick={() => setView("content")}
          >
            <span>≡</span> İçerik yönetimi
          </button>
          <button
            type="button"
            className={view === "media" ? "active" : ""}
            onClick={() => setView("media")}
          >
            <span>▧</span> Medya
          </button>
          <button
            type="button"
            className={view === "supplierImport" ? "active" : ""}
            onClick={() => setView("supplierImport")}
          >
            <span>⇪</span> Tedarikçi İçe Aktarma
          </button>
          <button type="button" className={view === "xmlSuppliers" ? "active" : ""} onClick={() => setView("xmlSuppliers")}>
            <span>⌁</span> XML tedarikçileri
          </button>
          <button type="button" className={view === "xmlPricing" ? "active" : ""} onClick={() => setView("xmlPricing")}>
            <span>₺</span> XML fiyat kuralları
          </button>
          <button type="button" className={view === "xmlLogs" ? "active" : ""} onClick={() => setView("xmlLogs")}>
            <span>▤</span> XML senkron geçmişi
          </button>
          <button type="button" className={view === "skuBackfill" ? "active" : ""} onClick={() => setView("skuBackfill")}>
            <span>#</span> Ürün Kodu Eşleştirme
          </button>
          <button
            type="button"
            className={view === "reports" ? "active" : ""}
            onClick={() => setView("reports")}
          >
            <span>▥</span> Raporlar
          </button>
          <button
            type="button"
            className={view === "operations" ? "active" : ""}
            onClick={() => setView("operations")}
          >
            <span>!</span> Uyarılar
          </button>
          <button
            type="button"
            className={view === "shipping" ? "active" : ""}
            onClick={() => setView("shipping")}
          >
            <span>□</span> Kargo
            {(dashboard?.summary.awaitingShipment ?? 0) > 0 && (
              <b className="admin-nav-badge">
                {dashboard?.summary.awaitingShipment}
              </b>
            )}
          </button>
          <button
            type="button"
            className={view === "discounts" ? "active" : ""}
            onClick={() => setView("discounts")}
          >
            <span>％</span> İndirim kodları
          </button>
          <button
            type="button"
            className={view === "returnRequests" ? "active" : ""}
            onClick={() => setView("returnRequests")}
          >
            <span>↺</span> İade talepleri
          </button>
          <button
            type="button"
            className={view === "payments" ? "active" : ""}
            onClick={() => setView("payments")}
          >
            <span>◇</span> Ödeme yöntemleri
          </button>
          <button
            type="button"
            className={view === "savedCards" ? "active" : ""}
            onClick={() => setView("savedCards")}
          >
            <span>▣</span> Kayıtlı kartlar
          </button>
          <button
            type="button"
            className={view === "tests" ? "active" : ""}
            onClick={() => setView("tests")}
          >
            <span>✓</span> Sistem test merkezi
          </button>
          <button
            type="button"
            className={view === "settings" ? "active" : ""}
            onClick={() => setView("settings")}
          >
            <span>⚙</span> Ayarlar
          </button>
        </nav>

        <div className="admin-sidebar-bottom">
          <Link href="/" target="_blank" rel="noreferrer">
            Mağazayı görüntüle <span>↗</span>
          </Link>
          <div className="admin-user">
            <span>{user.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <button
            className="admin-signout"
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.assign("/login");
            }}
          >
            Çıkış yap
          </button>
        </div>
      </aside>

      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <p>Terragolds yönetim paneli</p>
            <h1>
              {view === "overview" && "Genel bakış"}
              {view === "products" && "Ürünler"}
              {view === "editor" &&
                (draft.id ? "Ürünü düzenle" : "Yeni ürün")}
              {view === "categories" && "Kategoriler"}
              {view === "content" && "İçerik yönetimi"}
              {view === "supplierImport" && "Tedarikçi İçe Aktarma"}
              {view === "xmlSuppliers" && "XML tedarikçileri"}
              {view === "xmlPricing" && "XML fiyatlandırma kuralları"}
              {view === "xmlLogs" && "XML senkron geçmişi"}
              {view === "skuBackfill" && "Ürün Kodu Eşleştirme"}
              {view === "shipping" && "Kargo yönetimi"}
              {view === "payments" && "Ödeme yöntemleri"}
              {view === "discounts" && "İndirim kodları"}
              {view === "returnRequests" && "İade talepleri"}
              {view === "tests" && "Sistem test merkezi"}
              {view === "settings" && "Mağaza ayarları"}
              {view === "customers" && "Müşteriler"}
              {view === "media" && "Medya kütüphanesi"}
              {view === "reports" && "Raporlar"}
              {view === "operations" && "Operasyon uyarıları"}
              {view === "savedCards" && "Kayıtlı kartlar"}
            </h1>
          </div>
          {view === "products" && (
            <button
              className="admin-primary-button"
              type="button"
              onClick={openNewProduct}
            >
              <span>＋</span> Yeni ürün
            </button>
          )}
        </header>

        {error && (
          <div className="admin-alert error" role="alert">
            <span>!</span>
            <p>{error}</p>
            <button type="button" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}

        {loading ? (
          <div className="admin-loading">
            <span />
            <p>Mağaza bilgileri hazırlanıyor…</p>
          </div>
        ) : (
          <>
            {view === "overview" && dashboard && (
              <DashboardOverview
                dashboard={dashboard}
                loading={dashboardLoading}
                onPeriodChange={(period) => void loadDashboard(period)}
                onResetPeriod={() => void loadDashboard("week")}
                onNavigateProducts={() => setView("products")}
                onNavigateShipping={() => setView("shipping")}
                onOpenProduct={(productId) => {
                  const product = products.find(
                    (item) => item.id === productId,
                  );
                  if (product) openProduct(product);
                }}
              />
            )}

            {view === "products" && (
              <div className="admin-products">
                <section className="admin-product-filters">
                  <label className="admin-product-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                      value={productSearch}
                      onChange={(event) => {
                        setProductSearch(event.target.value);
                        setProductPage(1);
                      }}
                      placeholder="Ürün adı, taş veya kategori ara"
                      aria-label="Ürünlerde ara"
                    />
                  </label>
                  <select
                    value={productCategoryFilter}
                    onChange={(event) => {
                      setProductCategoryFilter(event.target.value);
                      setProductPage(1);
                    }}
                    aria-label="Kategoriye göre filtrele"
                  >
                    <option value="all">Tüm kategoriler</option>
                    {categories.map((category) => (
                      <option value={category.name} key={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={productStatusFilter}
                    onChange={(event) => {
                      setProductStatusFilter(event.target.value);
                      setProductPage(1);
                    }}
                    aria-label="Duruma göre filtrele"
                  >
                    <option value="all">Tüm durumlar</option>
                    <option value="published">Yayında</option>
                    <option value="draft">Taslak</option>
                    <option value="low-stock">Düşük stok</option>
                  </select>
                  <span>
                    <strong>{filteredProducts.length}</strong> ürün
                  </span>
                </section>
                <section className="admin-bulk-toolbar">
                  <div>
                    <strong>Toplu ürün güncelleme</strong>
                    <span>
                      {selectedProductIds.length
                        ? `${selectedProductIds.length} ürün seçildi`
                        : "İşlem yapmak için ürünleri seçin"}
                    </span>
                  </div>
                  <select
                    value={bulkAction}
                    onChange={(event) => setBulkAction(event.target.value)}
                    aria-label="Toplu işlem"
                  >
                    <option value="publish">Yayına al</option>
                    <option value="draft">Taslağa taşı</option>
                    <option value="increase-stock">Stok değiştir</option>
                    <option value="set-discount">İndirim uygula</option>
                    <option value="clear-discount">İndirimi kaldır</option>
                    <option value="set-category">Kategoriye taşı</option>
                    <option value="feature">Öne çıkar</option>
                    <option value="unfeature">Öne çıkarmayı kaldır</option>
                  </select>
                  {(bulkAction === "increase-stock" ||
                    bulkAction === "set-discount") && (
                    <input
                      type="number"
                      value={bulkValue}
                      onChange={(event) => setBulkValue(event.target.value)}
                      placeholder={
                        bulkAction === "increase-stock"
                          ? "Örn. +5 veya -2"
                          : "İndirim %"
                      }
                      min={bulkAction === "set-discount" ? 1 : -1000}
                      max={bulkAction === "set-discount" ? 90 : 1000}
                      aria-label={
                        bulkAction === "increase-stock"
                          ? "Stok değişim miktarı"
                          : "İndirim yüzdesi"
                      }
                    />
                  )}
                  {bulkAction === "set-discount" && (
                    <input
                      value={bulkLabel}
                      onChange={(event) => setBulkLabel(event.target.value)}
                      placeholder="Kampanya etiketi"
                      aria-label="Kampanya etiketi"
                    />
                  )}
                  {bulkAction === "set-category" && (
                    <select
                      value={bulkCategory}
                      onChange={(event) =>
                        setBulkCategory(event.target.value)
                      }
                      aria-label="Taşınacak kategori"
                    >
                      <option value="">Kategori seçin</option>
                      {categories
                        .filter((category) => category.active)
                        .map((category) => (
                          <option value={category.name} key={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </select>
                  )}
                  <button
                    type="button"
                    disabled={
                      saving ||
                      !selectedProductIds.length ||
                      (bulkAction === "set-category" && !bulkCategory)
                    }
                    onClick={() => void applyBulkUpdate()}
                  >
                    Uygula
                  </button>
                </section>
                <div className="admin-product-head">
                  <label className="admin-product-select">
                    <input
                      type="checkbox"
                      checked={
                        allVisibleProductsSelected
                      }
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedProductIds((current) => [
                            ...new Set([...current, ...visibleProductIds]),
                          ]);
                        } else {
                          setSelectedProductIds((current) =>
                            current.filter(
                              (id) => !visibleProductIds.includes(id),
                            ),
                          );
                        }
                      }}
                      aria-label="Bu sayfadaki ürünleri seç"
                    />
                  </label>
                  <span>Ürün</span>
                  <span>Fiyat</span>
                  <span>Stok</span>
                  <span>Durum</span>
                  <span>Shopier</span>
                  <span />
                </div>
                {paginatedProducts.map((product) => (
                  <article className="admin-product-row" key={product.id}>
                    <label className="admin-product-select">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(product.id)}
                        onChange={(event) =>
                          setSelectedProductIds((current) =>
                            event.target.checked
                              ? [...new Set([...current, product.id])]
                              : current.filter((id) => id !== product.id),
                          )
                        }
                        aria-label={`${product.name} ürününü seç`}
                      />
                    </label>
                    <button
                      className="admin-product-main"
                      type="button"
                      onClick={() => openProduct(product)}
                    >
                      <img src={product.image} alt="" />
                      <span>
                        <strong>{product.name}</strong>
                        <small>{product.category} · {product.stone}</small>
                        {product.discountPercent > 0 && (
                          <em>
                            %{product.discountPercent} indirim ·{" "}
                            {product.campaignLabel || "İndirim Fırsatı"}
                          </em>
                        )}
                      </span>
                    </button>
                    <b className={product.discountPercent > 0 ? "admin-sale-price" : ""}>
                      {product.discountPercent > 0 && (
                        <small>{money.format(product.price)}</small>
                      )}
                      {money.format(getDiscountedPrice(product))}
                    </b>
                    <span
                      className={
                        product.stock <= 2 ? "admin-stock low" : "admin-stock"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => void quickUpdateStock(product, product.stock - 1)}
                        disabled={saving || product.stock <= 0}
                        aria-label={`${product.name} stok azalt`}
                      >
                        −
                      </button>
                      <b>{product.stock} adet</b>
                      <button
                        type="button"
                        onClick={() => void quickUpdateStock(product, product.stock + 1)}
                        disabled={saving}
                        aria-label={`${product.name} stok artır`}
                      >
                        +
                      </button>
                    </span>
                    <span
                      className={`admin-status ${product.status}`}
                    >
                      {product.status === "published" ? "Yayında" : "Taslak"}
                    </span>
                    <span
                      className={
                        product.shopierUrl
                          ? "admin-shopier connected"
                          : "admin-shopier"
                      }
                    >
                      {product.shopierUrl ? "Bağlı" : "Bekliyor"}
                    </span>
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        aria-label={`${product.name} ürününü düzenle`}
                        onClick={() => openProduct(product)}
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        aria-label={`${product.name} ürünü kopyala`}
                        onClick={() => duplicateProduct(product)}
                      >
                        Kopyala
                      </button>
                      <button
                        type="button"
                        className="danger"
                        aria-label={`${product.name} ürününü sil`}
                        onClick={() => void deleteProduct(product)}
                      >
                        Sil
                      </button>
                    </div>
                  </article>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="admin-empty">
                    <span>◇</span>
                    <h2>
                      {products.length
                        ? "Aramanızla eşleşen ürün yok"
                        : "Henüz ürün yok"}
                    </h2>
                    <p>
                      {products.length
                        ? "Filtreleri değiştirerek yeniden deneyin."
                        : "İlk doğal taşınızı mağazaya ekleyin."}
                    </p>
                    {!products.length && (
                      <button type="button" onClick={openNewProduct}>
                        Yeni ürün ekle
                      </button>
                    )}
                  </div>
                )}
                {filteredProducts.length > 0 && (
                  <footer className="admin-product-pagination">
                    <span>
                      {productPageStart + 1}–
                      {Math.min(
                        productPageStart + PRODUCTS_PER_PAGE,
                        filteredProducts.length,
                      )}{" "}
                      / {filteredProducts.length} ürün
                    </span>
                    <nav aria-label="Ürün sayfaları">
                      <button
                        type="button"
                        disabled={safeProductPage === 1}
                        onClick={() =>
                          setProductPage((current) =>
                            Math.max(1, current - 1),
                          )
                        }
                        aria-label="Önceki sayfa"
                      >
                        ‹
                      </button>
                      {productPageWindow.map((page) =>
                        typeof page === "number" ? (
                          <button
                            type="button"
                            className={
                              page === safeProductPage ? "active" : ""
                            }
                            key={page}
                            onClick={() => setProductPage(page)}
                            aria-current={
                              page === safeProductPage ? "page" : undefined
                            }
                          >
                            {page}
                          </button>
                        ) : (
                          <span
                            className="admin-product-pagination-ellipsis"
                            key={page}
                            aria-hidden="true"
                          >
                            …
                          </span>
                        ),
                      )}
                      <button
                        type="button"
                        disabled={safeProductPage === productPageCount}
                        onClick={() =>
                          setProductPage((current) =>
                            Math.min(productPageCount, current + 1),
                          )
                        }
                        aria-label="Sonraki sayfa"
                      >
                        ›
                      </button>
                    </nav>
                  </footer>
                )}
              </div>
            )}

            {view === "customers" && <CustomersPanel onNotice={flash} />}

            {view === "xmlSuppliers" && <XmlSuppliersPanel tab="suppliers" onNotice={flash} initialEditId={editSupplierId} onInitialEditConsumed={() => setEditSupplierId(null)} />}
            {view === "xmlPricing" && <XmlSuppliersPanel tab="pricing" onNotice={flash} onEditSupplier={id => { setEditSupplierId(id); setView("xmlSuppliers"); }} />}
            {view === "xmlLogs" && <XmlSuppliersPanel tab="logs" onNotice={flash} />}
            {view === "skuBackfill" && <XmlCodeBackfillPanel onNotice={flash} />}

            {view === "operations" && (
              <OperationsPanel
                onNavigate={(target) => setView(target)}
              />
            )}

            {view === "reports" && (
              <ReportsPanel
                dashboard={dashboard}
                loading={dashboardLoading}
                onPeriodChange={loadDashboard}
              />
            )}

            {view === "media" && (
              <MediaLibraryPanel
                products={products}
                categories={categories}
                onOpenProduct={(productId) => {
                  const product = products.find((item) => item.id === productId);
                  if (product) openProduct(product);
                }}
              />
            )}

            {view === "shipping" && (
              <ShippingPanel onChanged={loadDashboard} />
            )}

            {view === "categories" && (
              <CategoriesPanel
                categories={categories}
                onChanged={(nextCategories) => {
                  setCategories(nextCategories);
                  void loadAdminData();
                }}
                onNotice={flash}
                onAddProduct={openNewProductInCategory}
              />
            )}

            {view === "content" && (
              <ContentManagementPanel onNotice={flash} />
            )}

            {view === "editor" && (
              <form className="admin-form" onSubmit={saveProduct}>
                <div className="admin-editor-grid">
                  <div className="admin-form-main">
                    <section className="admin-panel">
                      <div className="admin-form-section-title">
                        <span>01</span>
                        <div>
                          <h2>Ürün bilgileri</h2>
                          <p>Müşterinin mağazada göreceği temel bilgiler.</p>
                        </div>
                      </div>
                      <div className="admin-field-grid">
                        <label className="admin-field full">
                          <span>Ürün adı</span>
                          <input
                            value={draft.name}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                name: event.target.value,
                              })
                            }
                            placeholder="Örn. Ametist Kristal Küme"
                            required
                          />
                        </label>
                        <label className="admin-field">
                          <span>Taş türü</span>
                          <input
                            value={draft.stone}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                stone: event.target.value,
                              })
                            }
                            placeholder="Ametist"
                          />
                        </label>
                        <label className="admin-field">
                          <span>Kategori</span>
                          <select
                            value={draft.category}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                category: event.target.value,
                              })
                            }
                            required
                          >
                            {!categories.some(
                              (category) =>
                                category.name === draft.category,
                            ) && (
                              <option value={draft.category}>
                                {draft.category}
                              </option>
                            )}
                            {categories
                              .filter(
                                (category) =>
                                  category.active ||
                                  category.name === draft.category,
                              )
                              .map((category) => (
                                <option
                                  value={category.name}
                                  key={category.id}
                                >
                                  {category.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="admin-field">
                          <span>Fiyat (TL)</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.price}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                price: Number(event.target.value),
                              })
                            }
                            required
                          />
                        </label>
                        <label className="admin-field">
                          <span>Maliyet (TL, opsiyonel)</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.cost || ""}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                cost: Number(event.target.value) || 0,
                              })
                            }
                            placeholder="Kâr marjı hesaplaması için"
                          />
                        </label>
                        <label className="admin-field">
                          <span>Stok adedi</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.stock}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                stock: Number(event.target.value),
                              })
                            }
                            required
                          />
                        </label>
                        <label className="admin-field">
                          <span>Etiket</span>
                          <input
                            value={draft.badge ?? ""}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                badge: event.target.value,
                              })
                            }
                            placeholder="Yeni, Sınırlı…"
                          />
                        </label>
                        <label className="admin-field">
                          <span>Sıralama</span>
                          <input
                            type="number"
                            min="0"
                            value={draft.sortOrder}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                sortOrder: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                        <label className="admin-field full">
                          <span>Ürün açıklaması</span>
                          <textarea
                            rows={5}
                            value={draft.description}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                description: event.target.value,
                              })
                            }
                            placeholder="Taşın dokusu, rengi, ölçüsü ve öne çıkan özellikleri…"
                          />
                        </label>
                        <label className="admin-field">
                          <span>URL (slug)</span>
                          <input
                            value={draft.slug}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                slug: event.target.value,
                              })
                            }
                            placeholder="Boş bırakılırsa üründen otomatik oluşturulur"
                          />
                        </label>
                        <label className="admin-field full">
                          <span>Meta başlık (SEO)</span>
                          <input
                            value={draft.metaTitle}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                metaTitle: event.target.value,
                              })
                            }
                            placeholder="Boş bırakılırsa ürün adından oluşturulur"
                          />
                        </label>
                        <label className="admin-field full">
                          <span>Meta açıklama (SEO)</span>
                          <textarea
                            rows={2}
                            value={draft.metaDescription}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                metaDescription: event.target.value,
                              })
                            }
                            placeholder="Boş bırakılırsa ürün açıklamasından oluşturulur"
                          />
                        </label>
                      </div>
                    </section>

                    <section className="admin-panel">
                      <div className="admin-form-section-title">
                        <span>02</span>
                        <div>
                          <h2>İndirim ve fırsat etiketi</h2>
                          <p>
                            Ürünün eski fiyatını, indirim oranını ve müşteriye
                            gösterilecek kampanya mesajını belirleyin.
                          </p>
                        </div>
                      </div>
                      <div className="admin-field-grid">
                        <label className="admin-field">
                          <span>İndirim oranı (%)</span>
                          <input
                            type="number"
                            min="0"
                            max="90"
                            step="1"
                            value={draft.discountPercent}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                discountPercent: Math.min(
                                  90,
                                  Math.max(0, Number(event.target.value)),
                                ),
                              })
                            }
                          />
                        </label>
                        <label className="admin-field">
                          <span>Fırsat mesajı</span>
                          <input
                            value={draft.campaignLabel ?? ""}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                campaignLabel: event.target.value,
                              })
                            }
                            list="campaign-labels"
                            placeholder="Örn. Haftanın Fırsatı"
                          />
                          <datalist id="campaign-labels">
                            <option value="İndirim Fırsatı" />
                            <option value="Haftanın Fırsatı" />
                            <option value="Sınırlı Fırsat" />
                            <option value="Günün Fırsatı" />
                            <option value="Sepette Avantaj" />
                          </datalist>
                        </label>
                        <div
                          className={
                            draft.discountPercent > 0
                              ? "admin-campaign-preview active"
                              : "admin-campaign-preview"
                          }
                        >
                          <span>
                            %{draft.discountPercent || 20} İNDİRİM
                          </span>
                          <div>
                            <strong>
                              {draft.campaignLabel || "İndirim Fırsatı"}
                            </strong>
                            <small>
                              {money.format(draft.price)} yerine{" "}
                              {money.format(getDiscountedPrice(draft))}
                            </small>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="admin-panel">
                      <div className="admin-form-section-title">
                        <span>03</span>
                        <div>
                          <h2>Shopier bağlantısı</h2>
                          <p>
                            Şimdilik ürün bağlantısını ekleyin; API
                            yetkilendirildiğinde otomatik eşleştirilecek.
                          </p>
                        </div>
                      </div>
                      <div className="admin-field-grid">
                        <label className="admin-field full">
                          <span>Shopier ürün bağlantısı</span>
                          <input
                            type="url"
                            value={draft.shopierUrl ?? ""}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                shopierUrl: event.target.value,
                                shopierSyncStatus: event.target.value
                                  ? "connected"
                                  : "manual",
                              })
                            }
                            placeholder="https://www.shopier.com/..."
                          />
                        </label>
                        <label className="admin-field">
                          <span>Shopier ürün kodu</span>
                          <input
                            value={draft.shopierProductId ?? ""}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                shopierProductId: event.target.value,
                              })
                            }
                            placeholder="İsteğe bağlı"
                          />
                        </label>
                        <div className="admin-integration-note">
                          <span
                            className={
                              draft.shopierUrl ? "connected" : "pending"
                            }
                          />
                          <p>
                            {draft.shopierUrl
                              ? "Satın alma düğmesi Shopier ürününe yönlenecek."
                              : "Bağlantı eklenene kadar ürün sepete eklenebilir; ödeme yönlendirmesi bekler."}
                          </p>
                        </div>
                      </div>
                    </section>
                  </div>

                  <aside className="admin-form-side">
                    <section className="admin-panel admin-image-panel">
                      <div className="admin-form-section-title compact">
                        <div>
                          <h2>Ürün görseli</h2>
                          <p>JPG, JPEG, PNG veya WebP · en fazla 5 MB</p>
                        </div>
                      </div>
                      <div className="admin-image-preview">
                        <img
                          src={draft.image || "/stone-collection.jpg"}
                          alt="Ürün önizlemesi"
                        />
                      </div>
                      <label className="admin-upload-button">
                        {uploading ? "Yükleniyor…" : "Yeni görsel yükle"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={uploadImage}
                          disabled={uploading}
                        />
                      </label>
                      <label className="admin-field">
                        <span>Görsel bağlantısı</span>
                        <input
                          value={draft.image}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              image: event.target.value,
                            })
                          }
                        />
                      </label>
                      <div className="admin-image-preview secondary">
                        <img
                          src={draft.hoverImage || draft.image || "/stone-collection.jpg"}
                          alt="İkinci görsel önizlemesi"
                        />
                      </div>
                      <label className="admin-upload-button secondary">
                        {uploading ? "Yükleniyor…" : "2. görsel yükle"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) => uploadImage(event, "hoverImage")}
                          disabled={uploading}
                        />
                      </label>
                      <label className="admin-field">
                        <span>2. görsel bağlantısı</span>
                        <input
                          value={draft.hoverImage ?? ""}
                          placeholder="Boş bırakılırsa kartta tek görsel kullanılır"
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              hoverImage: event.target.value,
                            })
                          }
                        />
                      </label>
                    </section>

                    <section className="admin-panel">
                      <div className="admin-form-section-title compact">
                        <div>
                          <h2>Yayın durumu</h2>
                          <p>Ürünün mağazada görünürlüğünü belirleyin.</p>
                        </div>
                      </div>
                      <label className="admin-field">
                        <span>Durum</span>
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              status: event.target.value as
                                | "published"
                                | "draft",
                            })
                          }
                        >
                          <option value="draft">Taslak</option>
                          <option value="published">Yayında</option>
                        </select>
                      </label>
                      <label className="admin-check">
                        <input
                          type="checkbox"
                          checked={draft.featured}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              featured: event.target.checked,
                            })
                          }
                        />
                        <span>
                          <strong>Öne çıkan ürün</strong>
                          <small>Koleksiyonun üst sırasında gösterilir.</small>
                        </span>
                      </label>
                    </section>
                  </aside>
                </div>

                <div className="admin-form-actions">
                  <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={() => setView("products")}
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className="admin-primary-button"
                    disabled={saving || uploading}
                  >
                    {saving
                      ? "Kaydediliyor…"
                      : draft.id
                        ? "Değişiklikleri yayınla"
                        : "Ürünü kaydet"}
                  </button>
                </div>
              </form>
            )}

            {view === "settings" && (
              <form className="admin-form" onSubmit={saveSettings}>
                <div className="admin-settings-intro">
                  <div>
                    <p className="admin-kicker">Doğrudan mağazaya bağlı</p>
                    <h2>İletişim ve konum bilgileri</h2>
                    <p>
                      Burada yaptığınız değişiklikler mağazanın iletişim
                      alanında ve alt bölümünde otomatik olarak yayınlanır.
                    </p>
                  </div>
                  <span>Canlı içerik</span>
                </div>

                <div className="admin-settings-grid">
                  <section className="admin-panel">
                    <div className="admin-form-section-title">
                      <span>01</span>
                      <div>
                        <h2>Temel iletişim</h2>
                        <p>Müşterilerin size ulaşacağı güncel bilgiler.</p>
                      </div>
                    </div>
                    <div className="admin-field-grid">
                      <label className="admin-field full">
                        <span>Mağaza adı</span>
                        <input
                          value={settings.businessName}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              businessName: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="admin-field">
                        <span>E-posta</span>
                        <input
                          type="email"
                          value={settings.email}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              email: event.target.value,
                            })
                          }
                          placeholder="merhaba@terragolds.com"
                        />
                      </label>
                      <label className="admin-field">
                        <span>Telefon</span>
                        <input
                          type="tel"
                          value={settings.phone}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              phone: event.target.value,
                            })
                          }
                          placeholder="+90 5xx xxx xx xx"
                        />
                      </label>
                      <label className="admin-field">
                        <span>WhatsApp numarası</span>
                        <input
                          type="tel"
                          value={settings.whatsapp}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              whatsapp: event.target.value,
                            })
                          }
                          placeholder="905xxxxxxxxx"
                        />
                      </label>
                      <label className="admin-field">
                        <span>Çalışma saatleri</span>
                        <input
                          value={settings.businessHours}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              businessHours: event.target.value,
                            })
                          }
                          placeholder="Pzt–Cmt · 10.00–18.00"
                        />
                      </label>
                    </div>
                  </section>

                  <section className="admin-panel">
                    <div className="admin-form-section-title">
                      <span>02</span>
                      <div>
                        <h2>Adres ve konum</h2>
                        <p>Mağaza veya teslimat noktanızın bilgileri.</p>
                      </div>
                    </div>
                    <div className="admin-field-grid">
                      <label className="admin-field full">
                        <span>Açık adres</span>
                        <textarea
                          rows={3}
                          value={settings.address}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              address: event.target.value,
                            })
                          }
                          placeholder="Mahalle, cadde, bina ve kapı numarası"
                        />
                      </label>
                      <label className="admin-field">
                        <span>İlçe</span>
                        <input
                          value={settings.district}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              district: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="admin-field">
                        <span>Şehir</span>
                        <input
                          value={settings.city}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              city: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="admin-field full">
                        <span>Google Maps bağlantısı</span>
                        <input
                          type="url"
                          value={settings.mapUrl}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              mapUrl: event.target.value,
                            })
                          }
                          placeholder="https://maps.google.com/..."
                        />
                      </label>
                    </div>
                  </section>

                  <section className="admin-panel">
                    <div className="admin-form-section-title">
                      <span>03</span>
                      <div>
                        <h2>Sosyal medya</h2>
                        <p>Terragolds’un dış kanallardaki bağlantıları.</p>
                      </div>
                    </div>
                    <div className="admin-field-grid">
                      <label className="admin-field">
                        <span>Facebook</span>
                        <input
                          type="url"
                          value={settings.facebook}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              facebook: event.target.value,
                            })
                          }
                          placeholder="https://facebook.com/..."
                        />
                      </label>
                      <label className="admin-field">
                        <span>Instagram</span>
                        <input
                          type="url"
                          value={settings.instagram}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              instagram: event.target.value,
                            })
                          }
                          placeholder="https://instagram.com/..."
                        />
                      </label>
                      <label className="admin-field">
                        <span>Pinterest</span>
                        <input
                          type="url"
                          value={settings.pinterest}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              pinterest: event.target.value,
                            })
                          }
                          placeholder="https://pinterest.com/..."
                        />
                      </label>
                      <label className="admin-field">
                        <span>TikTok</span>
                        <input
                          type="url"
                          value={settings.tiktok}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              tiktok: event.target.value,
                            })
                          }
                          placeholder="https://tiktok.com/@..."
                        />
                      </label>
                    </div>
                  </section>

                  <section className="admin-panel">
                    <div className="admin-form-section-title">
                      <span>04</span>
                      <div>
                        <h2>Mağaza duyurusu</h2>
                        <p>Üst bant ve alt bölümde görünen kısa metinler.</p>
                      </div>
                    </div>
                    <div className="admin-field-grid">
                      <label className="admin-field full">
                        <span>Üst duyuru</span>
                        <textarea
                          rows={3}
                          value={settings.announcement}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              announcement: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="admin-field full">
                        <span>Alt bölüm notu</span>
                        <input
                          value={settings.footerNote}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              footerNote: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                  </section>

                  <section className="admin-panel">
                    <div className="admin-form-section-title">
                      <span>05</span>
                      <div>
                        <h2>Analitik</h2>
                        <p>
                          Google Analytics ve Meta Pixel kimlikleri —
                          boş bırakılırsa hiçbir izleme kodu yüklenmez.
                        </p>
                      </div>
                    </div>
                    <div className="admin-field-grid">
                      <label className="admin-field">
                        <span>Google Analytics (GA4) Ölçüm Kimliği</span>
                        <input
                          value={settings.gaMeasurementId}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              gaMeasurementId: event.target.value,
                            })
                          }
                          placeholder="G-XXXXXXXXXX"
                        />
                      </label>
                      <label className="admin-field">
                        <span>Meta (Facebook) Pixel Kimliği</span>
                        <input
                          value={settings.metaPixelId}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              metaPixelId: event.target.value,
                            })
                          }
                          placeholder="123456789012345"
                        />
                      </label>
                    </div>
                  </section>

                  <ShippingTrackingSettingsPanel onNotice={flash} />
                </div>

                <div className="admin-form-actions">
                  <Link
                    className="admin-secondary-button"
                    href="/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Mağazada önizle
                  </Link>
                  <button
                    type="submit"
                    className="admin-primary-button"
                    disabled={saving}
                  >
                    {saving ? "Yayınlanıyor…" : "Ayarları yayınla"}
                  </button>
                </div>
              </form>
            )}

            {view === "payments" && (
              <PaymentProvidersPanel
                onNotice={flash}
                shippingFee={settings.shippingFee}
                freeShippingThreshold={settings.freeShippingThreshold}
                onShippingChange={(next) =>
                  setSettings((current) => ({ ...current, ...next }))
                }
                onSaveShipping={(event) =>
                  void saveSettings(
                    event,
                    "Kargo ücreti ve ücretsiz kargo limiti kaydedildi.",
                  )
                }
                shippingSaving={saving}
              />
            )}
            {view === "savedCards" && (
              <SavedCardsPanel onNotice={flash} />
            )}
            {view === "discounts" && (
              <DiscountCodesPanel onNotice={flash} />
            )}
            {view === "returnRequests" && (
              <ReturnRequestsPanel onNotice={flash} />
            )}
            {view === "tests" && <SystemTestCenter onNotice={flash} />}
            {view === "supplierImport" && (
              <SupplierImportPanel onNotice={flash} />
            )}
          </>
        )}
      </section>

      <div
        className={notice ? "admin-toast visible" : "admin-toast"}
        aria-live="polite"
      >
        <span>✓</span> {notice}
      </div>
    </main>
  );
}
