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
import type { PaymentProviderId, PaymentProviderSummary } from "./payment-types";

export type CartEntry = {
  productId: number;
  quantity: number;
};

export type CartQuote = {
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  shippingFee: number;
  freeShipping: boolean;
  freeShippingThreshold: number;
  totalAmount: number;
  discountCode: string | null;
  discountDescription: string;
};

export type PublicPaymentMethod = Omit<
  PaymentProviderSummary,
  "credentialHint" | "fields"
>;

type CartToast = {
  id: number;
  kind: "success" | "error";
  title: string;
  detail: string;
};

type HeaderUser = {
  firstName: string;
  lastName: string;
  email: string;
};

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
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutEmail, setCheckoutEmail] = useState("");
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
    useState<PaymentProviderId | null>(null);
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

    fetch("/api/store", { cache: "no-store" })
      .then(
        (response) =>
          response.json() as Promise<{ products?: Product[]; warning?: string }>,
      )
      .then((data) => {
        if (data.products) {
          setProducts(data.products);
          if (!data.warning) {
            setCart((current) =>
              reconcileCartWithProducts(current, data.products ?? []),
            );
          }
        }
      })
      .catch(() => {});

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
          throw new Error(body.error ?? "Sepet özeti hesaplanamadı.");
        }
        setCartQuote(body);
        if (body.discountCode) {
          setCouponMessage(
            body.discountDescription || `${body.discountCode} kodu uygulandı.`,
          );
          setCouponError("");
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setCartQuote(null);
        setQuoteError(
          error instanceof Error ? error.message : "Kargo tutarı hesaplanamadı.",
        );
        if (appliedDiscountCode) {
          setCouponError(
            error instanceof Error ? error.message : "İndirim kodu uygulanamadı.",
          );
          setCouponMessage("");
          setAppliedDiscountCode("");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setQuoteLoading(false);
      });

    return () => controller.abort();
  }, [cart, appliedDiscountCode]);

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
        title: "Lütfen kısa bir süre bekleyin",
        detail: `${remainingCooldown} saniye sonra yeniden ürün ekleyebilirsiniz.`,
      });
      return false;
    }
    if (product.stock <= 0) {
      showToast({
        kind: "error",
        title: "Stokta yok",
        detail: "Bu ürün şu anda mağazamızda bulunmuyor.",
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
        title: "Yeterli stok bulunmuyor",
        detail: `${product.name} için sepette en fazla ${maximumQuantity} adet olabilir.`,
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
      title: "Ürün sepete eklendi",
      detail: `${safeQuantity} adet ${product.name} · Sepetinizde ${
        cartUnitCount + safeQuantity
      } ürün`,
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
        title: "Stok sınırına ulaştınız",
        detail: `${product.name} için en fazla ${maximum} adet seçebilirsiniz.`,
      });
    }
  };

  const beginCheckout = () => {
    setCartOpen(false);
    setCheckoutEmail(authUser?.email ?? "");
    setCheckoutError("");
    setCheckoutOpen(true);
  };

  const applyDiscountCode = async () => {
    const code = couponInput.trim().toUpperCase().replace(/\s+/g, "");
    if (!code) {
      setCouponError("Önce indirim kodunu yazın.");
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
        throw new Error(body.error ?? "İndirim kodu uygulanamadı.");
      }
      setCartQuote(body);
      setAppliedDiscountCode(body.discountCode ?? "");
      setCouponInput(body.discountCode ?? code);
      setCouponMessage(
        body.discountDescription || `${body.discountCode ?? code} kodu uygulandı.`,
      );
    } catch (applyError) {
      setCouponError(
        applyError instanceof Error
          ? applyError.message
          : "İndirim kodu uygulanamadı.",
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
        throw new Error("Geçerli bir ödeme yöntemi seçin.");
      }
      const response = await fetch("/api/checkout/payment", {
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
        throw new Error(body.error ?? "Ödeme başlatılamadı.");
      }
      if (body.redirectUrl) {
        window.location.assign(body.redirectUrl);
        return;
      }
      if (!body.action || !body.fields) {
        throw new Error("Ödeme sağlayıcısından geçerli yönlendirme alınamadı.");
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
          : "Ödeme başlatılamadı.",
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
            aria-label="Alışveriş sepetiniz"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                {cartUnitCount > 0 && (
                  <span className="drawer-count">{cartUnitCount} ürün</span>
                )}
              </div>
              <div className="drawer-actions">
                <button
                  className="drawer-close"
                  type="button"
                  onClick={() => setCartOpen(false)}
                  aria-label="Kapat"
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
                  <h3>Henüz ürün eklemediniz</h3>
                  <p>
                    Beğendiğiniz doğal taşları sepetinize ekleyerek
                    alışverişinizi tamamlayabilirsiniz.
                  </p>
                  <button
                    type="button"
                    className="button button-dark"
                    onClick={() => setCartOpen(false)}
                  >
                    Alışverişe devam et
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
                                ? `${product.name} ürününü sepetten sil`
                                : `${product.name} adedini azalt`
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
                            aria-label={`${product.name} sepet adedi`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateCartQuantity(product, quantity + 1)
                            }
                            disabled={quantity >= Math.min(product.stock, 20)}
                            aria-label={`${product.name} adedini artır`}
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
                <h3>Sepet Özeti</h3>
                <div className="cart-summary-row">
                  <span>Ara Toplam</span>
                  <strong>
                    {cartQuote
                      ? formatCents(cartQuote.subtotalAmount)
                      : money.format(total)}
                  </strong>
                </div>
                {cartQuote && cartQuote.discountAmount > 0 && (
                  <div className="cart-summary-row discount">
                    <span>İndirim</span>
                    <strong>−{formatCents(cartQuote.discountAmount)}</strong>
                  </div>
                )}
                <div className="cart-summary-row shipping">
                  <span>Kargo Tutarı</span>
                  <strong>
                    {quoteLoading ? (
                      "Hesaplanıyor…"
                    ) : cartQuote?.freeShipping ? (
                      <>
                        <del>{formatCents(cartQuote.shippingFee)}</del>
                        <em>Ücretsiz</em>
                      </>
                    ) : cartQuote ? (
                      formatCents(cartQuote.shippingAmount)
                    ) : (
                      "Hesaplanamadı"
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
                      {formatCents(freeShippingRemaining)} daha ekleyin, kargo
                      ücretsiz olsun.
                    </p>
                  )}
                {totalSavings > 0 && (
                  <div className="cart-savings">
                    <span>Toplam Kazancınız</span>
                    <strong>−{formatCents(totalSavings)}</strong>
                  </div>
                )}
                <div className="cart-summary-total">
                  <span>Toplam</span>
                  <strong>
                    {cartQuote
                      ? formatCents(cartQuote.totalAmount)
                      : money.format(total)}
                  </strong>
                </div>
                {!cartQuote && quoteError && (
                  <p className="cart-total-caveat">
                    Kargo tutarı hesaplanamadığı için gösterilen tutara kargo
                    dahil değildir; kesin tutar ödeme adımında görünecektir.
                  </p>
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
                      placeholder="İndirim kodu"
                      aria-label="İndirim kodu"
                    />
                    <button
                      type="button"
                      onClick={() => void applyDiscountCode()}
                      disabled={quoteLoading}
                    >
                      Uygula
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
                        Kaldır
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
                  ÖDEMEYE GEÇ
                </button>
                <button
                  className="clear-cart-bottom"
                  type="button"
                  onClick={() => {
                    clearCart();
                    showToast({
                      kind: "success",
                      title: "Sepetiniz boşaltıldı",
                      detail: "Alışverişe dilediğiniz zaman devam edebilirsiniz.",
                    });
                  }}
                >
                  <span className="trash-icon" aria-hidden="true" />
                  Sepeti boşalt
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
            aria-label="Sipariş talebi"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setCheckoutOpen(false)}
              aria-label="Kapat"
            >
              ×
            </button>
            <p className="eyebrow">Sipariş talebi</p>
            <h2>Güvenli ödemeye hazırlanın.</h2>
            <p>
              Teslimat bilgilerinizi girin ve kullanmak istediğiniz güvenli
              ödeme yöntemini seçin.
            </p>
            <form onSubmit={submitCheckout}>
              <fieldset className="checkout-payment-methods single">
                <legend>Ödeme yöntemi</legend>
                {paymentMethods.length > 0 ? (
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
                          ? "Test ortamı"
                          : "Güvenli ödeme sayfası"}
                      </small>
                    </span>
                  </div>
                ) : (
                  <div className="checkout-no-provider">
                    Kullanılabilir ödeme yöntemi bulunmuyor.
                  </div>
                )}
              </fieldset>
              <div className="checkout-name-row">
                <label>
                  Ad
                  <input name="firstName" autoComplete="given-name" required />
                </label>
                <label>
                  Soyad
                  <input name="lastName" autoComplete="family-name" required />
                </label>
              </div>
              <label>
                E-posta
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={checkoutEmail}
                  readOnly={Boolean(authUser)}
                  onChange={(event) => setCheckoutEmail(event.target.value)}
                  required
                />
                <small className="checkout-field-note">
                  Sipariş ve teslimat bilgileri bu adrese gönderilir.
                </small>
              </label>
              <label>
                Telefon
                <input name="phone" type="tel" autoComplete="tel" required />
              </label>
              <label>
                Teslimat adresi
                <textarea
                  name="address"
                  rows={2}
                  autoComplete="street-address"
                  required
                />
              </label>
              <div className="checkout-name-row">
                <label>
                  İlçe
                  <input name="district" autoComplete="address-level2" />
                </label>
                <label>
                  Şehir
                  <input name="city" autoComplete="address-level1" required />
                </label>
              </div>
              <label>
                Posta kodu
                <input name="postcode" autoComplete="postal-code" />
              </label>
              <label className="checkout-note-field">
                <span>
                  Sipariş açıklaması <em>İsteğe bağlı</em>
                </span>
                <textarea
                  name="note"
                  rows={4}
                  maxLength={500}
                  placeholder="Paketleme, hediye notu veya teslimatla ilgili özel isteğinizi yazabilirsiniz."
                />
                <small className="checkout-field-note">
                  Açıklamanız paket hazırlanırken yönetim ekranında görüntülenir.
                  En fazla 500 karakter.
                </small>
              </label>
              <label className="checkout-legal-consent">
                <span className="legal-consent-checkbox">
                  <input name="legalConsent" type="checkbox" required />
                </span>
                <span>
                  <a href="/on-bilgilendirme-formu" target="_blank">
                    Ön Bilgilendirme Formu
                  </a>{" "}
                  ile{" "}
                  <a href="/mesafeli-satis-sozlesmesi" target="_blank">
                    Mesafeli Satış Sözleşmesi
                  </a>
                  'ni okudum ve kabul ediyorum.
                </span>
              </label>
              {checkoutError && (
                <div className="checkout-error" role="alert">
                  {checkoutError}
                </div>
              )}
              <div className="checkout-total">
                <span>{cartUnitCount} ürün</span>
                <strong>
                  {cartQuote
                    ? formatCents(cartQuote.totalAmount)
                    : money.format(total)}
                </strong>
              </div>
              {!cartQuote && quoteError && (
                <p className="cart-total-caveat">
                  Kargo tutarı hesaplanamadığı için gösterilen tutara kargo
                  dahil değildir; kesin tutar ödeme sayfasında görünecektir.
                </p>
              )}
              <button
                className="button button-dark wide"
                type="submit"
                disabled={checkoutLoading || !selectedPaymentProvider}
              >
                {checkoutLoading
                  ? "Güvenli ödeme hazırlanıyor…"
                  : selectedPaymentProvider
                    ? `${paymentMethods.find((method) => method.id === selectedPaymentProvider)?.name ?? "Seçilen yöntem"} ile ödemeye geç`
                    : "Ödeme yöntemi kullanılamıyor"}
              </button>
              <small className="form-note">
                Ödeme kart bilgileriniz Terragolds sunucularında tutulmaz.
              </small>
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
