import {
  contentGroups,
  defaultSiteContent,
  siteContentKeys,
  type SiteContent,
  type SiteContentKey,
} from "./site-content-types";
import { getD1 } from "./store-db";

type ContentRow = {
  key: string;
  draft_value: string;
  published_value: string;
  published_at: string | null;
  updated_at: string;
};

async function readRows() {
  return getD1()
    .prepare(
      `SELECT key, draft_value, published_value, published_at, updated_at
       FROM site_content`,
    )
    .all<ContentRow>();
}

export async function readPublishedSiteContent() {
  const rows = await readRows();
  const content = { ...defaultSiteContent };
  for (const row of rows.results) {
    if (siteContentKeys.includes(row.key as SiteContentKey)) {
      // Not `row.published_value || default` - an admin can deliberately
      // clear a field to blank, and that's a real, distinct value from
      // "never configured" (which is what the initial defaultSiteContent
      // spread above already covers for keys with no row at all).
      content[row.key as SiteContentKey] = row.published_value;
    }
  }
  return content;
}

export async function readAdminSiteContent() {
  const rows = await readRows();
  const draft = { ...defaultSiteContent };
  const published = { ...defaultSiteContent };
  let publishedAt: string | null = null;
  let updatedAt: string | null = null;
  for (const row of rows.results) {
    if (!siteContentKeys.includes(row.key as SiteContentKey)) continue;
    const key = row.key as SiteContentKey;
    // Same reasoning as readPublishedSiteContent above - a deliberately
    // blanked field must stay blank, not fall back to an older/default value.
    draft[key] = row.draft_value;
    published[key] = row.published_value;
    if (row.published_at && (!publishedAt || row.published_at > publishedAt)) {
      publishedAt = row.published_at;
    }
    if (!updatedAt || row.updated_at > updatedAt) updatedAt = row.updated_at;
  }
  return {
    draft,
    published,
    hasUnpublishedChanges: siteContentKeys.some(
      (key) => draft[key] !== published[key],
    ),
    publishedAt,
    updatedAt,
  };
}

export async function saveSiteContent(input: {
  values: Partial<SiteContent>;
  action: "draft" | "publish";
  updatedBy: number;
}) {
  const current = await readAdminSiteContent();
  const values = { ...current.draft };
  const fieldMaximums = new Map(
    contentGroups.flatMap((group) =>
      group.fields.map((field) => [field.key, field.maximum] as const),
    ),
  );
  for (const key of siteContentKeys) {
    if (input.values[key] === undefined) continue;
    const value = String(input.values[key] ?? "").trim();
    const maximum = fieldMaximums.get(key);
    if (maximum && value.length > maximum) {
      throw new Error(`İçerik alanı en fazla ${maximum} karakter olabilir.`);
    }
    values[key] = value;
  }

  const db = getD1();
  await db.batch(
    siteContentKeys.map((key) => {
      // `values` was seeded from current.draft (every key already has a
      // string, possibly "") and only overwritten above for keys the admin
      // actually submitted - never undefined here, so no `|| default`
      // fallback is needed (and none should exist: it would silently
      // discard an intentionally-cleared field).
      const draftValue = values[key];
      const publishedValue =
        input.action === "publish" ? draftValue : current.published[key];
      return db
        .prepare(
          `INSERT INTO site_content
            (key, draft_value, published_value, updated_by,
             published_at, updated_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET
             draft_value = excluded.draft_value,
             published_value = excluded.published_value,
             updated_by = excluded.updated_by,
             published_at = CASE
               WHEN ? = 'publish' THEN CURRENT_TIMESTAMP
               ELSE site_content.published_at
             END,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          key,
          draftValue,
          publishedValue,
          input.updatedBy,
          input.action === "publish"
            ? new Date().toISOString()
            : null,
          input.action,
        );
    }),
  );
  return readAdminSiteContent();
}
