"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  defaultProducts,
  getDiscountedPrice,
  type Product,
  type StoreSettings,
} from "../lib/store-data";
import { syncFavorites } from "../lib/favorite-client";
import {
  defaultSiteContent,
  type SiteContent,
} from "../lib/site-content-types";
import { activeCategoryGroups, type CategoryGroup } from "../lib/category-groups";
import {
  subgroupsForGroup,
  type CategorySubgroup,
} from "../lib/category-subgroups";
import CategoryNavDropdown from "./category-nav-dropdown";
import { buildPageWindow } from "../lib/pagination";
import { pickRotatingShowcase } from "../lib/rotating-showcase";
import { useCart } from "../lib/cart-context";
import StoreSiteFooter from "./store-site-footer";
import FloatingSocialVisibility from "./floating-social-visibility";
import QuickAddToCart from "./quick-add-to-cart";

const heroStoneSlides = [
  {
    name: "Şeffaf Kuvars",
    latin: "Clear Quartz",
    image: "/hero-stone-clear-quartz.jpg",
    accent: "Berraklık",
    detail: "Işığı temiz taşıyan, sade ve güçlü bir koleksiyon parçası.",
    hasEmbeddedLabel: true,
  },
  {
    name: "Ametist",
    latin: "Amethyst",
    image: "/stone-amethyst.jpg",
    accent: "Mor kristal dokusu",
    detail: "Derin mor tonları ve belirgin kristal yüzeyiyle vitrinde güçlü durur.",
  },
  {
    name: "Gül Kuvars",
    latin: "Rose Quartz",
    image: "/stone-rose-quartz-hero.jpg",
    accent: "Yumuşak pembe ton",
    detail: "Pastel pembe yapısıyla sakin, zarif ve dekoratif bir parça.",
  },
];

const themeCollectionTileMeta = [
  {
    category: "Ham Taşlar",
    defaultTitle: "Ham Taşlar",
    defaultTagline: "İşlenmemiş, doğal halinde",
    imageKey: "homeTileRawStonesImage" as const,
    titleKey: "homeTileRawStonesTitle" as const,
    taglineKey: "homeTileRawStonesTagline" as const,
    linkKey: "homeTileRawStonesLink" as const,
    defaultImage: "/stone-amethyst.jpg",
    defaultLink: "/#shop",
  },
  {
    category: "Meditasyon",
    defaultTitle: "Meditasyon Serisi",
    defaultTagline: "Huzur ve odaklanma için seçilmiş parçalar",
    imageKey: "homeTileMeditationImage" as const,
    titleKey: "homeTileMeditationTitle" as const,
    taglineKey: "homeTileMeditationTagline" as const,
    linkKey: "homeTileMeditationLink" as const,
    defaultImage: "/story-hands.jpg",
    defaultLink: "/#shop",
  },
  {
    category: "Koleksiyon Setleri",
    defaultTitle: "Koleksiyon Setleri",
    defaultTagline: "Bir arada, özenle hazırlanmış taş setleri",
    imageKey: "homeTileCollectionSetsImage" as const,
    titleKey: "homeTileCollectionSetsTitle" as const,
    taglineKey: "homeTileCollectionSetsTagline" as const,
    linkKey: "homeTileCollectionSetsLink" as const,
    defaultImage: "/stone-collection.jpg",
    defaultLink: "/#shop",
  },
];

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const moneyWithCents = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CATALOG_PRODUCTS_PER_PAGE = 15;
const NEW_ARRIVALS_COUNT = 12;
const FEATURED_PRODUCTS_COUNT = 10;
const DISCOUNT_SHOWCASE_COUNT = 12;

type NoticeState = {
  id: number;
  kind: "success" | "error";
  title: string;
  detail: string;
};

type HeaderUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  emailVerifiedAt: string | null;
};

type Language = "tr" | "en";

const englishSiteContent: Partial<SiteContent> = {
  navigationProducts: "Products",
  navigationSupport: "Support",
  homeHeroEyebrow: "Natural stone selection",
  homeHeroTitle: "Curated natural stones",
  homeHeroAccent: "with refined character",
  homeHeroDescription:
    "Discover selected crystals, minerals and decorative stones prepared with careful packaging and reliable delivery.",
  homeHeroPrimaryLabel: "Shop now",
  homeHeroSecondaryLabel: "Explore the guide",
  homeHeroNote: "Carefully selected natural stones",
  homeIntroEyebrow: "Our approach",
  homeIntroTitle: "A calm, refined collection for stone lovers.",
  homeIntroBody:
    "Each piece is chosen for its texture, color balance and display character, then prepared for a secure delivery experience.",
  footerDescription:
    "Curated natural stones, crystals and decorative pieces delivered across Türkiye.",
};

