"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { activeCategoryGroups, type CategoryGroup } from "../lib/category-groups";
import {
  subgroupsForGroup,
  type CategorySubgroup,
} from "../lib/category-subgroups";
import { useCart } from "../lib/cart-context";
import { getDiscountedPrice, type Product } from "../lib/store-data";
import CategoryNavDropdown from "./category-nav-dropdown";

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

function SearchResultPrice({ product }: { product: Product }) {
  const discountedPrice = getDiscountedPrice(product);
  return (
    <span
      className={`price-display search-price${
        product.discountPercent > 0 ? " discounted" : ""
      }`}
    >
      {product.discountPercent > 0 && <del>{money.format(product.price)}</del>}
      <strong>{money.format(discountedPrice)}</strong>
    </span>
  );
}

function groupUrl(group: CategoryGroup) {
  return `/kategori/${group.slug}`;
}

type HeaderUser = {
  firstName: string;
  lastName: string;
  email: string;
};

type ContactSettings = {
  phone?: string;
  whatsapp?: string;
};

function formatWhatsappContact(value: string) {
  let digits = value.replace(/\D/g, "");
  if (!digits) digits = "905322408229";
  if (digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  if (digits.length === 10) digits = `90${digits}`;
  const local = digits.startsWith("90") ? digits.slice(2) : digits;
  const display = local.length === 10
    ? `+90 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`
    : `+${digits}`;
  return { digits, display };
}

function readStoredFavoriteCount() {
  try {
    const value = JSON.parse(
      window.localStorage.getItem("terragolds-liked") ?? "[]",
    ) as unknown;
    return Array.isArray(value) ? value.length : 0;
  } catch {
    return 0;
  }
}

export default function StoreSubpageHeader({
  active,
  activeGroupSlug,
}: {
  active?: "favorites";
  activeGroupSlug?: string;
}) {
  const cart = useCart();
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [user, setUser] = useState<HeaderUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [contact, setContact] = useState<ContactSettings>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [subgroupsByGroupSlug, setSubgroupsByGroupSlug] = useState<
    Map<string, CategorySubgroup[]>
  >(new Map());
  const [categorySummary, setCategorySummary] = useState<
    { name: string; count: number }[]
  >([]);
  const searchAreaRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    const refresh = () => {
      setFavoriteCount(readStoredFavoriteCount());
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("terragolds-storage", refresh);
    fetch("/api/auth/me", { cache: "no-store" })
      .then(
        (response) =>
          response.json() as Promise<{ user?: HeaderUser | null }>,
      )
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
    fetch("/api/store", { cache: "no-store" })
      .then(
        (response) =>
          response.json() as Promise<{
            settings?: ContactSettings;
            categorySummary?: { name: string; count: number }[];
          }>,
      )
      .then((data) => {
        setContact(data.settings ?? {});
        const summary = data.categorySummary ?? [];
        setCategorySummary(summary);
        const activeGroups = activeCategoryGroups(
          summary.map((entry) => entry.name),
        );
        setGroups(activeGroups);
        const categoryCounts = Object.fromEntries(
          summary.map((entry) => [entry.name, entry.count]),
        );
        setSubgroupsByGroupSlug(
          new Map(
            activeGroups.map((group) => [
              group.slug,
              subgroupsForGroup(group, categoryCounts),
            ]),
          ),
        );
      })
      .catch(() => setContact({}));
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("terragolds-storage", refresh);
    };
  }, []);

  // Debounced live search - same /api/search endpoint and scoring as the
  // homepage header (home-client.tsx), so results are consistent on every
  // page (product detail, category, etc.), not just the homepage.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      fetch(`/api/search?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then((response) => response.json() as Promise<{ products?: Product[] }>)
        .then((data) => setSearchResults(data.products ?? []))
        .catch((error) => {
          if (error instanceof Error && error.name === "AbortError") return;
          setSearchResults([]);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!searchOpen) return;
    const closeSearchOutside = (event: PointerEvent) => {
      if (
        searchAreaRef.current &&
        !searchAreaRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeSearchOutside);
    return () => document.removeEventListener("pointerdown", closeSearchOutside);
  }, [searchOpen]);

  const searchCategorySuggestions = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("tr-TR");
    if (!query) return [];
    return categorySummary
      .map((entry) => entry.name)
      .filter((item) => item.toLocaleLowerCase("tr-TR").includes(query))
      .slice(0, 4);
  }, [categorySummary, searchQuery]);

  const categoryCountsByName = useMemo(
    () =>
      Object.fromEntries(categorySummary.map((entry) => [entry.name, entry.count])),
    [categorySummary],
  );

  const selectSearchProduct = (product: Product) => {
    setSearchOpen(false);
    setSearchQuery("");
    window.location.href = `/products/${product.slug || product.id}`;
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const firstResult = searchResults[0];
    if (firstResult) {
      selectSearchProduct(firstResult);
      return;
    }
    const query = searchQuery.trim();
    window.location.href = query
      ? `/#shop?search=${encodeURIComponent(query)}`
      : "/#shop";
  };

  const whatsapp = formatWhatsappContact(
    contact.whatsapp || contact.phone || "",
  );

  return (
    <>
      <div className="store-market-announcement">
        <span>Özenle seçilmiş doğal taşlar</span>
        <i />
        <span>Güvenli paketleme</span>
        <i />
        <span>Türkiye'nin her yerine gönderim</span>
      </div>
      <div className="market-utility-bar store-market-utility">
        <div className="market-utility-inner">
          <a
            className="market-whatsapp-contact"
            href={`https://wa.me/${whatsapp.digits}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="market-whatsapp-icon" aria-hidden="true">
              <img src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/whatsapp.svg" alt="" />
            </span>
            <span className="market-whatsapp-copy">
              <small>WhatsApp Destek</small>
              <strong>{whatsapp.display}</strong>
            </span>
            <i><span /> Çevrimiçi</i>
          </a>
          <nav aria-label="Hızlı bağlantılar">
            <Link href="/login">Üye Girişi</Link>
            <Link href="/register">Kayıt Ol</Link>
            <Link href="/orders">Sipariş Takibi</Link>
            <Link href="/support">İletişim</Link>
          </nav>
        </div>
      </div>
      <header className="site-header compact store-subpage-header market-subpage-header">
      <Link className="brand brand-wordmark" href="/" aria-label="Terragolds ana sayfa">
        <span className="brand-name">
          TERRA<span>GOLDS</span>
        </span>
      </Link>

      <div className="header-search-area" ref={searchAreaRef}>
        <form className="header-search" role="search" onSubmit={submitSearch}>
          <span className="header-search-icon" aria-hidden="true">
            <span className="search-glyph" />
          </span>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchOpen(true);
            }}
            placeholder="Ürün, taş veya kategori ara"
            aria-label="Ürün, taş veya kategori ara"
          />
          {searchQuery && (
            <button
              className="header-search-clear"
              type="button"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
            >
              Temizle
            </button>
          )}
          <button className="header-search-submit" type="submit" aria-label="Ara">
            <span className="search-glyph" aria-hidden="true" />
          </button>
        </form>

        {searchOpen && (
          <div
            className="header-search-dropdown"
            role="dialog"
            aria-label="Arama sonuçları"
          >
            <div className="search-result-meta">
              <span>
                {searchQuery
                  ? `"${searchQuery}" için sonuçlar`
                  : "Öne çıkan ürünler"}
              </span>
              <strong>{searchResults.length} ürün</strong>
            </div>

            {searchCategorySuggestions.length > 0 && (
              <div className="search-category-suggestions">
                {searchCategorySuggestions.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery("");
                      window.location.href = `/#shop?search=${encodeURIComponent(item)}`;
                    }}
                  >
                    {item}
                    <span>{categoryCountsByName[item] ?? 0}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="search-results">
              {searchResults.length ? (
                searchResults.map((product) => (
                  <button
                    type="button"
                    className="search-result"
                    key={product.id}
                    onClick={() => selectSearchProduct(product)}
                  >
                    <img src={product.image} alt={product.name} loading="lazy" />
                    <span>
                      <small>
                        {product.stone} · {product.category}
                      </small>
                      <strong>{product.name}</strong>
                    </span>
                    <SearchResultPrice product={product} />
                  </button>
                ))
              ) : (
                <div className="search-empty">
                  <strong>Aradığınız ürün henüz mağazamızda bulunmuyor.</strong>
                  <p>
                    Farklı bir kelime deneyebilir veya taş seçimi için ekibimizden
                    destek alabilirsiniz.
                  </p>
                  <a href="/support" onClick={() => setSearchOpen(false)}>
                    Destek ekibiyle iletişime geç
                  </a>
                </div>
              )}
            </div>

            <a
              className="search-support"
              href="/support"
              onClick={() => setSearchOpen(false)}
            >
              <span>
                <small>Doğru taşı bulmakta zorlanıyor musunuz?</small>
                <strong>Sizinle birlikte bulalım</strong>
              </span>
              <b>Bize ulaşın</b>
            </a>
          </div>
        )}
      </div>

      <div className="header-actions">
        <div className="account-menu-button">
          {user ? (
            <>
              <Link className="header-auth-link" href="/profile">
                Hesabım
              </Link>
              <span className="header-auth-separator" aria-hidden="true" />
              <button
                className="header-auth-link"
                type="button"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  setUser(null);
                }}
              >
                Çıkış
              </button>
            </>
          ) : (
            <>
              <Link className="header-auth-link" href="/login">
                Giriş Yap
              </Link>
              <span className="header-auth-separator" aria-hidden="true" />
              <Link className="header-auth-link" href="/register">
                Kayıt Ol
              </Link>
            </>
          )}
        </div>

        <Link
          className={`header-favorites${active === "favorites" ? " active" : ""}`}
          href="/favorites"
          aria-label={`Favorilerim: ${favoriteCount}`}
        >
          <em>Favorilerim</em>
          {favoriteCount > 0 && <b>{favoriteCount}</b>}
        </Link>

        <button
          type="button"
          className="cart-button"
          onClick={cart.openCart}
          aria-label={`Sepetim: ${cart.cartUnitCount}`}
        >
          <em>Sepet</em>
          {cart.cartUnitCount > 0 && (
            <span className="cart-count">{cart.cartUnitCount}</span>
          )}
        </button>
      </div>
      </header>
      <nav className="market-category-nav store-market-categories" aria-label="Ana kategoriler">
        {groups.map((group) => (
          <CategoryNavDropdown
            key={group.slug}
            label={group.label}
            href={groupUrl(group)}
            subgroups={subgroupsByGroupSlug.get(group.slug) ?? []}
            active={activeGroupSlug === group.slug}
          />
        ))}
        <Link className="sale" href="/#shop">Outlet</Link>
        <Link href="/ozel-uretim">Özel Üretim</Link>
      </nav>

      {menuOpen && (
        <div
          className="mobile-menu-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <nav
        className={menuOpen ? "mobile-menu open" : "mobile-menu"}
        aria-label="Mobil menü"
      >
        <div className="mobile-menu-header">
          <span className="mobile-menu-brand">
            TERRA<strong>GOLDS</strong>
          </span>
          <button
            type="button"
            className="mobile-menu-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Menüyü kapat"
          >
            ×
          </button>
        </div>
        <div className="mobile-menu-body">
          <div className="mobile-menu-auth">
            {user ? (
              <>
                <a
                  className="mobile-menu-primary"
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                >
                  Hesabım
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    setUser(null);
                    setMenuOpen(false);
                  }}
                >
                  Çıkış Yap
                </button>
              </>
            ) : (
              <>
                <a
                  className="mobile-menu-primary"
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                >
                  Giriş Yap
                </a>
                <a href="/register" onClick={() => setMenuOpen(false)}>
                  Üye Ol
                </a>
              </>
            )}
          </div>

          <div className="mobile-menu-section">
            <strong>Kategoriler</strong>
            {groups.map((group) => (
              <a
                key={group.slug}
                href={groupUrl(group)}
                className={activeGroupSlug === group.slug ? "active" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {group.label}
              </a>
            ))}
            <a
              className="mobile-menu-discount"
              href="/#shop"
              onClick={() => setMenuOpen(false)}
            >
              Outlet
            </a>
            <a href="/ozel-uretim" onClick={() => setMenuOpen(false)}>
              Özel Üretim
            </a>
          </div>

          <div className="mobile-menu-section">
            <strong>Yardım</strong>
            <a href="/kvkk" onClick={() => setMenuOpen(false)}>
              KVKK
            </a>
            <a href="/support" onClick={() => setMenuOpen(false)}>
              Destek / SSS
            </a>
            <a href="/teslimat-ve-iade" onClick={() => setMenuOpen(false)}>
              Teslimat ve İade
            </a>
          </div>
        </div>
      </nav>

      <nav className="mobile-bottom-nav" aria-label="Alt gezinme">
        <Link href="/" className="mobile-bottom-nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11.5 12 4l8 7.5" />
            <path d="M6 10v9h5v-5h2v5h5v-9" />
          </svg>
          <span>Ana Sayfa</span>
        </Link>
        <button
          type="button"
          className="mobile-bottom-nav-item"
          onClick={() => setMenuOpen(true)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
            <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
            <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
            <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
          </svg>
          <span>Kategoriler</span>
        </button>
        <button
          type="button"
          onClick={cart.openCart}
          className="mobile-bottom-nav-item mobile-bottom-nav-primary"
          aria-label={`Sepetim: ${cart.cartUnitCount}`}
        >
          <span className="mobile-bottom-nav-primary-circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8h12l-1.1 11.2a1 1 0 0 1-1 .8H8.1a1 1 0 0 1-1-.8L6 8z" />
              <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
            </svg>
            {cart.cartUnitCount > 0 && (
              <b className="mobile-bottom-nav-badge">{cart.cartUnitCount}</b>
            )}
          </span>
          <span>Sepet</span>
        </button>
        <Link href="/favorites" className="mobile-bottom-nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19.5s-7-4.2-9-8.2C1.3 7.8 2.7 4.5 6.2 4.5c2 0 3.3 1 5.8 3.3 2.5-2.3 3.8-3.3 5.8-3.3 3.5 0 4.9 3.3 3.2 6.8-2 4-9 8.2-9 8.2z" />
          </svg>
          <span>Favorilerim</span>
          {favoriteCount > 0 && (
            <b className="mobile-bottom-nav-badge">{favoriteCount}</b>
          )}
        </Link>
        <Link
          href={user ? "/profile" : "/login"}
          className="mobile-bottom-nav-item"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.4" />
            <path d="M4.5 19.5c1.4-3.5 4.3-5.3 7.5-5.3s6.1 1.8 7.5 5.3" />
          </svg>
          <span>Hesabım</span>
        </Link>
      </nav>
    </>
  );
}
