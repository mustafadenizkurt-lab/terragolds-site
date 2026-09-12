"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getDiscountedPrice, type Product } from "./store-data";
import { trackAddToCart } from "./analytics";
import { useLanguage } from "./language-client";
import type {
  CheckoutPaymentMethod,
  PaymentProviderSummary,
} from "./payment-types";

export type CartEntry = {
  productId: number;
  quantity: number;
};

export type CartQuote = {
  subtotalAmount: number;
  discountAmount: number;
  vatAmount: number;
  shippingAmount: number;
  shippingFee: number;
  freeShipping: boolean;
  freeShippingThreshold: number;
  totalAmount: number;
  discountCode: string | null;
  discountDescription: string;
  loyaltyPointsRedeemed: number;
  loyaltyDiscountAmount: number;
};

export type PublicPaymentMethod = Omit<
  PaymentProviderSummary,
  "credentialHint" | "fields" | "id"
> & { id: CheckoutPaymentMethod };

type CartToast = {
  id: number;
  kind: "success" | "error";
  title: string;
  detail: string;
};

export type HeaderUser = {
  firstName: string;
  lastName: string;
  email: string;
  loyaltyPoints?: number;
};

// Display-only mirror of lib/loyalty.ts's REDEEM_KURUS_PER_POINT (10 kuruş
// per point) - kept as a plain number here rather than importing that
// server module into this client bundle just for one constant.
const POINT_VALUE_TL = 0.1;

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

