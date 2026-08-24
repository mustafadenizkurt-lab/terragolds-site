import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  const bindings = env as unknown as { DB?: D1Database };
  if (!bindings.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in config/hosting.json to `DB` or inject the binding before using the database."
    );
  }

  return drizzle(bindings.DB, { schema });
}