const uiText = {
  tr: {
    languageLabel: "Dil",
    searchPlaceholder: "Ürün, taş veya kategori ara",
    clear: "Temizle",
    searchSubmit: "Aramayı çalıştır",
    searchResults: "Arama sonuçları",
    featuredProducts: "Öne çıkan ürünler",
    resultsFor: (query: string) => `"${query}" için sonuçlar`,
    productCount: (count: number) => `${count} ürün`,
    searchEmptyTitle: "Aradığınız ürün henüz mağazamızda bulunmuyor.",
    searchEmptyBody: "Farklı bir kelime deneyebilir veya taş seçimi için ekibimizden destek alabilirsiniz.",
    contactSupport: "Destek ekibine ulaşın →",
    selectionHelp: "Seçim desteği",
    findStoneTogether: "Doğru taşı birlikte bulalım",
    contactUs: "İletişime geç →",
    account: "Hesabım",
    accountShort: "Hesap",
    favorites: "Favorilerim",
    logout: "Çıkış",
    logoutFull: "Çıkış yap",
    login: "Giriş Yap",
    loginShort: "Giriş yap",
    register: "Kayıt Ol",
    newAccount: "Yeni hesap oluştur",
    viewOrders: "Siparişlerimi görüntüle",
    accountInfo: "Hesap bilgilerim",
    orders: "Siparişlerim",
    manageAccount: "Sipariş ve üyelik işlemlerinizi yönetin.",
    support: "Yardım ve iletişim",
    openAccountMenu: "Hesap menüsünü aç",
    openMenu: "Menüyü aç veya kapat",
    openCart: (count: number) => `Sepeti aç, ${count} ürün`,
    favoritesCount: (count: number) => `Favorilerim, ${count} ürün`,
    newArrivals: "Yeni Gelenler",
    naturalStones: "Doğal Taşlar",
    crystals: "Kristaller",
    decorativePieces: "Dekoratif Parçalar",
    sale: "İndirim",
    filter: "Filtrele",
    reset: "Sıfırla",
    searchInProducts: "Ürün içinde ara",
    filterPlaceholder: "Taş, ürün adı, kategori",
    categories: "Kategoriler",
    priceRange: "Fiyat aralığı",
    minPrice: "Min TL",
    maxPrice: "Max TL",
    inStock: "Stokta olanlar",
    discountedProducts: "İndirimli ürünler",
    all: "Tümü",
    showingProducts: (shown: number, total: number) =>
      `${shown} / ${total} ürün gösteriliyor`,
    pageStatus: (page: number, total: number) => `${page}. sayfa / ${total}`,
    previousPage: "Önceki",
    nextPage: "Sonraki",
    lowStockBadge: "Son parçalar",
    trustSafePackaging: "Güvenli paketleme",
    trustTurkeyDelivery: "Türkiye geneli gönderim",
    trustSupport: "14 gün destek",
    socialContact: "Hızlı iletişim",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    facebook: "Facebook",
    discount: "İNDİRİM",
    discountOpportunity: "İndirim Fırsatı",
    soldOut: "Tükendi",
    outOfStock: "Stokta yok",
    waitSeconds: (seconds: number) => `${seconds} sn bekleyin`,
    addToCart: "Sepete ekle",
    newProduct: "Yeni ürün",
    rating: (rating: number, count: number) => `${rating} puan, ${count} yorum`,
    collectionMessageCampaign: (label: string) => `${label} · Sınırlı koleksiyon avantajı`,
    collectionMessageLowStock: (stock: number) => `Koleksiyonluk son ${stock} parça`,
    collectionMessageDefault: "Seçkin koleksiyondan özel parça",
    principlesEyebrow: "Neye önem veriyoruz",
    naturalCharacter: "Doğal karakter",
    naturalCharacterBody: "Renk, doku ve oluşum farklılıklarını kusur değil; doğanın imzası olarak görüyoruz.",
    carefulSelection: "Özenli seçim",
    carefulSelectionBody: "Her parçayı görsel denge, yüzey bütünlüğü ve sergileme karakteri açısından inceliyoruz.",
    safeDelivery: "Güvenli teslimat",
    safeDeliveryBody: "Hassas yüzeyleri koruyan çok katmanlı paketleme ile taşınızı yolculuğa hazırlıyoruz.",
    faqEyebrow: "Merak edilenler",
    faqTitle: "Taşınıza dair kısa notlar",
    faqPhotoTitle: "Gönderilen taş fotoğraftakiyle aynı mı?",
    faqPhotoBody: "Doğal taşların form ve damar yapısı benzersizdir. Tekil ürünlerde fotoğraftaki parça, setlerde ise aynı kalite ve görsel dengede özenle eşleştirilmiş parçalar gönderilir.",
    faqCareTitle: "Taşımı nasıl temizlemeliyim?",
    faqCareBody: "Genel bakım için yumuşak ve kuru bir bez yeterlidir. Her mineralin suya ve güneşe dayanımı farklı olabileceğinden ürün notlarını ayrıca kontrol etmenizi öneririz.",
    faqPackageTitle: "Paketleme nasıl yapılıyor?",
    faqPackageBody: "Her parça yüzey ve formuna uygun koruyucu katmanlarla sabitlenir, darbe emici malzemelerle güçlendirilmiş kutuda gönderilir.",
    faqGiftTitle: "Hediye paketi seçeneği var mı?",
    faqGiftBody: "Evet. Sipariş notunuza kısa mesajınızı ekleyerek Terragolds hediye paketiyle gönderim talep edebilirsiniz.",
    newsletter: "Bülten",
    newsletterTitle: "Yeni taşlar geldiğinde ilk siz görün.",
    emailAddress: "E-posta adresiniz",
    join: "Katıl",
    newsletterSuccessTitle: "Kaydınız alındı",
    newsletterSuccessDetail: "Yeni ürün haberleri e-posta adresinize gönderilecek.",
    newsletterErrorTitle: "Kaydınız alınamadı",
    newsletterErrorDetail: "Lütfen daha sonra tekrar deneyin.",
    cart: "Sepetim",
    shoppingCart: "Alışveriş sepetiniz",
    close: "Kapat",
    emptyCartTitle: "Henüz ürün eklemediniz",
    emptyCartBody: "Beğendiğiniz doğal taşları sepetinize ekleyerek alışverişinizi tamamlayabilirsiniz.",
    continueShopping: "Alışverişe devam et",
    cartSummary: "Sepet Özeti",
    subtotal: "Ara Toplam",
    shipping: "Kargo Tutarı",
    calculating: "Hesaplanıyor…",
    free: "Ücretsiz",
    notCalculated: "Hesaplanamadı",
    freeShippingMore: (amount: string) => `${amount} daha ekleyin, kargo ücretsiz olsun.`,
    totalSavings: "Toplam Kazancınız",
    total: "Toplam",
    couponCode: "İndirim kodu",
    apply: "Uygula",
    remove: "Kaldır",
    checkout: "ÖDEMEYE GEÇ",
    clearCart: "Sepeti boşalt",
    cartClearedTitle: "Sepetiniz boşaltıldı",
    cartClearedDetail: "Alışverişe dilediğiniz zaman devam edebilirsiniz.",
    productDetails: (name: string) => `${name} ürün ayrıntıları`,
    productBullets: ["Doğal renk ve doku farklılıkları", "Özenli, koruyucu paketleme", "Parçaya özel bakım notu"],
  },
  en: {
    languageLabel: "Language",
    searchPlaceholder: "Search product, stone or category",
    clear: "Clear",
    searchSubmit: "Run search",
    searchResults: "Search results",
    featuredProducts: "Featured products",
    resultsFor: (query: string) => `Results for "${query}"`,
    productCount: (count: number) => `${count} products`,
    searchEmptyTitle: "The product you searched for is not in our store yet.",
    searchEmptyBody: "Try another word or contact our team for help choosing a stone.",
    contactSupport: "Contact support →",
    selectionHelp: "Selection help",
    findStoneTogether: "Let's find the right stone together",
    contactUs: "Contact us →",
    account: "My Account",
    accountShort: "Account",
    favorites: "Favorites",
    logout: "Logout",
    logoutFull: "Log out",
    login: "Log In",
    loginShort: "Log in",
    register: "Sign Up",
    newAccount: "Create new account",
    viewOrders: "View my orders",
    accountInfo: "Account details",
    orders: "Orders",
    manageAccount: "Manage your orders and membership.",
    support: "Help and contact",
    openAccountMenu: "Open account menu",
    openMenu: "Open or close menu",
    openCart: (count: number) => `Open cart, ${count} products`,
    favoritesCount: (count: number) => `Favorites, ${count} products`,
    newArrivals: "New Arrivals",
    naturalStones: "Natural Stones",
    crystals: "Crystals",
    decorativePieces: "Decorative Pieces",
    sale: "Sale",
    filter: "Filter",
    reset: "Reset",
    searchInProducts: "Search products",
    filterPlaceholder: "Stone, product name, category",
    categories: "Categories",
    priceRange: "Price range",
    minPrice: "Min TRY",
    maxPrice: "Max TRY",
    inStock: "In stock",
    discountedProducts: "Discounted products",
    all: "All",
    showingProducts: (shown: number, total: number) =>
      `${shown} / ${total} products shown`,
    pageStatus: (page: number, total: number) => `Page ${page} / ${total}`,
    previousPage: "Previous",
    nextPage: "Next",
    lowStockBadge: "Last pieces",
    trustSafePackaging: "Secure packaging",
    trustTurkeyDelivery: "Delivery across Turkiye",
    trustSupport: "14-day support",
    socialContact: "Quick contact",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    facebook: "Facebook",
    discount: "OFF",
    discountOpportunity: "Sale Opportunity",
    soldOut: "Sold out",
    outOfStock: "Out of stock",
    waitSeconds: (seconds: number) => `Wait ${seconds}s`,
    addToCart: "Add to cart",
    newProduct: "New product",
    rating: (rating: number, count: number) => `${rating} rating, ${count} reviews`,
    collectionMessageCampaign: (label: string) => `${label} · Limited collection advantage`,
    collectionMessageLowStock: (stock: number) => `Only ${stock} collectible pieces left`,
    collectionMessageDefault: "A special piece from the curated collection",
    principlesEyebrow: "What we value",
    naturalCharacter: "Natural character",
    naturalCharacterBody: "We see differences in color, texture and formation not as flaws, but as nature's signature.",
    carefulSelection: "Careful selection",
    carefulSelectionBody: "Every piece is reviewed for visual balance, surface integrity and display character.",
    safeDelivery: "Secure delivery",
    safeDeliveryBody: "We prepare your stone for delivery with layered packaging that protects delicate surfaces.",
    faqEyebrow: "Questions",
    faqTitle: "Short notes about your stone",
    faqPhotoTitle: "Will the stone match the photo?",
    faqPhotoBody: "Natural stones have unique form and vein patterns. For individual products, the photographed piece is sent; for sets, matching pieces with the same quality and visual balance are prepared.",
    faqCareTitle: "How should I clean my stone?",
    faqCareBody: "A soft, dry cloth is enough for general care. Since each mineral reacts differently to water and sunlight, we recommend checking the product notes.",
    faqPackageTitle: "How is packaging prepared?",
    faqPackageBody: "Each piece is secured with protective layers suited to its surface and form, then shipped in a reinforced box with impact-absorbing materials.",
    faqGiftTitle: "Is gift packaging available?",
    faqGiftBody: "Yes. Add your short message to the order note and request Terragolds gift packaging.",
    newsletter: "Newsletter",
    newsletterTitle: "Be the first to see new stones.",
    emailAddress: "Email address",
    join: "Join",
    newsletterSuccessTitle: "You're subscribed",
    newsletterSuccessDetail: "New product updates will be sent to your email.",
    newsletterErrorTitle: "Subscription failed",
    newsletterErrorDetail: "Please try again later.",
    cart: "Cart",
    shoppingCart: "Your shopping cart",
    close: "Close",
    emptyCartTitle: "You haven't added a product yet",
    emptyCartBody: "Add the natural stones you like to your cart and complete your order.",
    continueShopping: "Continue shopping",
    cartSummary: "Cart Summary",
    subtotal: "Subtotal",
    shipping: "Shipping",
    calculating: "Calculating…",
    free: "Free",
    notCalculated: "Not calculated",
    freeShippingMore: (amount: string) => `Add ${amount} more for free shipping.`,
    totalSavings: "Total Savings",
    total: "Total",
    couponCode: "Discount code",
    apply: "Apply",
    remove: "Remove",
    checkout: "CHECKOUT",
    clearCart: "Clear cart",
    cartClearedTitle: "Your cart is cleared",
    cartClearedDetail: "You can continue shopping whenever you like.",
    productDetails: (name: string) => `${name} product details`,
    productBullets: ["Natural color and texture variations", "Careful protective packaging", "Piece-specific care note"],
  },
};

