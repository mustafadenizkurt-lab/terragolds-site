import {
  customerUnauthorizedResponse,
  getCustomerFromRequest,
  isSameOriginRequest,
} from "../../../../../lib/customer-auth";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ReviewRow = {
  id: number;
  rating: number;
  title: string;
  comment: string;
  first_name: string;
  last_name: string;
  created_at: string;
};

function parseProductId(value: string) {
  const productId = Number(value);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
}

function displayName(firstName: string, lastName: string) {
  const initial = lastName.trim().charAt(0).toLocaleUpperCase("tr-TR");
  return `${firstName.trim()}${initial ? ` ${initial}.` : ""}`;
}

async function getReviewPermission(request: Request, productId: number) {
  const user = await getCustomerFromRequest(request);
  if (!user) {
    return {
      user: null,
      canReview: false,
      hasReviewed: false,
      verifiedOrderId: null,
    };
  }

  const db = getD1();
  const [existingReview, verifiedOrder] = await Promise.all([
    db
      .prepare(
        `SELECT id FROM product_reviews
         WHERE user_id = ? AND product_id = ? LIMIT 1`,
      )
      .bind(user.id, productId)
      .first<{ id: number }>(),
    db
      .prepare(
        `SELECT orders.id
         FROM orders
         INNER JOIN order_items ON order_items.order_id = orders.id
         WHERE orders.user_id = ?
           AND order_items.product_id = ?
           AND orders.status IN ('paid', 'shipped', 'delivered')
         ORDER BY COALESCE(orders.paid_at, orders.created_at) DESC
         LIMIT 1`,
      )
      .bind(user.id, productId)
      .first<{ id: string }>(),
  ]);

  return {
    user,
    canReview: Boolean(verifiedOrder) && !existingReview,
    hasReviewed: Boolean(existingReview),
    verifiedOrderId: verifiedOrder?.id ?? null,
  };
}

export async function GET(request: Request, context: RouteContext) {
  const productId = parseProductId((await context.params).id);
  if (!productId) {
    return Response.json({ error: "Geçersiz ürün." }, { status: 400 });
  }

  const db = getD1();
  const product = await db
    .prepare(
      "SELECT id FROM products WHERE id = ? AND status = 'published' LIMIT 1",
    )
    .bind(productId)
    .first<{ id: number }>();
  if (!product) {
    return Response.json({ error: "Ürün bulunamadı." }, { status: 404 });
  }

  const [reviewRows, permission] = await Promise.all([
    db
      .prepare(
        `SELECT product_reviews.id, product_reviews.rating,
                product_reviews.title, product_reviews.comment,
                product_reviews.created_at,
                users.first_name, users.last_name
         FROM product_reviews
         INNER JOIN users ON users.id = product_reviews.user_id
         WHERE product_reviews.product_id = ?
         ORDER BY product_reviews.created_at DESC, product_reviews.id DESC`,
      )
      .bind(productId)
      .all<ReviewRow>(),
    getReviewPermission(request, productId),
  ]);

  const reviews = reviewRows.results.map((review) => ({
    id: review.id,
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    customerName: displayName(review.first_name, review.last_name),
    createdAt: review.created_at,
    verifiedPurchase: true,
  }));
  const averageRating = reviews.length
    ? Math.round(
        (reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviews.length) *
          10,
      ) / 10
    : 0;

  return Response.json(
    {
      reviews,
      summary: { averageRating, reviewCount: reviews.length },
      viewer: {
        signedIn: Boolean(permission.user),
        canReview: permission.canReview,
        hasReviewed: permission.hasReviewed,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  const productId = parseProductId((await context.params).id);
  if (!productId) {
    return Response.json({ error: "Geçersiz ürün." }, { status: 400 });
  }

  const permission = await getReviewPermission(request, productId);
  if (!permission.user) return customerUnauthorizedResponse();
  if (permission.hasReviewed) {
    return Response.json(
      { error: "Bu ürün için daha önce yorum yaptınız." },
      { status: 409 },
    );
  }
  if (!permission.canReview || !permission.verifiedOrderId) {
    return Response.json(
      { error: "Yalnızca bu ürünü satın alan üyeler yorum yapabilir." },
      { status: 403 },
    );
  }

  let body: { rating?: unknown; title?: unknown; comment?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Yorum bilgileri okunamadı." }, { status: 400 });
  }

  const rating = Number(body.rating);
  const title = String(body.title ?? "").trim();
  const comment = String(body.comment ?? "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json(
      { error: "Lütfen 1 ile 5 arasında bir puan seçin." },
      { status: 400 },
    );
  }
  if (title.length > 80) {
    return Response.json(
      { error: "Yorum başlığı en fazla 80 karakter olabilir." },
      { status: 400 },
    );
  }
  if (comment.length < 10 || comment.length > 1000) {
    return Response.json(
      { error: "Yorumunuz 10 ile 1000 karakter arasında olmalıdır." },
      { status: 400 },
    );
  }

  try {
    await getD1()
      .prepare(
        `INSERT INTO product_reviews
          (product_id, user_id, verified_order_id, rating, title, comment)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        productId,
        permission.user.id,
        permission.verifiedOrderId,
        rating,
        title,
        comment,
      )
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.toLocaleLowerCase("en-US").includes("unique")) {
      return Response.json(
        { error: "Bu ürün için daha önce yorum yaptınız." },
        { status: 409 },
      );
    }
    throw error;
  }

  return Response.json({ ok: true }, { status: 201 });
}
