import { getDiscountedPrice } from "./store-data";
import { getD1, readSettings } from "./store-db";
import { VAT_RATE } from "./xml-sync/calculatePrice";

export type CartInputItem = {
  productId: number;
  quantity: number;
};

export type PricedCartItem = {
  product: {
    id: number;
    name: string;
    category: string;
    price: number;
    discountPercent: number;
    stock: number;
    status: string;
  };
  quantity: number;
  unitPrice: number;
};

export class CartUnavailableProductError extends Error {
  readonly productIds: number[];

  constructor(productIds: number[]) {
    super("Sepette artık satışta olmayan bir ürün var.");
    this.name = "CartUnavailableProductError";
    this.productIds = productIds;
  }
}

type DiscountRow = {
  code: string;
  description: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  minimum_order_amount: number;
  usage_limit: number;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
};

export function normalizeCartItems(value: unknown): CartInputItem[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) {
    throw new Error("Sepet boş veya geçersiz.");
  }

  const quantities = new Map<number, number>();
  for (const item of value) {
    if (!item || typeof item !== "object") {
      throw new Error("Sepette geçersiz ürün var.");
    }
    const row = item as Partial<CartInputItem>;
    const productId = Number(row.productId);
    const quantity = Number(row.quantity);
    if (
      !Number.isInteger(productId) ||
      productId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      quantity > 20
    ) {
      throw new Error("Sepet miktarı geçersiz.");
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

export function normalizeDiscountCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, 40);
}

export function parseTlToKurus(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.min(99_999_900, Math.round(amount * 100));
}

export async function calculateCartQuote(
  itemsInput: unknown,
  discountCodeInput?: unknown,
) {
  const items = normalizeCartItems(itemsInput);
  const db = getD1();
  const products = await Promise.all(
    items.map((item) =>
      db
        .prepare(
          `SELECT id, name, category, price,
                  discount_percent AS discountPercent, stock, status
           FROM products WHERE id = ?`,
        )
        .bind(item.productId)
        .first<PricedCartItem["product"]>(),
    ),
  );

  const unavailableProductIds = items
    .filter((_, index) => {
      const product = products[index];
      return !product || product.status !== "published";
    })
    .map((item) => item.productId);
  if (unavailableProductIds.length > 0) {
    throw new CartUnavailableProductError(unavailableProductIds);
  }

  let subtotalAmount = 0;
  const pricedItems = items.map((item, index) => {
    const product = products[index]!;
    if (product.stock < item.quantity) {
      throw new Error(`${product.name} için yeterli stok bulunmuyor.`);
    }
    const unitPrice = getDiscountedPrice(product) * 100;
    subtotalAmount += unitPrice * item.quantity;
    return { product, quantity: item.quantity, unitPrice };
  });

  if (subtotalAmount <= 0 || subtotalAmount > 99_999_900) {
    throw new Error("Sipariş tutarı geçersiz.");
  }

  const discountCode = normalizeDiscountCode(discountCodeInput);
  let discount: DiscountRow | null = null;
  let discountAmount = 0;
  if (discountCode) {
    discount = await db
      .prepare(
        `SELECT code, description, discount_type, discount_value,
                minimum_order_amount, usage_limit, used_count,
                starts_at, expires_at
         FROM discount_codes
         WHERE code = ? AND active = 1`,
      )
      .bind(discountCode)
      .first<DiscountRow>();

    const now = Date.now();
    if (
      !discount ||
      (discount.starts_at && new Date(discount.starts_at).getTime() > now) ||
      (discount.expires_at && new Date(discount.expires_at).getTime() <= now) ||
      (discount.usage_limit > 0 &&
        discount.used_count >= discount.usage_limit)
    ) {
      throw new Error("Bu indirim kodu geçerli değil veya süresi dolmuş.");
    }
    if (subtotalAmount < discount.minimum_order_amount) {
      const minimum = new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
      }).format(discount.minimum_order_amount / 100);
      throw new Error(`Bu kod için sepet tutarı en az ${minimum} olmalıdır.`);
    }
    discountAmount =
      discount.discount_type === "percent"
        ? Math.round((subtotalAmount * discount.discount_value) / 100)
        : Math.min(subtotalAmount, discount.discount_value);
  }

  const settings = await readSettings();
  const shippingFee = parseTlToKurus(settings.shippingFee);
  const freeShippingThreshold = parseTlToKurus(
    settings.freeShippingThreshold,
  );
  const discountedSubtotal = Math.max(0, subtotalAmount - discountAmount);
  const freeShipping =
    freeShippingThreshold > 0 &&
    discountedSubtotal >= freeShippingThreshold;
  const shippingAmount = freeShipping ? 0 : shippingFee;
  // `price` is now treated as VAT-exclusive: KDV is added on top here, on
  // the discounted subtotal (net of any discount code - VAT is only owed
  // on what the customer actually pays for the goods, not the pre-discount
  // list price). Shipping is not taxed here (kept as its own line, matching
  // the requested breakdown).
  const vatAmount = Math.round(discountedSubtotal * VAT_RATE);
  const totalAmount = discountedSubtotal + vatAmount + shippingAmount;
  if (totalAmount <= 0 || totalAmount > 99_999_900) {
    throw new Error("Ödenecek sipariş tutarı geçersiz.");
  }

  return {
    items: pricedItems,
    subtotalAmount,
    discountAmount,
    vatAmount,
    shippingAmount,
    shippingFee,
    freeShipping,
    freeShippingThreshold,
    totalAmount,
    discountCode: discount?.code ?? null,
    discountDescription: discount?.description ?? "",
  };
}