function ProductPrice({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const discountedPrice = getDiscountedPrice(product);
  return (
    <span
      className={`price-display${
        product.discountPercent > 0 ? " discounted" : ""
      }${className ? ` ${className}` : ""}`}
    >
      {product.discountPercent > 0 && <del>{money.format(product.price)}</del>}
      <strong>{money.format(discountedPrice)}</strong>
    </span>
  );
}

function productCollectionMessage(
  product: Product,
  ui: (typeof uiText)[Language],
) {
  if (product.campaignLabel) {
    return `${product.campaignLabel} · Sınırlı koleksiyon avantajı`;
  }
  if (product.stock <= 3) {
    return `Koleksiyonluk son ${product.stock} parça`;
  }
  return "Seçkin koleksiyondan özel parça";
}

function ratingStars(rating: number) {
  const roundedRating = Math.max(0, Math.min(5, Math.round(rating)));
  return "★★★★★".slice(0, roundedRating) + "☆☆☆☆☆".slice(roundedRating);
}

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

function ProductCard({
  product,
  ui,
  isLiked,
  onToggleLike,
  loading = "lazy",
}: {
  product: Product;
  ui: (typeof uiText)[Language];
  isLiked: boolean;
  onToggleLike: () => void;
  loading?: "eager" | "lazy";
}) {
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <div className="product-label-stack">
          {product.stock > 0 && product.stock <= 3 && (
            <span className="product-low-stock-badge">
              {ui.lowStockBadge}
            </span>
          )}
          {product.stock > 3 && product.discountPercent > 0 && (
            <span className="product-sale-badge">
              <strong>%{product.discountPercent} {ui.discount}</strong>
              <small>{product.campaignLabel || ui.discountOpportunity}</small>
            </span>
          )}
          {product.stock > 3 && product.discountPercent <= 0 && product.badge && (
            <span className="product-badge">{product.badge}</span>
          )}
        </div>
        <span className="product-certified-badge">
          <b aria-hidden="true">✓</b> Sertifikalı
        </span>
        <button
          type="button"
          className={isLiked ? "heart liked" : "heart"}
          onClick={onToggleLike}
          aria-label={
            isLiked
              ? `${product.name} favorilerden çıkar`
              : `${product.name} favorilere ekle`
          }
        >
          {isLiked ? "♥" : "♡"}
        </button>
        <a
          className={`product-image-button${
            product.hoverImage ? " has-hover-image" : ""
          }`}
          href={`/products/${product.slug || product.id}`}
          aria-label={`${product.name} ayrıntılarını gör`}
        >
          {product.hoverImage && (
            <>
              <span className="product-hover-zone left" />
              <span className="product-hover-zone right" />
            </>
          )}
          <img
            className="product-hover-image primary"
            src={product.image}
            alt={product.name}
            loading={loading}
          />
          {product.hoverImage && (
            <img
              className="product-hover-image secondary"
              src={product.hoverImage}
              alt=""
              loading={loading}
            />
          )}
          {product.hoverImage && (
            <span className="product-image-progress" aria-hidden="true">
              <i className="left" />
              <i className="right" />
            </span>
          )}
        </a>
        <span
          className="product-image-rating product-card-rating"
          aria-label={`${product.reviewAverage ?? 0} puan, ${
            product.reviewCount ?? 0
          } yorum`}
        >
          {product.reviewCount ? (
            <b aria-hidden="true">{ratingStars(product.reviewAverage ?? 0)}</b>
          ) : null}
          <em>
            {product.reviewCount ? `(${product.reviewCount})` : ui.newProduct}
          </em>
        </span>
      </div>
      <p className="product-collection-highlight">
        {productCollectionMessage(product, ui)}
      </p>
      <a className="product-info" href={`/products/${product.slug || product.id}`}>
        <span className="product-info-copy">
          <small>{product.stone}</small>
          <strong>{product.name}</strong>
        </span>
      </a>
      <QuickAddToCart product={product} />
    </article>
  );
}

type HomeClientProps = {
  // Only settings is fetched server-side (cheap - a single small row) and
  // seeded here to kill the flash of unset social/analytics links on first
  // paint. Products/content/categories are NOT server-fetched: they're the
  // full catalog/CMS data and rendering all of it into the initial HTML on
  // every request exceeded the Worker's CPU/memory limits (Cloudflare
  // error 1102) - they stay client-fetched via the effect below, same as
  // before.
  initialSettings: StoreSettings;
};

