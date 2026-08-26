import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import {
  applyMapping,
  detectFieldNames,
  guessFieldMapping,
  parseSupplierXml,
  resolveSupplierXml,
  PREVIEW_ROW_COUNT,
  type FieldMapping,
} from "../../../../../lib/supplier-import";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const form = await request.formData();
    const xmlText = await resolveSupplierXml(form);
    const records = parseSupplierXml(xmlText);
    const fieldNames = detectFieldNames(records);

    const mappingRaw = String(form.get("mapping") ?? "");
    let mapping: FieldMapping;
    if (mappingRaw) {
      try {
        mapping = JSON.parse(mappingRaw) as FieldMapping;
      } catch {
        return Response.json(
          { error: "Eşleştirme verisi okunamadı." },
          { status: 400 },
        );
      }
    } else {
      mapping = guessFieldMapping(fieldNames);
    }

    if (!mapping.name || !mapping.price) {
      return Response.json({
        fieldNames,
        mapping,
        totalRecords: records.length,
        rows: [],
        validCount: 0,
        errors: [],
        errorCount: 0,
      });
    }

    const markupPercent = Number(form.get("markupPercent") ?? 0) || 0;
    const { rows, errors } = applyMapping(records, mapping, markupPercent);

    return Response.json({
      fieldNames,
      mapping,
      totalRecords: records.length,
      rows: rows.slice(0, PREVIEW_ROW_COUNT).map((row) => ({
        index: row.index,
        warnings: row.warnings,
        product: row.product,
      })),
      validCount: rows.length,
      errors: errors.slice(0, 20),
      errorCount: errors.length,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "XML işlenemedi." },
      { status: 400 },
    );
  }
}
