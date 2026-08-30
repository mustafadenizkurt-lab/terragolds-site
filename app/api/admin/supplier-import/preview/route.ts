import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import {
  applyMapping,
  detectFieldNames,
  distinctFieldValuesMulti,
  guessFieldMapping,
  parseSupplierXml,
  resolveSupplierXml,
  PREVIEW_ROW_COUNT,
  type FieldMapping,
} from "../../../../../lib/supplier-import";
import type { ImportFilters } from "../../../../../lib/xml-import-filters";

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

    const distinctValues = distinctFieldValuesMulti(records, [mapping.category, mapping.brand]);
    const categoryOptions = mapping.category ? distinctValues[mapping.category] : [];
    const brandOptions = mapping.brand ? distinctValues[mapping.brand] : [];

    if (!mapping.name || !mapping.price) {
      return Response.json({
        fieldNames,
        mapping,
        totalRecords: records.length,
        rows: [],
        validCount: 0,
        errors: [],
        errorCount: 0,
        filteredCount: 0,
        categoryOptions,
        brandOptions,
      });
    }

    const filtersRaw = String(form.get("filters") ?? "");
    let filters: ImportFilters = {};
    if (filtersRaw) {
      try {
        filters = JSON.parse(filtersRaw) as ImportFilters;
      } catch {
        return Response.json({ error: "Filtre verisi okunamadı." }, { status: 400 });
      }
    }

    const markupPercent = Number(form.get("markupPercent") ?? 0) || 0;
    const { rows, errors, filteredCount } = applyMapping(records, mapping, markupPercent, filters);

    return Response.json({
      fieldNames,
      mapping,
      totalRecords: records.length,
      rows: rows.slice(0, PREVIEW_ROW_COUNT).map((row) => ({
        index: row.index,
        warnings: row.warnings,
        product: row.product,
        brand: row.brand,
      })),
      validCount: rows.length,
      errors: errors.slice(0, 20),
      errorCount: errors.length,
      filteredCount,
      categoryOptions,
      brandOptions,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "XML işlenemedi." },
      { status: 400 },
    );
  }
}