export default function HomeClient({ initialSettings }: HomeClientProps) {
  const [category, setCategory] = useState("Tümü");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogMinPrice, setCatalogMinPrice] = useState("");
  const [catalogMaxPrice, setCatalogMaxPrice] = useState("");
  const [catalogInStockOnly, setCatalogInStockOnly] = useState(false);
  const [catalogDiscountOnly, setCatalogDiscountOnly] = useState(false);
  const [catalogPage, setCatalogPage] = useState(1);
  const [settings, setSettings] =
    useState<StoreSettings>(initialSettings);
  const [content, setContent] =
    useState<SiteContent>(defaultSiteContent);
  const [categorySummary, setCategorySummary] = useState<
    { name: string; count: number }[]
  >([]);
  const [showcase, setShowcase] = useState<{
    featured: Product[];
    newest: Product[];
    discount: Product[];
  }>({ featured: [], newest: [], discount: [] });
  const cart = useCart();
  const [purchaseQuantities, setPurchaseQuantities] = useState<
    Record<number, number>
  >({});
  const [liked, setLiked] = useState<number[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [headerUser, setHeaderUser] = useState<HeaderUser | null>(null);
  const [headerCompact, setHeaderCompact] = useState(false);
  const marketWhatsapp = useMemo(
    () => formatWhatsappContact(settings.whatsapp || settings.phone),
    [settings.phone, settings.whatsapp],
  );
  const [activeHeroStone, setActiveHeroStone] = useState(0);
  const [language, setLanguage] = useState<Language>("tr");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const catalogResultsRef = useRef<HTMLDivElement | null>(null);
  const searchAreaRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const accountAreaRef = useRef<HTMLDivElement | null>(null);
  const ui = uiText[language];
  const managedContent =
    language === "tr" ? content : { ...content, ...englishSiteContent };


  useEffect(() => {
    const savedLiked = window.localStorage.getItem("terragolds-liked");
    const savedLanguage = window.localStorage.getItem("terragolds-language");
    if (savedLiked) setLiked(JSON.parse(savedLiked));
    if (savedLanguage === "tr" || savedLanguage === "en") {
      setLanguage(savedLanguage);
    }

    fetch("/api/store", { cache: "no-store" })
      .then(
        (response) =>
          response.json() as Promise<{
          settings?: StoreSettings;
          content?: SiteContent;
          categorySummary?: { name: string; count: number }[];
          warning?: string;
          }>,
      )
      .then((data) => {
          if (data.settings) setSettings(data.settings);
          if (data.content) setContent(data.content);
          if (data.categorySummary) setCategorySummary(data.categorySummary);
        })
      .catch(() => {});

    fetch("/api/showcase", { cache: "no-store" })
      .then(
        (response) =>
          response.json() as Promise<{
            featured?: Product[];
            newest?: Product[];
            discount?: Product[];
          }>,
      )
      .then((data) => {
        setShowcase({
          featured: data.featured ?? [],
          newest: data.newest ?? [],
          discount: data.discount ?? [],
        });
      })
      .catch(() => {
        // Same offline/dev fallback as /api/store above, computed the same
        // way readShowcaseProducts() does server-side.
        setShowcase({
          featured: defaultProducts
            .filter((product) => product.featured)
            .slice(0, FEATURED_PRODUCTS_COUNT),
          newest: pickRotatingShowcase(
            defaultProducts.filter((product) => product.stock > 0),
            NEW_ARRIVALS_COUNT,
            1,
          ),
          discount: pickRotatingShowcase(
            defaultProducts.filter(
              (product) => product.discountPercent > 0 && product.stock > 0,
            ),
            DISCOUNT_SHOWCASE_COUNT,
            2,
          ),
        });
      });

    fetch("/api/auth/me", { cache: "no-store" })
      .then(
        (response) =>
          response.json() as Promise<{ user?: HeaderUser | null }>,
      )
      .then((data) => setHeaderUser(data.user ?? null))
      .catch(() => setHeaderUser(null));
  }, []);

  // Header search: results are scored server-side (readShowcaseProducts'
  // sibling, searchProducts() in lib/store-db.ts) over the small set of
  // catalog rows that actually match the query, instead of scoring the
  // whole catalog in the browser.
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
    window.localStorage.setItem("terragolds-language", language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem("terragolds-liked", JSON.stringify(liked));
    window.dispatchEvent(new Event("terragolds-storage"));
    syncFavorites(liked);
  }, [liked]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setSelectedProduct(null);
        setSearchOpen(false);
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, []);

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

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeAccountOutside = (event: PointerEvent) => {
      if (
        accountAreaRef.current &&
        !accountAreaRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeAccountOutside);
    return () =>
      document.removeEventListener("pointerdown", closeAccountOutside);
  }, [accountMenuOpen]);

  useEffect(() => {
    const updateHeaderMode = () => setHeaderCompact(window.scrollY > 36);

    updateHeaderMode();
    window.addEventListener("scroll", updateHeaderMode, { passive: true });
    return () => window.removeEventListener("scroll", updateHeaderMode);
  }, []);

  // Category names/counts come from /api/store's categorySummary (a small,
  // pre-tallied {name, count} list computed server-side) instead of being
  // derived by mapping over the full product list here.
  const categories = useMemo(
    () => ["Tümü", ...categorySummary.map((entry) => entry.name)],
    [categorySummary],
  );

  const activeGroups = useMemo(
    () => activeCategoryGroups(categorySummary.map((entry) => entry.name)),
    [categorySummary],
  );
  const groupUrl = (group: CategoryGroup) => `/kategori/${group.slug}`;
  const navCategoryCounts = useMemo(
    () =>
      Object.fromEntries(
        categorySummary.map((entry) => [entry.name, entry.count]),
      ),
    [categorySummary],
  );
  const subgroupsByGroupSlug = useMemo(() => {
    const map = new Map<string, CategorySubgroup[]>();
    for (const group of activeGroups) {
      map.set(group.slug, subgroupsForGroup(group, navCategoryCounts));
    }
    return map;
  }, [activeGroups, navCategoryCounts]);

  const totalProductCount = useMemo(
    () => categorySummary.reduce((sum, entry) => sum + entry.count, 0),
    [categorySummary],
  );
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set(categories[0], totalProductCount);
    for (const entry of categorySummary) {
      counts.set(entry.name, entry.count);
    }
    return counts;
  }, [categories, categorySummary, totalProductCount]);

  const themeCollectionTiles = useMemo(
    () =>
      themeCollectionTileMeta.map((tile) => ({
        category: tile.category,
        image: managedContent[tile.imageKey] || tile.defaultImage,
        // Title/tagline are free-text admin content - an intentionally
        // blanked field must render blank, not silently fall back (image/
        // link keep a fallback since an empty src/href would actually
        // break the tile, not just omit some text).
        title: managedContent[tile.titleKey],
        tagline: managedContent[tile.taglineKey],
        link: managedContent[tile.linkKey] || tile.defaultLink,
      })),
    [managedContent],
  );

  const [activeCollectionTile, setActiveCollectionTile] = useState(0);
  const collectionPauseUntilRef = useRef(0);
  const collectionTouchStartXRef = useRef<number | null>(null);

  const pauseCollectionAutoplay = () => {
    collectionPauseUntilRef.current = Date.now() + 6000;
  };

  const handleCollectionTouchStart = (event: React.TouchEvent) => {
    collectionTouchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleCollectionTouchEnd = (event: React.TouchEvent) => {
    const startX = collectionTouchStartXRef.current;
    collectionTouchStartXRef.current = null;
    if (startX === null) return;
    const deltaX = (event.changedTouches[0]?.clientX ?? startX) - startX;
    if (Math.abs(deltaX) < 40) return;
    pauseCollectionAutoplay();
    setActiveCollectionTile((current) => {
      const count = themeCollectionTiles.length;
      if (count < 2) return current;
      return deltaX < 0 ? (current + 1) % count : (current - 1 + count) % count;
    });
  };

  useEffect(() => {
    if (themeCollectionTiles.length < 2) return;
    const query = window.matchMedia("(max-width: 760px)");
    let intervalId: number | null = null;

    const startInterval = () => {
      if (intervalId !== null) return;
      intervalId = window.setInterval(() => {
        if (Date.now() < collectionPauseUntilRef.current) return;
        setActiveCollectionTile(
          (current) => (current + 1) % themeCollectionTiles.length,
        );
      }, 4000);
    };
    const stopInterval = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleChange = (event: MediaQueryList | MediaQueryListEvent) => {
      if (event.matches) startInterval();
      else stopInterval();
    };

    handleChange(query);
    query.addEventListener("change", handleChange);
    return () => {
      query.removeEventListener("change", handleChange);
      stopInterval();
    };
  }, [themeCollectionTiles.length]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  // The catalog grid (category/text/price/stock/discount filters +
  // pagination) is computed in D1 via /api/products instead of filtering
  // the full product list in the browser - see lib/store-db.ts's
  // readProductsPage(). catalogData holds the current page's results plus
  // the server's page/count bookkeeping.
  const [catalogData, setCatalogData] = useState<{
    products: Product[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  }>({
    products: [],
    page: 1,
    pageSize: CATALOG_PRODUCTS_PER_PAGE,
    totalCount: 0,
    totalPages: 1,
  });

  useEffect(() => {
    const controller = new AbortController();
    // Debounced: typing in the search/price fields would otherwise fire a
    // request per keystroke. Toggling a checkbox or changing category still
    // feels instant since 300ms is well under perceptible UI lag.
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("page", String(catalogPage));
      params.set("pageSize", String(CATALOG_PRODUCTS_PER_PAGE));
      if (category !== "Tümü") params.set("category", category);
      if (catalogQuery.trim()) params.set("q", catalogQuery.trim());
      if (catalogMinPrice) params.set("minPrice", catalogMinPrice);
      if (catalogMaxPrice) params.set("maxPrice", catalogMaxPrice);
      if (catalogInStockOnly) params.set("inStock", "true");
      if (catalogDiscountOnly) params.set("discountOnly", "true");

      fetch(`/api/products?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(
          (response) =>
            response.json() as Promise<{
              products?: Product[];
              page?: number;
              pageSize?: number;
              totalCount?: number;
              totalPages?: number;
            }>,
        )
        .then((data) => {
          setCatalogData({
            products: data.products ?? [],
            page: data.page ?? 1,
            pageSize: data.pageSize ?? CATALOG_PRODUCTS_PER_PAGE,
            totalCount: data.totalCount ?? 0,
            totalPages: data.totalPages ?? 1,
          });
          // The server clamps an out-of-range page (e.g. a filter change
          // shrank the result set) - mirror that back so the "page N"
          // control and the Önceki/Sonraki buttons agree with what's shown.
          if (data.page && data.page !== catalogPage) {
            setCatalogPage(data.page);
          }
        })
        .catch((error) => {
          if (error instanceof Error && error.name === "AbortError") return;
          setCatalogData((current) => ({ ...current, products: [] }));
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    category,
    catalogQuery,
    catalogMinPrice,
    catalogMaxPrice,
    catalogInStockOnly,
    catalogDiscountOnly,
    catalogPage,
  ]);

  useEffect(() => {
    // Reset pagination when filters change so users see the first matching item.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCatalogPage(1);
  }, [
    catalogDiscountOnly,
    catalogInStockOnly,
    catalogMaxPrice,
    catalogMinPrice,
    catalogQuery,
    category,
  ]);

  const catalogPageWindow = buildPageWindow(
    catalogData.page,
    catalogData.totalPages,
  );

  const goToCatalogPage = (page: number) => {
    const nextPage = Math.min(Math.max(1, page), catalogData.totalPages);
    setCatalogPage(nextPage);
    window.setTimeout(() => {
      catalogResultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const resetCatalogFilters = () => {
    setCatalogQuery("");
    setCatalogMinPrice("");
    setCatalogMaxPrice("");
    setCatalogInStockOnly(false);
    setCatalogDiscountOnly(false);
    setCategory(categories[0]);
  };

  const searchCategorySuggestions = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("tr-TR");
    if (!query) return [];
    return categories
      .filter(
        (item) =>
          item !== categories[0] &&
          item.toLocaleLowerCase("tr-TR").includes(query),
      )
      .slice(0, 4);
  }, [categories, searchQuery]);

  const showNotice = (
    nextNotice: Omit<NoticeState, "id">,
  ) => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    setNotice({ ...nextNotice, id: Date.now() });
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2800);
  };

  const selectSearchProduct = (product: Product) => {
    setSearchOpen(false);
    setSearchQuery("");
    window.location.href = `/products/${product.slug || product.id}`;
  };

  const getPurchaseQuantity = (product: Product) =>
    Math.min(
      Math.max(1, purchaseQuantities[product.id] ?? 1),
      Math.max(1, Math.min(product.stock, 20)),
    );

  const setPurchaseQuantity = (product: Product, nextQuantity: number) => {
    const maximum = Math.max(1, Math.min(product.stock, 20));
    setPurchaseQuantities((current) => ({
      ...current,
      [product.id]: Math.min(maximum, Math.max(1, Math.round(nextQuantity) || 1)),
    }));
  };

  const toggleLike = (id: number) => {
    setLiked((current) =>
      current.includes(id)
        ? current.filter((productId) => productId !== id)
        : [...current, id],
    );
  };

  return (
    <main className="market-theme">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Terragolds",
            url: "https://www.terragolds.com",
            logo: "https://www.terragolds.com/og.png",
            description:
              "Özenle seçilmiş doğal taşlar, kristaller ve koleksiyon parçaları.",
            email: settings.email || undefined,
            sameAs: [
              settings.facebook,
              settings.instagram,
              settings.pinterest,
              settings.tiktok,
            ].filter(Boolean),
          }).replaceAll("<", "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Terragolds",
            url: "https://www.terragolds.com",
            inLanguage: "tr-TR",
          }).replaceAll("<", "\\u003c"),
        }}
      />
      <div className="announcement">
        <div className="announcement-copy">
          {settings.announcement
            .split("•")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item, index) => (
              <span className="announcement-item" key={`${item}-${index}`}>
                {index > 0 && <i className="announcement-dot" />}
                {item}
              </span>
            ))}
        </div>
        <nav className="announcement-social" aria-label="Sosyal medya ve iletişim">
          {settings.whatsapp && (
            <a
              className="announcement-social-link whatsapp"
              href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              title="WhatsApp"
            >
              <img
                src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/whatsapp.svg"
                alt=""
                aria-hidden="true"
              />
            </a>
          )}
          {settings.instagram && (
            <a
              className="announcement-social-link instagram"
              href={settings.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              title="Instagram"
            >
              <img
                src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/instagram.svg"
                alt=""
                aria-hidden="true"
              />
            </a>
          )}
          {settings.facebook && (
            <a
              className="announcement-social-link facebook"
              href={settings.facebook}
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              title="Facebook"
            >
              <img
                src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/facebook.svg"
                alt=""
                aria-hidden="true"
              />
            </a>
          )}
          {settings.tiktok && (
            <a
              className="announcement-social-link tiktok"
              href={settings.tiktok}
              target="_blank"
              rel="noreferrer"
              aria-label="TikTok"
              title="TikTok"
            >
              <img
                src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/tiktok.svg"
                alt=""
                aria-hidden="true"
              />
            </a>
          )}
          <a
            className="announcement-social-link contact"
            href="/support"
            aria-label="İletişim"
            title="İletişim"
          >
            <span aria-hidden="true">✉</span>
          </a>
        </nav>
      </div>

      <div className="market-utility-bar">
        <div className="market-utility-inner">
          <a
            className="market-whatsapp-contact"
            href={`https://wa.me/${marketWhatsapp.digits}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`WhatsApp destek: ${marketWhatsapp.display}`}
          >
            <span className="market-whatsapp-icon" aria-hidden="true">
              <img
                src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/whatsapp.svg"
                alt=""
              />
            </span>
            <span className="market-whatsapp-copy">
              <small>WhatsApp Destek</small>
              <strong>{marketWhatsapp.display}</strong>
            </span>
            <i><span /> Çevrimiçi</i>
          </a>
          <nav aria-label="Hızlı bağlantılar">
            <a href="/login">Üye Girişi</a>
            <a href="/register">Kayıt Ol</a>
            <a href="/orders">Sipariş Takibi</a>
            <a href="/support">İletişim</a>
          </nav>
        </div>
      </div>

      <header className={headerCompact ? "site-header compact" : "site-header"}>
        <a className="brand brand-wordmark" href="#top" aria-label="Terragolds ana sayfa">
          <span className="brand-name">
            TERRA<span>GOLDS</span>
          </span>
        </a>

        <div className="header-search-area" ref={searchAreaRef}>
          <form
            className="header-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              const firstResult = searchResults[0];
              if (firstResult) selectSearchProduct(firstResult);
            }}
          >
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
              placeholder={ui.searchPlaceholder}
              aria-label={ui.searchPlaceholder}
            />
            {searchQuery && (
              <button
                className="header-search-clear"
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
              >{ui.clear}</button>
            )}
            <button
              className="header-visual-search"
              type="button"
              aria-label="Görselle ara"
              title="Görselle ara"
            >
              <span className="camera-glyph" aria-hidden="true" />
            </button>
            <button
              className="header-search-submit"
              type="submit"
              aria-label={ui.searchSubmit}
            >
              <span className="search-glyph" aria-hidden="true" />
            </button>
          </form>

          {searchOpen && (
            <div
              className="header-search-dropdown"
              role="dialog"
              aria-label={ui.searchResults}
            >
              <div className="search-result-meta">
                <span>
                  {searchQuery
                    ? ui.resultsFor(searchQuery) : ui.featuredProducts}
                </span>
                <strong>{ui.productCount(searchResults.length)}</strong>
              </div>

              {searchCategorySuggestions.length > 0 && (
                <div className="search-category-suggestions">
                  {searchCategorySuggestions.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => {
                        setCategory(item);
                        setSearchOpen(false);
                        setSearchQuery("");
                        document
                          .getElementById("shop")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      {item}
                      <span>{categoryCounts.get(item) ?? 0}</span>
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
                      <ProductPrice product={product} className="search-price" />
                    </button>
                  ))
                ) : (
                  <div className="search-empty">
                    <strong>{ui.searchEmptyTitle}</strong><p>{ui.searchEmptyBody}</p>
                    <a href="/support" onClick={() => setSearchOpen(false)}>
                      {ui.contactSupport}</a>
                  </div>
                )}
              </div>

              <a
                className="search-support"
                href="/support"
                onClick={() => setSearchOpen(false)}
              >
                <span>
                  <small>{ui.selectionHelp}</small><strong>{ui.findStoneTogether}</strong>
                </span>
                <b>{ui.contactUs}</b>
              </a>
            </div>
          )}
        </div>

        <div className="header-actions">
          <div className="language-switch" aria-label={ui.languageLabel}>
            <button
              type="button"
              className={language === "tr" ? "active" : ""}
              onClick={() => setLanguage("tr")}
              aria-pressed={language === "tr"}
            >
              TR
            </button>
            <button
              type="button"
              className={language === "en" ? "active" : ""}
              onClick={() => setLanguage("en")}
              aria-pressed={language === "en"}
            >
              EN
            </button>
          </div>
          <div className="header-auth-strip">
            {headerUser ? (
              <>
                <a className="header-auth-link" href="/profile">
                  {ui.account}
                </a>
                <span className="header-auth-separator" aria-hidden="true" />
                <button
                  className="header-auth-link"
                  type="button"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    setHeaderUser(null);
                  }}
                >
                  {ui.logout}
                </button>
              </>
            ) : (
              <>
                <a className="header-auth-link" href="/login">
                  {ui.login}
                </a>
                <span className="header-auth-separator" aria-hidden="true" />
                <a className="header-auth-link" href="/register">
                  {ui.register}
                </a>
              </>
            )}
          </div>
          <a
            className="header-support-link"
            href="/support"
            aria-label={ui.support}
          >
            {managedContent.navigationSupport}
          </a>
          <div className="account-menu-wrap" ref={accountAreaRef}>
            <button
              className="account-menu-button"
              type="button"
              onClick={() => setAccountMenuOpen((current) => !current)}
              aria-label={ui.openAccountMenu}
              aria-expanded={accountMenuOpen}
            >
              {ui.accountShort}
              <span className="account-chevron" aria-hidden="true" />
            </button>
            {accountMenuOpen && (
              <div className="account-dropdown">
                <div className="account-dropdown-heading">
                  <div>
                    <strong>
                      {headerUser
                        ? `${headerUser.firstName} ${headerUser.lastName}`
                        : ui.account}
                    </strong>
                    <small>
                      {headerUser?.email ??
                        ui.manageAccount}
                    </small>
                  </div>
                </div>
                {headerUser ? (
                  <>
                    <a href="/profile">{ui.accountInfo} <span>→</span></a>
                    <a href="/orders">{ui.orders} <span>→</span></a>
                    <a href="/favorites">{ui.favorites} <span>→</span></a>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch("/api/auth/logout", { method: "POST" });
                        setHeaderUser(null);
                        setAccountMenuOpen(false);
                      }}
                    >
                      {ui.logoutFull}
                    </button>
                  </>
                ) : (
                  <>
                    <a className="account-dropdown-primary" href="/login">
                      {ui.loginShort}
                    </a>
                    <a href="/register">{ui.newAccount} <span>→</span></a>
                    <a href="/login?return_to=/orders">
                      {ui.viewOrders} <span>→</span>
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
          <a
            className="header-favorites"
            href="/favorites"
            aria-label={ui.favoritesCount(liked.length)}
          >
            <em>{ui.favorites}</em>
            {liked.length > 0 && <b>{liked.length}</b>}
          </a>
          <button
            className="cart-button"
            type="button"
            onClick={cart.openCart}
            aria-label={ui.openCart(cart.cartUnitCount)}
          >
            <em>{ui.cart}</em>
            {cart.cartUnitCount > 0 && (
              <span className="cart-count">{cart.cartUnitCount}</span>
            )}
          </button>
          <button
            className="menu-button"
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-expanded={menuOpen}
            aria-label={ui.openMenu}
          >
            <span />
            <span />
          </button>
        </div>
      </header>

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
            {headerUser ? (
              <>
                <a
                  className="mobile-menu-primary"
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                >
                  {ui.account}
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    setHeaderUser(null);
                    setMenuOpen(false);
                  }}
                >
                  {ui.logout}
                </button>
              </>
            ) : (
              <>
                <a
                  className="mobile-menu-primary"
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                >
                  {ui.login}
                </a>
                <a href="/register" onClick={() => setMenuOpen(false)}>
                  {ui.register}
                </a>
              </>
            )}
          </div>

          <div className="mobile-menu-section">
            <strong>Kategoriler</strong>
            {activeGroups.map((group) => (
              <a
                key={group.slug}
                href={groupUrl(group)}
                onClick={() => setMenuOpen(false)}
              >
                {group.label}
              </a>
            ))}
            <a
              className="mobile-menu-discount"
              href="#shop"
              onClick={() => {
                setCatalogDiscountOnly(true);
                setMenuOpen(false);
              }}
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

      <nav className="market-category-nav" id="top" aria-label="Ana kategoriler">
        {activeGroups.map((group) => (
          <CategoryNavDropdown
            key={group.slug}
            label={group.label}
            href={groupUrl(group)}
            subgroups={subgroupsByGroupSlug.get(group.slug) ?? []}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            setCatalogDiscountOnly(true);
            document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Outlet
        </button>
        <a href="/ozel-uretim">Özel Üretim</a>
      </nav>

      <section className="intro section-shell">
        <p className="eyebrow">{managedContent.homeIntroEyebrow}</p>
        <div className="intro-grid">
          <h2>{managedContent.homeIntroTitle}</h2>
          <div>
            <p>{managedContent.homeIntroBody}</p>
            <a className="text-link" href="#shop">
              {managedContent.homeIntroEyebrow} <span>↗</span>
            </a>
          </div>
        </div>
      </section>

      {showcase.featured.length > 0 && (
        <section
          className="featured-section section-shell"
          aria-label="Öne çıkan ürünler"
        >
          <div className="market-section-title">
            <span aria-hidden="true">★</span>
            <div>
              <small>Editörün seçimi</small>
              <h2>Öne Çıkanlar</h2>
            </div>
          </div>
          <div className="featured-row">
            {showcase.featured.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                ui={ui}
                isLiked={liked.includes(product.id)}
                onToggleLike={() => toggleLike(product.id)}
                loading={index < 6 ? "eager" : "lazy"}
              />
            ))}
          </div>
        </section>
      )}

      <section
        className="theme-tiles-section section-shell"
        aria-label="Koleksiyon vitrinleri"
      >
        <div
          className="theme-tiles"
          onTouchStart={handleCollectionTouchStart}
          onTouchEnd={handleCollectionTouchEnd}
        >
          {themeCollectionTiles.map((tile, index) => (
            <a
              className={
                activeCollectionTile === index ? "theme-tile active" : "theme-tile"
              }
              key={tile.category}
              href={tile.link}
            >
              <img src={tile.image} alt="" aria-hidden="true" />
              <span className="theme-tile-shade" aria-hidden="true" />
              <span className="theme-tile-copy">
                <strong>{tile.title}</strong>
                <em>{tile.tagline}</em>
              </span>
            </a>
          ))}
        </div>
        {themeCollectionTiles.length > 1 && (
          <div className="theme-tiles-dots" aria-label="Vitrin seçimi">
            {themeCollectionTiles.map((tile, index) => (
              <button
                key={tile.category}
                type="button"
                className={activeCollectionTile === index ? "active" : ""}
                onClick={() => {
                  pauseCollectionAutoplay();
                  setActiveCollectionTile(index);
                }}
                aria-label={`${tile.title} görselini göster`}
              />
            ))}
          </div>
        )}
      </section>

      {showcase.newest.length > 0 && (
        <section
          className="featured-section section-shell"
          aria-label="Yeni gelen ürünler"
        >
          <div className="market-section-title">
            <span aria-hidden="true">✦</span>
            <div>
              <small>Koleksiyona yeni katılanlar</small>
              <h2>Yeni Gelenler</h2>
            </div>
          </div>
          <div className="featured-row">
            {showcase.newest.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                ui={ui}
                isLiked={liked.includes(product.id)}
                onToggleLike={() => toggleLike(product.id)}
              />
            ))}
          </div>
        </section>
      )}

      {showcase.discount.length > 0 && (
        <section
          className="featured-section section-shell"
          aria-label="İndirimdeki ürünler"
        >
          <div className="market-section-title">
            <span aria-hidden="true">%</span>
            <div>
              <small>Şimdi kaçırılmayacak fiyatlar</small>
              <h2>İndirimde</h2>
            </div>
          </div>
          <div className="featured-row">
            {showcase.discount.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                ui={ui}
                isLiked={liked.includes(product.id)}
                onToggleLike={() => toggleLike(product.id)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="shop section-shell" id="shop">
        <div className="market-section-title">
          <span aria-hidden="true">%</span>
          <div>
            <small>Seçili koleksiyon</small>
            <h2>Günün Fırsatları</h2>
          </div>
        </div>
        <div className="catalog-trust-strip" aria-label="Mağaza güvenceleri">
          <span>{ui.trustSafePackaging}</span>
          <span>{ui.trustTurkeyDelivery}</span>
          <span>{ui.trustSupport}</span>
        </div>
        <nav className="collection-nav collection-nav-top" aria-label="Koleksiyon bölümleri">
          <a href="#shop">{ui.newArrivals}</a>
          <a href="/#shop">{ui.naturalStones}</a>
          <a href="/#shop">{ui.decorativePieces}</a>
          <button
            className="sale"
            type="button"
            onClick={() => {
              setCategory(categories[0]);
              setCatalogDiscountOnly(true);
              document
                .getElementById("shop")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {ui.sale}
          </button>
        </nav>
        <div
          className="gold-showcase stone-showcase"
          aria-label="Terragolds doğal taş animasyonu"
        >
          <div className="stone-showcase-slides" aria-hidden="true">
            {heroStoneSlides.map((slide, index) => (
              <img
                src={slide.image}
                alt=""
                key={slide.name}
                className={activeHeroStone === index ? "active" : ""}
                style={{ "--slide-index": index } as CSSProperties}
              />
            ))}
          </div>
          <div className="stone-showcase-copy" key={`stone-copy-${activeHeroStone}`}>
            <p>Doğanın en değerli hazineleri</p>
            <h2>Seçkin kristal koleksiyonu</h2>
            <div className="stone-showcase-texts">
              {heroStoneSlides.map((slide, index) => (
                <article
                  key={slide.name}
                  className={activeHeroStone === index ? "active" : ""}
                  style={{ "--slide-index": index } as CSSProperties}
                >
                  <span>{slide.latin}</span>
                  <strong>{slide.name}</strong>
                  <small>{slide.accent}</small>
                  <em>{slide.detail}</em>
                </article>
              ))}
            </div>
          </div>
        </div>
        <div className="stone-showcase-dots" aria-label="Vitrin taş seçimi">
          {heroStoneSlides.map((slide, index) => (
            <button
              className={activeHeroStone === index ? "active" : ""}
              key={`${slide.name}-dot`}
              type="button"
              onClick={() => setActiveHeroStone(index)}
              aria-label={`${slide.name} vitrinini göster`}
              aria-pressed={activeHeroStone === index}
            />
          ))}
        </div>
        <div className="catalog-layout">
          <aside className="catalog-sidebar" aria-label="Ürün filtreleri">
            <div className="catalog-sidebar-head">
              <strong>{ui.filter}</strong>
              <button type="button" onClick={resetCatalogFilters}>
                {ui.reset}
              </button>
            </div>

            <label className="catalog-filter-search">
              <span>{ui.searchInProducts}</span>
              <input
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder={ui.filterPlaceholder}
              />
            </label>

            <div className="catalog-filter-group">
              <span>{ui.categories}</span>
              <div className="filters" role="group" aria-label={ui.categories}>
          {categories.map((item) => (
            <button
              type="button"
              className={category === item ? "filter active" : "filter"}
              key={item}
              onClick={() => setCategory(item)}
              aria-pressed={category === item}
            >
              <span>{item === categories[0] ? ui.all : item}</span>
              <em>{categoryCounts.get(item) ?? 0}</em>
            </button>
          ))}
              </div>
            </div>

            <div className="catalog-filter-group">
              <span>{ui.priceRange}</span>
              <div className="catalog-price-row">
                <input
                  type="number"
                  min="0"
                  value={catalogMinPrice}
                  onChange={(event) => setCatalogMinPrice(event.target.value)}
                  placeholder={ui.minPrice}
                />
                <input
                  type="number"
                  min="0"
                  value={catalogMaxPrice}
                  onChange={(event) => setCatalogMaxPrice(event.target.value)}
                  placeholder={ui.maxPrice}
                />
              </div>
            </div>

            <label className="catalog-check">
              <input
                type="checkbox"
                checked={catalogInStockOnly}
                onChange={(event) => setCatalogInStockOnly(event.target.checked)}
              />
              <span>{ui.inStock}</span>
            </label>

            <label className="catalog-check">
              <input
                type="checkbox"
                checked={catalogDiscountOnly}
                onChange={(event) =>
                  setCatalogDiscountOnly(event.target.checked)
                }
              />
              <span>{ui.discountedProducts}</span>
            </label>
          </aside>

          <div className="catalog-results" ref={catalogResultsRef}>
            <div className="catalog-results-head">
              <span>
                {ui.showingProducts(catalogData.totalCount, totalProductCount)}
              </span>
              {catalogData.totalPages > 1 && (
                <span>{ui.pageStatus(catalogData.page, catalogData.totalPages)}</span>
              )}
            </div>
            <div className="product-grid">
          {catalogData.products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              ui={ui}
              isLiked={liked.includes(product.id)}
              onToggleLike={() => toggleLike(product.id)}
            />
          ))}
            </div>
            {catalogData.totalPages > 1 && (
              <div className="catalog-pagination" aria-label="Ürün sayfaları">
                <button
                  type="button"
                  onClick={() => goToCatalogPage(catalogData.page - 1)}
                  disabled={catalogData.page === 1}
                >
                  {ui.previousPage}
                </button>
                <div>
                  {catalogPageWindow.map((page) =>
                    typeof page === "number" ? (
                      <button
                        type="button"
                        className={page === catalogData.page ? "active" : ""}
                        key={page}
                        onClick={() => goToCatalogPage(page)}
                        aria-current={page === catalogData.page ? "page" : undefined}
                      >
                        {page}
                      </button>
                    ) : (
                      <span
                        className="catalog-pagination-ellipsis"
                        key={page}
                        aria-hidden="true"
                      >
                        …
                      </span>
                    ),
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => goToCatalogPage(catalogData.page + 1)}
                  disabled={catalogData.page === catalogData.totalPages}
                >
                  {ui.nextPage}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="market-benefits" aria-label="Alışveriş avantajları">
          <div><strong>Güvenli Alışveriş</strong><span>Korunan ödeme altyapısı</span></div>
          <div><strong>Aynı Gün Kargo</strong><span>16.00'a kadar siparişlerde</span></div>
          <div><strong>Kartla Ödeme</strong><span>Güvenli sanal POS</span></div>
          <div><strong>Özenli Paketleme</strong><span>Ürününüze uygun koruma</span></div>
          <div><strong>Geniş Koleksiyon</strong><span>Doğal ve özel parçalar</span></div>
        </div>
      </section>

      <section className="principles">
        <div className="principles-inner section-shell">
          <p className="eyebrow light">{ui.principlesEyebrow}</p>
          <div className="principle-grid">
            <div>
              <span>01</span>
              <h3>{ui.naturalCharacter}</h3>
              <p>{ui.naturalCharacterBody}</p>
            </div>
            <div>
              <span>02</span>
              <h3>{ui.carefulSelection}</h3>
              <p>{ui.carefulSelectionBody}</p>
            </div>
            <div>
              <span>03</span>
              <h3>{ui.safeDelivery}</h3>
              <p>{ui.safeDeliveryBody}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="faq section-shell" id="faq">
        <div className="section-heading faq-heading">
          <div>
            <p className="eyebrow">{ui.faqEyebrow}</p>
            <h2>{ui.faqTitle}</h2>
          </div>
        </div>
        <div className="faq-list">
          <details>
            <summary>
              {ui.faqPhotoTitle}
              <span aria-hidden="true">+</span>
            </summary>
            <p>
              {ui.faqPhotoBody}
            </p>
          </details>
          <details>
            <summary>
              {ui.faqCareTitle}
              <span aria-hidden="true">+</span>
            </summary>
            <p>
              {ui.faqCareBody}
            </p>
          </details>
          <details>
            <summary>
              {ui.faqPackageTitle}
              <span aria-hidden="true">+</span>
            </summary>
            <p>
              {ui.faqPackageBody}
            </p>
          </details>
          <details>
            <summary>
              {ui.faqGiftTitle}
              <span aria-hidden="true">+</span>
            </summary>
            <p>
              {ui.faqGiftBody}
            </p>
          </details>
        </div>
      </section>

      <section className="newsletter section-shell">
        <div>
          <p className="eyebrow light">{ui.newsletter}</p>
          <h2>{ui.newsletterTitle}</h2>
        </div>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const email = new FormData(form).get("email");
            try {
              const response = await fetch("/api/newsletter/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
              });
              if (!response.ok) throw new Error();
              showNotice({
                kind: "success",
                title: ui.newsletterSuccessTitle,
                detail: ui.newsletterSuccessDetail,
              });
              form.reset();
            } catch {
              showNotice({
                kind: "error",
                title: ui.newsletterErrorTitle,
                detail: ui.newsletterErrorDetail,
              });
            }
          }}
        >
          <label className="sr-only" htmlFor="newsletter-email">
            {ui.emailAddress}
          </label>
          <input
            id="newsletter-email"
            name="email"
            type="email"
            placeholder={ui.emailAddress}
            required
          />
          <button type="submit">{ui.join} <span>↗</span></button>
        </form>
      </section>

      <StoreSiteFooter
        lang={language}
        description={managedContent.footerDescription}
        footerNote={settings.footerNote}
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

      <FloatingSocialVisibility ariaLabel={ui.socialContact}>
        <a
          className="floating-social-link whatsapp"
          href={
            settings.whatsapp
              ? `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`
              : "/support"
          }
          target={settings.whatsapp ? "_blank" : undefined}
          rel={settings.whatsapp ? "noreferrer" : undefined}
          aria-label={ui.whatsapp}
        >
          <img
            src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/whatsapp.svg"
            alt=""
          />
        </a>
        {settings.instagram && (
          <a
            className="floating-social-link instagram"
            href={settings.instagram}
            target="_blank"
            rel="noreferrer"
            aria-label={ui.instagram}
          >
            <img
              src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/instagram.svg"
              alt=""
            />
          </a>
        )}
        {settings.facebook && (
          <a
            className="floating-social-link facebook"
            href={settings.facebook}
            target="_blank"
            rel="noreferrer"
            aria-label={ui.facebook}
          >
            <img
              src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/facebook.svg"
              alt=""
            />
          </a>
        )}
      </FloatingSocialVisibility>


      {selectedProduct && (
        <div
          className="overlay product-overlay"
          role="presentation"
          onMouseDown={() => setSelectedProduct(null)}
        >
          <section
            className="product-modal"
            role="dialog"
            aria-modal="true"
            aria-label={ui.productDetails(selectedProduct.name)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setSelectedProduct(null)}
              aria-label={ui.close}
            >
              ×
            </button>
            <div className="modal-image">
              {selectedProduct.discountPercent > 0 && (
                <span className="modal-sale-badge">
                  %{selectedProduct.discountPercent} {ui.discount} ·{" "}
                  {selectedProduct.campaignLabel || ui.discountOpportunity}
                </span>
              )}
              <img src={selectedProduct.image} alt={selectedProduct.name} />
            </div>
            <div className="modal-copy">
              <p className="eyebrow">{selectedProduct.category}</p>
              <h2>{selectedProduct.name}</h2>
              <ProductPrice product={selectedProduct} className="modal-price" />
              <p>{selectedProduct.description}</p>
              <ul>
                {ui.productBullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <div className="modal-purchase">
                <div className="quantity-picker">
                  <button
                    type="button"
                    onClick={() =>
                      setPurchaseQuantity(
                        selectedProduct,
                        getPurchaseQuantity(selectedProduct) - 1,
                      )
                    }
                    disabled={
                      selectedProduct.stock <= 0 ||
                      getPurchaseQuantity(selectedProduct) <= 1
                    }
                    aria-label={`${selectedProduct.name} adedini azalt`}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={Math.min(selectedProduct.stock, 20)}
                    value={getPurchaseQuantity(selectedProduct)}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) =>
                      setPurchaseQuantity(
                        selectedProduct,
                        Number(event.target.value),
                      )
                    }
                    aria-label={`${selectedProduct.name} adedi`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPurchaseQuantity(
                        selectedProduct,
                        getPurchaseQuantity(selectedProduct) + 1,
                      )
                    }
                    disabled={
                      selectedProduct.stock <= 0 ||
                      getPurchaseQuantity(selectedProduct) >=
                        Math.min(selectedProduct.stock, 20)
                    }
                    aria-label={`${selectedProduct.name} adedini artır`}
                  >
                    +
                  </button>
                </div>
                <button
                  className="button button-dark"
                  type="button"
                  onClick={() => {
                    if (
                      cart.addToCart(
                        selectedProduct,
                        getPurchaseQuantity(selectedProduct),
                      )
                    ) {
                      setSelectedProduct(null);
                    }
                  }}
                  disabled={
                    selectedProduct.stock <= 0 || cart.addCooldownSeconds > 0
                  }
                >
                  {selectedProduct.stock <= 0
                    ? ui.outOfStock
                    : cart.addCooldownSeconds > 0
                      ? ui.waitSeconds(cart.addCooldownSeconds)
                      : ui.addToCart}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <div
        key={notice?.id ?? "empty"}
        className={`toast${notice ? ` visible ${notice.kind}` : ""}`}
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        <span className="toast-icon" aria-hidden="true">
          {notice?.kind === "success" ? "✓" : "!"}
        </span>
        <span className="toast-copy">
          <strong>{notice?.title}</strong>
          <small>{notice?.detail}</small>
        </span>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Alt gezinme">
        <a href="/" className="mobile-bottom-nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11.5 12 4l8 7.5" />
            <path d="M6 10v9h5v-5h2v5h5v-9" />
          </svg>
          <span>Ana Sayfa</span>
        </a>
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
          className="mobile-bottom-nav-item mobile-bottom-nav-primary"
          onClick={cart.openCart}
          aria-label={ui.openCart(cart.cartUnitCount)}
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
        <a href="/favorites" className="mobile-bottom-nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19.5s-7-4.2-9-8.2C1.3 7.8 2.7 4.5 6.2 4.5c2 0 3.3 1 5.8 3.3 2.5-2.3 3.8-3.3 5.8-3.3 3.5 0 4.9 3.3 3.2 6.8-2 4-9 8.2-9 8.2z" />
          </svg>
          <span>Favorilerim</span>
          {liked.length > 0 && (
            <b className="mobile-bottom-nav-badge">{liked.length}</b>
          )}
        </a>
        <a
          href={headerUser ? "/profile" : "/login"}
          className="mobile-bottom-nav-item"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.4" />
            <path d="M4.5 19.5c1.4-3.5 4.3-5.3 7.5-5.3s6.1 1.8 7.5 5.3" />
          </svg>
          <span>Hesabım</span>
        </a>
      </nav>
    </main>
  );
}
