import { getD1 } from "./store-db";

export type CustomOrderGalleryItem = {
  id: number;
  imageUrl: string;
  title: string;
  description: string;
  createdAt: string;
};

type CustomOrderGalleryRow = {
  id: number;
  image_url: string;
  title: string;
  description: string;
  created_at: string;
};

export async function ensureCustomOrderGalleryTable() {
  await getD1()
    .prepare(
      `CREATE TABLE IF NOT EXISTS custom_order_gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_url TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
}

function mapRow(row: CustomOrderGalleryRow): CustomOrderGalleryItem {
  return {
    id: row.id,
    imageUrl: row.image_url,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
  };
}

export async function readCustomOrderGallery(): Promise<
  CustomOrderGalleryItem[]
> {
  const { results } = await getD1()
    .prepare(
      `SELECT id, image_url, title, description, created_at
       FROM custom_order_gallery
       ORDER BY id DESC`,
    )
    .all<CustomOrderGalleryRow>();
  return results.map(mapRow);
}

export async function createCustomOrderGalleryItem(input: {
  imageUrl: string;
  title: string;
  description: string;
}) {
  await getD1()
    .prepare(
      `INSERT INTO custom_order_gallery (image_url, title, description)
       VALUES (?, ?, ?)`,
    )
    .bind(input.imageUrl, input.title, input.description)
    .run();
}

export async function updateCustomOrderGalleryItem(
  id: number,
  input: { title: string; description: string },
) {
  const result = await getD1()
    .prepare(
      `UPDATE custom_order_gallery SET title = ?, description = ? WHERE id = ?`,
    )
    .bind(input.title, input.description, id)
    .run();
  if (!result.meta.changes) {
    throw new Error("Galeri öğesi bulunamadı.");
  }
}

export async function deleteCustomOrderGalleryItem(id: number) {
  await getD1()
    .prepare(`DELETE FROM custom_order_gallery WHERE id = ?`)
    .bind(id)
    .run();
}
