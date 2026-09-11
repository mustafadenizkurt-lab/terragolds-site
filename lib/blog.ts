import { getD1 } from "./store-db";
import { slugify } from "./slugify";

export type BlogPostStatus = "draft" | "published";

export type BlogPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  metaTitle: string;
  metaDescription: string;
  status: BlogPostStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type BlogPostRow = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image: string;
  category: string;
  meta_title: string;
  meta_description: string;
  status: BlogPostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BlogPostInput = {
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  metaTitle: string;
  metaDescription: string;
  status: BlogPostStatus;
  slug?: string;
};

// D1's actual deploy pipeline here never runs `wrangler d1 migrations
// apply` - only `wrangler deploy` for the Worker bundle - so this table is
// created lazily at runtime (same pattern as custom_order_gallery).
export async function ensureBlogTable() {
  await getD1()
    .prepare(
      `CREATE TABLE IF NOT EXISTS blog_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE DEFAULT '',
        title TEXT NOT NULL,
        excerpt TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        cover_image TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        meta_title TEXT NOT NULL DEFAULT '',
        meta_description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        published_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
}

function mapRow(row: BlogPostRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    coverImage: row.cover_image,
    category: row.category,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Admin: every post regardless of status, newest first. */
export async function readBlogPosts(): Promise<BlogPost[]> {
  await ensureBlogTable();
  const { results } = await getD1()
    .prepare(
      `SELECT id, slug, title, excerpt, content, cover_image, category,
              meta_title, meta_description, status, published_at,
              created_at, updated_at
       FROM blog_posts ORDER BY created_at DESC, id DESC`,
    )
    .all<BlogPostRow>();
  return results.map(mapRow);
}

/** Public blog index: published posts only, most recently published first. */
export async function readPublishedBlogPosts(): Promise<BlogPost[]> {
  await ensureBlogTable();
  const { results } = await getD1()
    .prepare(
      `SELECT id, slug, title, excerpt, content, cover_image, category,
              meta_title, meta_description, status, published_at,
              created_at, updated_at
       FROM blog_posts WHERE status = 'published'
       ORDER BY published_at DESC, id DESC`,
    )
    .all<BlogPostRow>();
  return results.map(mapRow);
}

/** Public post page: only resolves a published post - a draft returns null. */
export async function readPublishedBlogPostBySlug(
  slug: string,
): Promise<BlogPost | null> {
  await ensureBlogTable();
  const row = await getD1()
    .prepare(
      `SELECT id, slug, title, excerpt, content, cover_image, category,
              meta_title, meta_description, status, published_at,
              created_at, updated_at
       FROM blog_posts WHERE slug = ? AND status = 'published'`,
    )
    .bind(slug)
    .first<BlogPostRow>();
  return row ? mapRow(row) : null;
}

export async function readBlogPostById(id: number): Promise<BlogPost | null> {
  await ensureBlogTable();
  const row = await getD1()
    .prepare(
      `SELECT id, slug, title, excerpt, content, cover_image, category,
              meta_title, meta_description, status, published_at,
              created_at, updated_at
       FROM blog_posts WHERE id = ?`,
    )
    .bind(id)
    .first<BlogPostRow>();
  return row ? mapRow(row) : null;
}

/** Slug for a post title; falls back to an id suffix on collision, mirrors product-slugs.ts. */
function blogTitleToSlug(
  title: string,
  id: number,
  existingSlugs: ReadonlySet<string>,
): string {
  const base = slugify(title) || `yazi-${id}`;
  if (!existingSlugs.has(base)) return base;
  return `${base}-${id}`;
}

async function resolveBlogSlug(
  title: string,
  id: number,
  providedSlug?: string,
): Promise<string> {
  const requested = providedSlug ? slugify(providedSlug) : "";
  const db = getD1();
  const existing = await db
    .prepare("SELECT slug FROM blog_posts WHERE slug <> '' AND id <> ?")
    .bind(id)
    .all<{ slug: string }>();
  const existingSlugs = new Set(existing.results.map((row) => row.slug));
  if (requested && !existingSlugs.has(requested)) return requested;
  return blogTitleToSlug(title, id, existingSlugs);
}

export function parseBlogPostInput(body: Record<string, unknown>): BlogPostInput {
  const title = String(body.title ?? "").trim().slice(0, 200);
  if (!title) throw new Error("Başlık zorunludur.");
  const status = body.status === "published" ? "published" : "draft";
  return {
    title,
    excerpt: String(body.excerpt ?? "").trim().slice(0, 400),
    content: String(body.content ?? "").trim(),
    coverImage: String(body.coverImage ?? "").trim(),
    category: String(body.category ?? "").trim().slice(0, 60),
    metaTitle: String(body.metaTitle ?? "").trim().slice(0, 200),
    metaDescription: String(body.metaDescription ?? "").trim().slice(0, 300),
    status,
    slug: String(body.slug ?? "").trim().slice(0, 200) || undefined,
  };
}

export async function createBlogPost(input: BlogPostInput): Promise<number> {
  await ensureBlogTable();
  const db = getD1();
  const publishedAt = input.status === "published" ? new Date().toISOString() : null;
  const created = await db
    .prepare(
      `INSERT INTO blog_posts
        (title, excerpt, content, cover_image, category, meta_title,
         meta_description, status, published_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       RETURNING id`,
    )
    .bind(
      input.title,
      input.excerpt,
      input.content,
      input.coverImage,
      input.category,
      input.metaTitle,
      input.metaDescription,
      input.status,
      publishedAt,
    )
    .first<{ id: number }>();
  const id = created?.id;
  if (!id) throw new Error("Yazı oluşturulamadı.");
  const slug = await resolveBlogSlug(input.title, id, input.slug);
  await db.prepare("UPDATE blog_posts SET slug = ? WHERE id = ?").bind(slug, id).run();
  return id;
}

export async function updateBlogPost(id: number, input: BlogPostInput): Promise<void> {
  await ensureBlogTable();
  const db = getD1();
  const existing = await readBlogPostById(id);
  if (!existing) throw new Error("Yazı bulunamadı.");
  const slug = await resolveBlogSlug(input.title, id, input.slug ?? existing.slug);
  // A draft newly switching to published gets a publish date now; publishing
  // again (or staying published) never resets it, so the original date holds.
  const publishedAt =
    input.status === "published"
      ? (existing.publishedAt ?? new Date().toISOString())
      : null;
  const result = await db
    .prepare(
      `UPDATE blog_posts
       SET slug = ?, title = ?, excerpt = ?, content = ?, cover_image = ?,
           category = ?, meta_title = ?, meta_description = ?, status = ?,
           published_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(
      slug,
      input.title,
      input.excerpt,
      input.content,
      input.coverImage,
      input.category,
      input.metaTitle,
      input.metaDescription,
      input.status,
      publishedAt,
      id,
    )
    .run();
  if (!result.meta.changes) throw new Error("Yazı bulunamadı.");
}

export async function deleteBlogPost(id: number): Promise<void> {
  await ensureBlogTable();
  await getD1().prepare("DELETE FROM blog_posts WHERE id = ?").bind(id).run();
}
