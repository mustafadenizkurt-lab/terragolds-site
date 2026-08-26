import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const result = await getD1().prepare(
    "SELECT logs.id, logs.supplier_id AS supplierId, suppliers.name AS supplierName, logs.status, logs.started_at AS startedAt, logs.completed_at AS completedAt, logs.imported_count AS importedCount, logs.updated_count AS updatedCount, logs.skipped_count AS skippedCount, logs.error_message AS errorMessage FROM xml_sync_logs logs LEFT JOIN xml_suppliers suppliers ON suppliers.id = logs.supplier_id ORDER BY logs.started_at DESC LIMIT 100",
  ).all();
  return Response.json({ logs: result.results });
}