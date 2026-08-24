import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../lib/admin-auth";
import {
  defaultSettings,
  settingsKeys,
  type StoreSettings,
} from "../../../../lib/store-data";
import { getD1, readSettings } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  return Response.json({ settings: await readSettings() });
}

export async function PUT(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const body = (await request.json()) as Partial<StoreSettings>;
    const settings = { ...defaultSettings };
    for (const key of settingsKeys) {
      settings[key] = String(body[key] ?? "").trim();
    }

    const db = getD1();
    await db.batch(
      settingsKeys.map((key) =>
        db
          .prepare(
            `INSERT INTO store_settings (key, value, updated_at)
             VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE
             SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
          )
          .bind(key, settings[key]),
      ),
    );

    return Response.json({ settings });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Ayarlar kaydedilemedi.",
      },
      { status: 400 },
    );
  }
}