// Cart drawer, checkout modal and their toasts/errors are rendered by this
// single provider for every page, so they need their own copy table (same
// pattern as store-site-footer.tsx) - unlike page copy that's already
// resolved server-side, this is the site's only remaining checkout-path UI
// that stayed hardcoded Turkish regardless of the language toggle.
const copy = {
  tr: {
    cartAriaLabel: "Alışveriş sepetiniz",
    close: "Kapat",
    itemsCount: (n: number) => `${n} ürün`,
    emptyTitle: "Henüz ürün eklemediniz",
    emptyDetail:
      "Beğendiğiniz ürünleri sepetinize ekleyerek alışverişinizi tamamlayabilirsiniz.",
    continueShopping: "Alışverişe devam et",
    removeItem: (name: string) => `${name} ürününü sepetten sil`,
    decreaseQty: (name: string) => `${name} adedini azalt`,
    increaseQty: (name: string) => `${name} adedini artır`,
    qtyLabel: (name: string) => `${name} sepet adedi`,
    summaryTitle: "Sepet Özeti",
    subtotal: "Ara Toplam",
    discount: "İndirim",
    vat: "KDV (%20)",
    shipping: "Kargo Tutarı",
    calculating: "Hesaplanıyor…",
    free: "Ücretsiz",
    notCalculated: "Hesaplanamadı",
    freeShippingMore: (amount: string) =>
      `${amount} daha ekleyin, kargo ücretsiz olsun.`,
    totalSavings: "Toplam Kazancınız",
    total: "Toplam",
    shippingCaveat:
      "Kargo tutarı hesaplanamadığı için gösterilen tutara kargo dahil değildir; kesin tutar ödeme adımında görünecektir.",
    couponPlaceholder: "İndirim kodu",
    apply: "Uygula",
    remove: "Kaldır",
    checkout: "ÖDEMEYE GEÇ",
    clearCartConfirmTitle: "Sepetiniz boşaltıldı",
    clearCartConfirmDetail: "Alışverişe dilediğiniz zaman devam edebilirsiniz.",
    clearCart: "Sepeti boşalt",
    checkoutAriaLabel: "Sipariş talebi",
    checkoutEyebrow: "Sipariş talebi",
    checkoutTitle: "Güvenli ödemeye hazırlanın.",
    checkoutIntro:
      "Teslimat bilgilerinizi girin ve kullanmak istediğiniz güvenli ödeme yöntemini seçin.",
    paymentMethodLegend: "Ödeme yöntemi",
    codDetail: "Teslimatta nakit veya kartla ödeyin",
    testMode: "Test ortamı",
    securePaymentPage: "Güvenli ödeme sayfası",
    noPaymentMethod: "Kullanılabilir ödeme yöntemi bulunmuyor.",
    firstName: "Ad",
    lastName: "Soyad",
    email: "E-posta",
    emailNote: "Sipariş ve teslimat bilgileri bu adrese gönderilir.",
    phone: "Telefon",
    address: "Teslimat adresi",
    district: "İlçe",
    city: "Şehir",
    postcode: "Posta kodu",
    usePoints: "Puanlarınızı kullanın",
    pointsAvailable: (points: number, value: string) =>
      `${points} puanınız var (~${value} değerinde)`,
    pointsPlaceholder: "Kullanmak istediğiniz puan",
    pointsRedeemed: (points: number, value: string) =>
      `${points} puan kullanılıyor (-${value}).`,
    giftWrap: "Hediye paketi istiyorum (ücretsiz)",
    giftMessage: "Hediye mesajı",
    optional: "İsteğe bağlı",
    giftMessagePlaceholder: "Pakete eklenecek kısa bir not yazabilirsiniz.",
    orderNote: "Sipariş açıklaması",
    orderNotePlaceholder:
      "Paketleme, hediye notu veya teslimatla ilgili özel isteğinizi yazabilirsiniz.",
    orderNoteHint:
      "Açıklamanız paket hazırlanırken yönetim ekranında görüntülenir. En fazla 500 karakter.",
    preInfoForm: "Ön Bilgilendirme Formu",
    distanceSalesAgreement: "Mesafeli Satış Sözleşmesi",
    checkoutTotalItems: (n: number) => `${n} ürün`,
    checkoutPreparing: "Güvenli ödeme hazırlanıyor…",
    payWith: (method: string) => `${method} ile ödemeye geç`,
    selectedMethodFallback: "Seçilen yöntem",
    paymentUnavailable: "Ödeme yöntemi kullanılamıyor",
    cardSafetyNote: "Ödeme kart bilgileriniz Terragolds sunucularında tutulmaz.",
    addToCartCooldownTitle: "Lütfen kısa bir süre bekleyin",
    addToCartCooldownDetail: (seconds: number) =>
      `${seconds} saniye sonra yeniden ürün ekleyebilirsiniz.`,
    outOfStockTitle: "Stokta yok",
    outOfStockDetail: "Bu ürün şu anda mağazamızda bulunmuyor.",
    notEnoughStockTitle: "Yeterli stok bulunmuyor",
    notEnoughStockDetail: (name: string, max: number) =>
      `${name} için sepette en fazla ${max} adet olabilir.`,
    addedToCartTitle: "Ürün sepete eklendi",
    addedToCartDetail: (qty: number, name: string, total: number) =>
      `${qty} adet ${name} · Sepetinizde ${total} ürün`,
    stockLimitTitle: "Stok sınırına ulaştınız",
    stockLimitDetail: (name: string, max: number) =>
      `${name} için en fazla ${max} adet seçebilirsiniz.`,
    couponEmptyError: "Önce indirim kodunu yazın.",
    couponApplyFailed: "İndirim kodu uygulanamadı.",
    couponAppliedFallback: (code: string) => `${code} kodu uygulandı.`,
    cartQuoteFailed: "Sepet özeti hesaplanamadı.",
    shippingQuoteFailed: "Kargo tutarı hesaplanamadı.",
    invalidPaymentMethod: "Geçerli bir ödeme yöntemi seçin.",
    paymentStartFailed: "Ödeme başlatılamadı.",
    invalidRedirect: "Ödeme sağlayıcısından geçerli yönlendirme alınamadı.",
  },
  en: {
    cartAriaLabel: "Your shopping cart",
    close: "Close",
    itemsCount: (n: number) => `${n} item${n === 1 ? "" : "s"}`,
    emptyTitle: "Your cart is empty",
    emptyDetail: "Add items you like to your cart to complete your purchase.",
    continueShopping: "Continue shopping",
    removeItem: (name: string) => `Remove ${name} from cart`,
    decreaseQty: (name: string) => `Decrease ${name} quantity`,
    increaseQty: (name: string) => `Increase ${name} quantity`,
    qtyLabel: (name: string) => `${name} cart quantity`,
    summaryTitle: "Cart Summary",
    subtotal: "Subtotal",
    discount: "Discount",
    vat: "VAT (20%)",
    shipping: "Shipping",
    calculating: "Calculating…",
    free: "Free",
    notCalculated: "Not calculated",
    freeShippingMore: (amount: string) => `Add ${amount} more for free shipping.`,
    totalSavings: "Total Savings",
    total: "Total",
    shippingCaveat:
      "Shipping isn't included in the total shown because it couldn't be calculated; the exact amount will appear at checkout.",
    couponPlaceholder: "Discount code",
    apply: "Apply",
    remove: "Remove",
    checkout: "CHECKOUT",
    clearCartConfirmTitle: "Your cart is cleared",
    clearCartConfirmDetail: "You can continue shopping whenever you like.",
    clearCart: "Clear cart",
    checkoutAriaLabel: "Order request",
    checkoutEyebrow: "Order request",
    checkoutTitle: "Get ready for secure checkout.",
    checkoutIntro:
      "Enter your delivery details and choose the secure payment method you'd like to use.",
    paymentMethodLegend: "Payment method",
    codDetail: "Pay by cash or card on delivery",
    testMode: "Test mode",
    securePaymentPage: "Secure payment page",
    noPaymentMethod: "No payment method is available.",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    emailNote: "Order and delivery information will be sent to this address.",
    phone: "Phone",
    address: "Delivery address",
    district: "District",
    city: "City",
    postcode: "Postal code",
    usePoints: "Use your points",
    pointsAvailable: (points: number, value: string) =>
      `You have ${points} points (worth ~${value})`,
    pointsPlaceholder: "Points you'd like to use",
    pointsRedeemed: (points: number, value: string) =>
      `Using ${points} points (-${value}).`,
    giftWrap: "I'd like gift wrapping (free)",
    giftMessage: "Gift message",
    optional: "Optional",
    giftMessagePlaceholder: "You can write a short note to include with the package.",
    orderNote: "Order note",
    orderNotePlaceholder:
      "You can write any special requests about packaging, gift notes, or delivery.",
    orderNoteHint:
      "Your note is shown on the admin screen while the order is prepared. 500 characters max.",
    preInfoForm: "Pre-Information Form",
    distanceSalesAgreement: "Distance Sales Agreement",
    checkoutTotalItems: (n: number) => `${n} item${n === 1 ? "" : "s"}`,
    checkoutPreparing: "Preparing secure checkout…",
    payWith: (method: string) => `Pay with ${method}`,
    selectedMethodFallback: "Selected method",
    paymentUnavailable: "Payment method unavailable",
    cardSafetyNote: "Your card details are never stored on Terragolds servers.",
    addToCartCooldownTitle: "Please wait a moment",
    addToCartCooldownDetail: (seconds: number) =>
      `You can add this item again in ${seconds} seconds.`,
    outOfStockTitle: "Out of stock",
    outOfStockDetail: "This product isn't currently available in our store.",
    notEnoughStockTitle: "Not enough stock",
    notEnoughStockDetail: (name: string, max: number) =>
      `You can have at most ${max} of ${name} in your cart.`,
    addedToCartTitle: "Added to cart",
    addedToCartDetail: (qty: number, name: string, total: number) =>
      `${qty} × ${name} · ${total} item${total === 1 ? "" : "s"} in your cart`,
    stockLimitTitle: "Stock limit reached",
    stockLimitDetail: (name: string, max: number) =>
      `You can select at most ${max} of ${name}.`,
    couponEmptyError: "Enter a discount code first.",
    couponApplyFailed: "The discount code couldn't be applied.",
    couponAppliedFallback: (code: string) => `Code ${code} applied.`,
    cartQuoteFailed: "The cart summary couldn't be calculated.",
    shippingQuoteFailed: "Shipping couldn't be calculated.",
    invalidPaymentMethod: "Choose a valid payment method.",
    paymentStartFailed: "Payment couldn't be started.",
    invalidRedirect: "Couldn't get a valid redirect from the payment provider.",
  },
} as const;

function normalizeStoredCart(value: unknown): CartEntry[] {
  if (!Array.isArray(value)) return [];

  const quantities = new Map<number, number>();
  for (const entry of value) {
    const productId =
      typeof entry === "number"
        ? entry
        : Number((entry as Partial<CartEntry> | null)?.productId);
    const quantity =
      typeof entry === "number"
        ? 1
        : Number((entry as Partial<CartEntry> | null)?.quantity);
    if (
      !Number.isInteger(productId) ||
      productId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      continue;
    }
    quantities.set(
      productId,
      Math.min(20, (quantities.get(productId) ?? 0) + quantity),
    );
  }

  return [...quantities].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

function reconcileCartWithProducts(
  cart: CartEntry[],
  products: Product[],
): CartEntry[] {
  const availableProducts = new Map(
    products
      .filter((product) => product.status === "published" && product.stock > 0)
      .map((product) => [product.id, product]),
  );

  return cart.flatMap((entry) => {
    const product = availableProducts.get(entry.productId);
    if (!product) return [];
    return [
      {
        productId: entry.productId,
        quantity: Math.min(entry.quantity, product.stock, 20),
      },
    ];
  });
}

type CartContextValue = {
  cart: CartEntry[];
  cartItems: { product: Product; quantity: number }[];
  cartUnitCount: number;
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (product: Product, quantity?: number) => boolean;
  updateCartQuantity: (product: Product, nextQuantity: number) => void;
  clearCart: () => void;
  addCooldownSeconds: number;
  // Fetched once here (see the mount effect below) so every consumer that
  // just needs to know "is someone logged in" shares this instead of each
  // issuing its own redundant /api/auth/me request on every page.
  authUser: HeaderUser | null;
  setAuthUser: (user: HeaderUser | null) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const value = useContext(CartContext);
  if (!value) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return value;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [language] = useLanguage();
  const t = copy[language];
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [giftWrap, setGiftWrap] = useState(false);
  const [redeemPointsInput, setRedeemPointsInput] = useState("");
  const [cartQuote, setCartQuote] = useState<CartQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [appliedDiscountCode, setAppliedDiscountCode] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [couponError, setCouponError] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PublicPaymentMethod[]>(
    [],
  );
  const [selectedPaymentProvider, setSelectedPaymentProvider] =
    useState<CheckoutPaymentMethod | null>(null);
  const [authUser, setAuthUser] = useState<HeaderUser | null>(null);
  const [addCooldownSeconds, setAddCooldownSeconds] = useState(0);
  const [toast, setToast] = useState<CartToast | null>(null);
  const toastTimer = useRef<number | null>(null);
  const addCooldownUntil = useRef(0);

  useEffect(() => {
    const savedCart = window.localStorage.getItem("terragolds-cart");
    if (savedCart) {
      try {
        setCart(normalizeStoredCart(JSON.parse(savedCart)));
      } catch {
        setCart([]);
      }
    }

    fetch("/api/payments/methods", { cache: "no-store" })
      .then(
        (response) =>
          response.json() as Promise<{ methods?: PublicPaymentMethod[] }>,
      )
      .then((data) => {
        const methods = data.methods ?? [];
        setPaymentMethods(methods);
        setSelectedPaymentProvider(
          methods.find((method) => method.isPrimary)?.id ??
            methods[0]?.id ??
            null,
        );
      })
      .catch(() => setPaymentMethods([]));

    fetch("/api/auth/me", { cache: "no-store" })
      .then(
        (response) => response.json() as Promise<{ user?: HeaderUser | null }>,
      )
      .then((data) => setAuthUser(data.user ?? null))
      .catch(() => setAuthUser(null));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("terragolds-cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("terragolds-storage"));
  }, [cart]);

  // Only the products actually in the cart are fetched (by id), not the
  // whole catalog - same /api/products-by-ids pattern favorites-client.tsx
  // uses. /api/store stopped returning a `products` field once every other
  // consumer moved to its own dedicated endpoint (see readStorefrontData's
  // own doc comment) - this effect used to read that field and, since it
  // never fetched anything in its place, `products` stayed permanently
  // empty: cartItems/cartUnitCount derive from it, so the cart badge and
  // drawer looked empty even though items were really being added to the
  // underlying `cart` state and persisted to localStorage.
  const cartProductIds = [...new Set(cart.map((entry) => entry.productId))]
    .sort((a, b) => a - b)
    .join(",");
  useEffect(() => {
    if (!cartProductIds) {
      setProducts([]);
      return;
    }
    fetch(`/api/products-by-ids?ids=${cartProductIds}`, { cache: "no-store" })
      .then(
        (response) => response.json() as Promise<{ products?: Product[] }>,
      )
      .then((data) => {
        const fetchedProducts = data.products ?? [];
        setProducts(fetchedProducts);
        setCart((current) =>
          reconcileCartWithProducts(current, fetchedProducts),
        );
      })
      .catch(() => {});
  }, [cartProductIds]);

  useEffect(() => {
    if (cart.length === 0) {
      setCartQuote(null);
      return;
    }

    setQuoteLoading(true);
    setQuoteError("");
    const controller = new AbortController();
    fetch("/api/cart/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: cart,
        discountCode: appliedDiscountCode || undefined,
        redeemPoints: Number(redeemPointsInput) || undefined,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as CartQuote & {
          error?: string;
          code?: string;
          productIds?: number[];
        };
        if (!response.ok) {
          if (
            body.code === "UNAVAILABLE_PRODUCTS" &&
            body.productIds?.length
          ) {
            const unavailableIds = new Set(body.productIds);
            setCart((current) =>
              current.filter((entry) => !unavailableIds.has(entry.productId)),
            );
          }
          throw new Error(body.error ?? t.cartQuoteFailed);
        }
        setCartQuote(body);
        if (body.discountCode) {
          setCouponMessage(
            body.discountDescription ||
              t.couponAppliedFallback(body.discountCode),
          );
          setCouponError("");
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setCartQuote(null);
        setQuoteError(
          error instanceof Error ? error.message : t.shippingQuoteFailed,
        );
        if (appliedDiscountCode) {
          setCouponError(
            error instanceof Error ? error.message : t.couponApplyFailed,
          );
          setCouponMessage("");
          setAppliedDiscountCode("");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setQuoteLoading(false);
      });

    return () => controller.abort();
  }, [cart, appliedDiscountCode, redeemPointsInput]);

  useEffect(() => {
    if (addCooldownSeconds <= 0) return;
    const timer = window.setTimeout(
      () => setAddCooldownSeconds((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [addCooldownSeconds]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCartOpen(false);
        setCheckoutOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = (next: Omit<CartToast, "id">) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ ...next, id: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  };

  const cartItems = cart
    .map((entry) => {
      const product = products.find((item) => item.id === entry.productId);
      if (!product) return null;
      return {
        product,
        quantity: Math.min(entry.quantity, product.stock, 20),
      };
    })
    .filter(
      (entry): entry is { product: Product; quantity: number } =>
        Boolean(entry && entry.quantity > 0),
    );

  const cartUnitCount = cartItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const total = cartItems.reduce(
    (sum, item) => sum + getDiscountedPrice(item.product) * item.quantity,
    0,
  );
  const formatCents = (value: number) => moneyWithCents.format(value / 100);
  const totalSavings =
    (cartQuote?.discountAmount ?? 0) +
    (cartQuote?.freeShipping ? cartQuote.shippingFee : 0);
  const freeShippingRemaining = cartQuote
    ? Math.max(
        0,
        cartQuote.freeShippingThreshold -
          (cartQuote.subtotalAmount - cartQuote.discountAmount),
      )
    : 0;

  const playCartSound = () => {
    const AudioContextClass =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    gain.connect(audioContext.destination);

    [523.25, 659.25].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.connect(gain);
      oscillator.start(now + index * 0.055);
      oscillator.stop(now + 0.2 + index * 0.055);
    });

    window.setTimeout(() => void audioContext.close(), 360);
  };

  const addToCart = (
    product: Product,
    quantity = 1,
  ) => {
    const remainingCooldown = Math.ceil(
      (addCooldownUntil.current - Date.now()) / 1000,
    );
    if (remainingCooldown > 0) {
      showToast({
        kind: "error",
        title: t.addToCartCooldownTitle,
        detail: t.addToCartCooldownDetail(remainingCooldown),
      });
      return false;
    }
    if (product.stock <= 0) {
      showToast({
        kind: "error",
        title: t.outOfStockTitle,
        detail: t.outOfStockDetail,
      });
      return false;
    }

    const safeQuantity = Math.min(
      Math.max(1, Math.round(quantity) || 1),
      Math.min(product.stock, 20),
    );
    const maximumQuantity = Math.min(product.stock, 20);
    const currentQuantity =
      cart.find((entry) => entry.productId === product.id)?.quantity ?? 0;
    if (currentQuantity + safeQuantity > maximumQuantity) {
      showToast({
        kind: "error",
        title: t.notEnoughStockTitle,
        detail: t.notEnoughStockDetail(product.name, maximumQuantity),
      });
      return false;
    }

    setCart((current) => {
      const existing = current.find((entry) => entry.productId === product.id);
      if (existing) {
        return current.map((entry) =>
          entry.productId === product.id
            ? { ...entry, quantity: entry.quantity + safeQuantity }
            : entry,
        );
      }
      return [...current, { productId: product.id, quantity: safeQuantity }];
    });
    addCooldownUntil.current = Date.now() + 3000;
    setAddCooldownSeconds(3);
    playCartSound();
    trackAddToCart({
      id: product.id,
      name: product.name,
      price: getDiscountedPrice(product),
      quantity: safeQuantity,
    });
    showToast({
      kind: "success",
      title: t.addedToCartTitle,
      detail: t.addedToCartDetail(
        safeQuantity,
        product.name,
        cartUnitCount + safeQuantity,
      ),
    });
    return true;
  };

  const updateCartQuantity = (product: Product, nextQuantity: number) => {
    const roundedQuantity = Math.round(nextQuantity);
    if (roundedQuantity <= 0 || product.stock <= 0) {
      if (
        cart.filter((entry) => entry.productId !== product.id).length === 0
      ) {
        setCartQuote(null);
        setAppliedDiscountCode("");
        setCouponInput("");
        setCouponMessage("");
        setCouponError("");
      }
      setCart((current) =>
        current.filter((entry) => entry.productId !== product.id),
      );
      return;
    }

    const maximum = Math.min(product.stock, 20);
    const safeQuantity = Math.min(maximum, roundedQuantity);
    setCart((current) =>
      current.map((entry) =>
        entry.productId === product.id
          ? { ...entry, quantity: safeQuantity }
          : entry,
      ),
    );
    if (roundedQuantity > maximum) {
      showToast({
        kind: "error",
        title: t.stockLimitTitle,
        detail: t.stockLimitDetail(product.name, maximum),
      });
    }
  };

  const beginCheckout = () => {
    setCartOpen(false);
    setCheckoutEmail(authUser?.email ?? "");
    setCheckoutError("");
    setGiftWrap(false);
    setRedeemPointsInput("");
    setCheckoutOpen(true);
  };

  const applyDiscountCode = async () => {
    const code = couponInput.trim().toUpperCase().replace(/\s+/g, "");
    if (!code) {
      setCouponError(t.couponEmptyError);
      setCouponMessage("");
      return;
    }

    setQuoteLoading(true);
    setCouponError("");
    setCouponMessage("");
    try {
      const response = await fetch("/api/cart/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: cart, discountCode: code }),
      });
      const body = (await response.json()) as CartQuote & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? t.couponApplyFailed);
      }
      setCartQuote(body);
      setAppliedDiscountCode(body.discountCode ?? "");
      setCouponInput(body.discountCode ?? code);
      setCouponMessage(
        body.discountDescription ||
          t.couponAppliedFallback(body.discountCode ?? code),
      );
    } catch (applyError) {
      setCouponError(
        applyError instanceof Error ? applyError.message : t.couponApplyFailed,
      );
    } finally {
      setQuoteLoading(false);
    }
  };

  const submitCheckout = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setCheckoutLoading(true);
    setCheckoutError("");

    const formData = new FormData(event.currentTarget);
    const customer = Object.fromEntries(formData.entries());

    try {
      if (!selectedPaymentProvider) {
        throw new Error(t.invalidPaymentMethod);
      }
      const endpoint =
        selectedPaymentProvider === "cod"
          ? "/api/checkout/cod"
          : "/api/checkout/payment";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...customer,
          provider: selectedPaymentProvider,
          items: cart,
          discountCode: appliedDiscountCode || undefined,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        action?: string;
        method?: string;
        fields?: Record<string, string>;
        redirectUrl?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? t.paymentStartFailed);
      }
      if (body.redirectUrl) {
        window.location.assign(body.redirectUrl);
        return;
      }
      if (!body.action || !body.fields) {
        throw new Error(t.invalidRedirect);
      }

      const paymentForm = document.createElement("form");
      paymentForm.method = "POST";
      paymentForm.action = body.action;
      paymentForm.hidden = true;
      for (const [name, value] of Object.entries(body.fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        paymentForm.appendChild(input);
      }
      document.body.appendChild(paymentForm);
      paymentForm.submit();
    } catch (checkoutFailure) {
      setCheckoutError(
        checkoutFailure instanceof Error
          ? checkoutFailure.message
          : t.paymentStartFailed,
      );
      setCheckoutLoading(false);
    }
  };

  const clearCart = () => {
    setCart([]);
    setCartQuote(null);
    setAppliedDiscountCode("");
    setCouponInput("");
    setCouponMessage("");
    setCouponError("");
  };

  const contextValue: CartContextValue = {
    cart,
    cartItems,
    cartUnitCount,
    cartOpen,
    openCart: () => setCartOpen(true),
    closeCart: () => setCartOpen(false),
    addToCart,
    updateCartQuantity,
    clearCart,
    addCooldownSeconds,
    authUser,
    setAuthUser,
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}

      {cartOpen && (
        <div
          className="overlay"
          role="presentation"
          onMouseDown={() => setCartOpen(false)}
        >
          <aside
            className="cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t.cartAriaLabel}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                {cartUnitCount > 0 && (
                  <span className="drawer-count">{t.itemsCount(cartUnitCount)}</span>
                )}
              </div>
              <div className="drawer-actions">
                <button
                  className="drawer-close"
                  type="button"
                  onClick={() => setCartOpen(false)}
                  aria-label={t.close}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="cart-list">
              {cartItems.length === 0 ? (
                <div className="empty-cart">
                  <div className="empty-cart-animation" aria-hidden="true">
                    <img
                      className="empty-cart-image"
                      src="/empty-cart.png"
                      alt=""
                    />
                  </div>
                  <h3>{t.emptyTitle}</h3>
                  <p>{t.emptyDetail}</p>
                  <button
                    type="button"
                    className="button button-dark"
                    onClick={() => setCartOpen(false)}
                  >
                    {t.continueShopping}
                  </button>
                </div>
              ) : (
                cartItems.map(({ product, quantity }) => (
                  <div className="cart-item" key={product.id}>
                    <img src={product.image} alt="" />
                    <div className="cart-item-body">
                      <div className="cart-item-copy">
                        <small>{product.stone}</small>
                        <strong>{product.name}</strong>
                        <span
                          className={`price-display${
                            product.discountPercent > 0 ? " discounted" : ""
                          }`}
                        >
                          {product.discountPercent > 0 && (
                            <del>{money.format(product.price)}</del>
                          )}
                          <strong>
                            {money.format(getDiscountedPrice(product))}
                          </strong>
                        </span>
                      </div>
                      <div className="cart-item-bottom">
                        <div className="quantity-picker cart-quantity">
                          <button
                            type="button"
                            className={quantity === 1 ? "remove-one" : ""}
                            onClick={() =>
                              updateCartQuantity(product, quantity - 1)
                            }
                            aria-label={
                              quantity === 1
                                ? t.removeItem(product.name)
                                : t.decreaseQty(product.name)
                            }
                          >
                            {quantity === 1 ? (
                              <span
                                className="cart-remove-icon"
                                aria-hidden="true"
                              />
                            ) : (
                              "−"
                            )}
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={Math.min(product.stock, 20)}
                            value={quantity}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) =>
                              updateCartQuantity(
                                product,
                                Number(event.target.value),
                              )
                            }
                            aria-label={t.qtyLabel(product.name)}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateCartQuantity(product, quantity + 1)
                            }
                            disabled={quantity >= Math.min(product.stock, 20)}
                            aria-label={t.increaseQty(product.name)}
                          >
                            +
                          </button>
                        </div>
                        <strong className="cart-line-total">
                          {money.format(getDiscountedPrice(product) * quantity)}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cartItems.length > 0 && (
              <div className="cart-summary">
                <h3>{t.summaryTitle}</h3>
                <div className="cart-summary-row">
                  <span>{t.subtotal}</span>
                  <strong>
                    {cartQuote
                      ? formatCents(cartQuote.subtotalAmount)
                      : money.format(total)}
                  </strong>
                </div>
                {cartQuote && cartQuote.discountAmount > 0 && (
                  <div className="cart-summary-row discount">
                    <span>{t.discount}</span>
                    <strong>−{formatCents(cartQuote.discountAmount)}</strong>
                  </div>
                )}
                {cartQuote && (
                  <div className="cart-summary-row vat">
                    <span>{t.vat}</span>
                    <strong>{formatCents(cartQuote.vatAmount)}</strong>
                  </div>
                )}
                <div className="cart-summary-row shipping">
                  <span>{t.shipping}</span>
                  <strong>
                    {quoteLoading ? (
                      t.calculating
                    ) : cartQuote?.freeShipping ? (
                      <>
                        <del>{formatCents(cartQuote.shippingFee)}</del>
                        <em>{t.free}</em>
                      </>
                    ) : cartQuote ? (
                      formatCents(cartQuote.shippingAmount)
                    ) : (
                      t.notCalculated
                    )}
                  </strong>
                </div>
                {quoteError && (
                  <p className="cart-quote-error" role="alert">
                    {quoteError}
                  </p>
                )}
                {cartQuote &&
                  !cartQuote.freeShipping &&
                  cartQuote.freeShippingThreshold > 0 && (
                    <p className="shipping-progress">
                      <span aria-hidden="true">◇</span>
                      {t.freeShippingMore(formatCents(freeShippingRemaining))}
                    </p>
                  )}
                {totalSavings > 0 && (
                  <div className="cart-savings">
                    <span>{t.totalSavings}</span>
                    <strong>−{formatCents(totalSavings)}</strong>
                  </div>
                )}
                <div className="cart-summary-total">
                  <span>{t.total}</span>
                  <strong>
                    {cartQuote
                      ? formatCents(cartQuote.totalAmount)
                      : money.format(total)}
                  </strong>
                </div>
                {!cartQuote && quoteError && (
                  <p className="cart-total-caveat">{t.shippingCaveat}</p>
                )}
                <div className="coupon-box">
                  <div>
                    <input
                      value={couponInput}
                      onChange={(event) =>
                        setCouponInput(event.target.value.toUpperCase())
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void applyDiscountCode();
                        }
                      }}
                      placeholder={t.couponPlaceholder}
                      aria-label={t.couponPlaceholder}
                    />
                    <button
                      type="button"
                      onClick={() => void applyDiscountCode()}
                      disabled={quoteLoading}
                    >
                      {t.apply}
                    </button>
                  </div>
                  {couponMessage && (
                    <p className="coupon-success">
                      <span>✓</span> {couponMessage}
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedDiscountCode("");
                          setCouponInput("");
                          setCouponMessage("");
                        }}
                      >
                        {t.remove}
                      </button>
                    </p>
                  )}
                  {couponError && (
                    <p className="coupon-error" role="alert">
                      {couponError}
                    </p>
                  )}
                </div>
                <button
                  className="button button-dark wide"
                  type="button"
                  onClick={beginCheckout}
                >
                  {t.checkout}
                </button>
                <button
                  className="clear-cart-bottom"
                  type="button"
                  onClick={() => {
                    clearCart();
                    showToast({
                      kind: "success",
                      title: t.clearCartConfirmTitle,
                      detail: t.clearCartConfirmDetail,
                    });
                  }}
                >
                  <span className="trash-icon" aria-hidden="true" />
                  {t.clearCart}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {checkoutOpen && (
        <div
          className="overlay"
          role="presentation"
          onMouseDown={() => setCheckoutOpen(false)}
        >
          <section
            className="checkout-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t.checkoutAriaLabel}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setCheckoutOpen(false)}
              aria-label={t.close}
            >
              ×
            </button>
            <p className="eyebrow">{t.checkoutEyebrow}</p>
            <h2>{t.checkoutTitle}</h2>
            <p>{t.checkoutIntro}</p>
            <form onSubmit={submitCheckout}>
              <fieldset
                className={
                  paymentMethods.length > 1
                    ? "checkout-payment-methods"
                    : "checkout-payment-methods single"
                }
              >
                <legend>{t.paymentMethodLegend}</legend>
                {paymentMethods.length > 1 ? (
                  paymentMethods.map((method) => (
                    <label
                      className={
                        selectedPaymentProvider === method.id ? "selected" : undefined
                      }
                      key={method.id}
                    >
                      <input
                        type="radio"
                        name="paymentProvider"
                        value={method.id}
                        checked={selectedPaymentProvider === method.id}
                        onChange={() => setSelectedPaymentProvider(method.id)}
                      />
                      <span className={`checkout-provider-mark ${method.id}`}>
                        {method.id === "cod" ? "₺" : method.name.slice(0, 1)}
                      </span>
                      <span>
                        <strong>{method.name}</strong>
                        <small>
                          {method.id === "cod"
                            ? t.codDetail
                            : method.testMode
                              ? t.testMode
                              : t.securePaymentPage}
                        </small>
                      </span>
                      <i aria-hidden="true" />
                    </label>
                  ))
                ) : paymentMethods.length === 1 ? (
                  <div className="checkout-provider-fixed">
                    <span
                      className={`checkout-provider-mark ${paymentMethods[0].id}`}
                    >
                      {paymentMethods[0].name.slice(0, 1)}
                    </span>
                    <span>
                      <strong>{paymentMethods[0].name}</strong>
                      <small>
                        {paymentMethods[0].testMode
                          ? t.testMode
                          : t.securePaymentPage}
                      </small>
                    </span>
                  </div>
                ) : (
                  <div className="checkout-no-provider">
                    {t.noPaymentMethod}
                  </div>
                )}
              </fieldset>
              <div className="checkout-name-row">
                <label>
                  {t.firstName}
                  <input name="firstName" autoComplete="given-name" required />
                </label>
                <label>
                  {t.lastName}
                  <input name="lastName" autoComplete="family-name" required />
                </label>
              </div>
              <label>
                {t.email}
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={checkoutEmail}
                  readOnly={Boolean(authUser)}
                  onChange={(event) => setCheckoutEmail(event.target.value)}
                  required
                />
                <small className="checkout-field-note">{t.emailNote}</small>
              </label>
              <label>
                {t.phone}
                <input name="phone" type="tel" autoComplete="tel" required />
              </label>
              <label>
                {t.address}
                <textarea
                  name="address"
                  rows={2}
                  autoComplete="street-address"
                  required
                />
              </label>
              <div className="checkout-name-row">
                <label>
                  {t.district}
                  <input name="district" autoComplete="address-level2" />
                </label>
                <label>
                  {t.city}
                  <input name="city" autoComplete="address-level1" required />
                </label>
              </div>
              <label>
                {t.postcode}
                <input name="postcode" autoComplete="postal-code" />
              </label>
              {Boolean(authUser?.loyaltyPoints) && (
                <label className="checkout-note-field">
                  <span>
                    {t.usePoints}{" "}
                    <em>
                      {t.pointsAvailable(
                        authUser?.loyaltyPoints ?? 0,
                        money.format(
                          (authUser?.loyaltyPoints ?? 0) * POINT_VALUE_TL,
                        ),
                      )}
                    </em>
                  </span>
                  <input
                    name="redeemPoints"
                    type="number"
                    min={0}
                    max={authUser?.loyaltyPoints ?? 0}
                    value={redeemPointsInput}
                    onChange={(event) => setRedeemPointsInput(event.target.value)}
                    placeholder={t.pointsPlaceholder}
                  />
                  {cartQuote && cartQuote.loyaltyPointsRedeemed > 0 && (
                    <small className="checkout-field-note">
                      {t.pointsRedeemed(
                        cartQuote.loyaltyPointsRedeemed,
                        money.format(cartQuote.loyaltyDiscountAmount / 100),
                      )}
                    </small>
                  )}
                </label>
              )}
              <label className="checkout-gift-wrap">
                <input
                  name="giftWrap"
                  type="checkbox"
                  checked={giftWrap}
                  onChange={(event) => setGiftWrap(event.target.checked)}
                />
                <span>{t.giftWrap}</span>
              </label>
              {giftWrap && (
                <label className="checkout-note-field">
                  <span>
                    {t.giftMessage} <em>{t.optional}</em>
                  </span>
                  <textarea
                    name="giftMessage"
                    rows={2}
                    maxLength={200}
                    placeholder={t.giftMessagePlaceholder}
                  />
                </label>
              )}
              <label className="checkout-note-field">
                <span>
                  {t.orderNote} <em>{t.optional}</em>
                </span>
                <textarea
                  name="note"
                  rows={4}
                  maxLength={500}
                  placeholder={t.orderNotePlaceholder}
                />
                <small className="checkout-field-note">{t.orderNoteHint}</small>
              </label>
              <label className="checkout-legal-consent">
                <span className="legal-consent-checkbox">
                  <input name="legalConsent" type="checkbox" required />
                </span>
                <span>
                  {language === "en" ? (
                    <>
                      I have read and accept the{" "}
                      <a href="/on-bilgilendirme-formu" target="_blank">
                        {t.preInfoForm}
                      </a>{" "}
                      and the{" "}
                      <a href="/mesafeli-satis-sozlesmesi" target="_blank">
                        {t.distanceSalesAgreement}
                      </a>
                      .
                    </>
                  ) : (
                    <>
                      <a href="/on-bilgilendirme-formu" target="_blank">
                        {t.preInfoForm}
                      </a>{" "}
                      ile{" "}
                      <a href="/mesafeli-satis-sozlesmesi" target="_blank">
                        {t.distanceSalesAgreement}
                      </a>
                      'ni okudum ve kabul ediyorum.
                    </>
                  )}
                </span>
              </label>
              {checkoutError && (
                <div className="checkout-error" role="alert">
                  {checkoutError}
                </div>
              )}
              <div className="checkout-total">
                <span>{t.checkoutTotalItems(cartUnitCount)}</span>
                <strong>
                  {cartQuote
                    ? formatCents(cartQuote.totalAmount)
                    : money.format(total)}
                </strong>
              </div>
              {!cartQuote && quoteError && (
                <p className="cart-total-caveat">{t.shippingCaveat}</p>
              )}
              <button
                className="button button-dark wide"
                type="submit"
                disabled={checkoutLoading || !selectedPaymentProvider}
              >
                {checkoutLoading
                  ? t.checkoutPreparing
                  : selectedPaymentProvider
                    ? t.payWith(
                        paymentMethods.find(
                          (method) => method.id === selectedPaymentProvider,
                        )?.name ?? t.selectedMethodFallback,
                      )
                    : t.paymentUnavailable}
              </button>
              <small className="form-note">{t.cardSafetyNote}</small>
            </form>
          </section>
        </div>
      )}

      <div
        key={toast?.id ?? "empty"}
        className={`toast${toast ? ` visible ${toast.kind}` : ""}`}
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        <span className="toast-icon" aria-hidden="true">
          {toast?.kind === "success" ? "✓" : "!"}
        </span>
        <span className="toast-copy">
          <strong>{toast?.title}</strong>
          <small>{toast?.detail}</small>
        </span>
      </div>
    </CartContext.Provider>
  );
}
