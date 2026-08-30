"use client";

import { useEffect, useRef, useState } from "react";
import {
  targetFields,
  type FieldMapping,
  type TargetField,
} from "../../lib/supplier-import";

type SourceType = "url" | "file";

const BATCH_SIZE = 500;

type PreviewRow = {
  index: number;
  warnings: string[];
  product: {
    name: string;
    price: number;
    stock: number;
    category: string;
    image: string;
  };
  brand: string;
};

type RowError = { index: number; reason: string };

type PreviewResponse = {
  fieldNames: string[];
  mapping: FieldMapping;
  totalRecords: number;
  rows: PreviewRow[];
  validCount: number;
  errors: RowError[];
  errorCount: number;
  filteredCount: number;
  categoryOptions: string[];
  brandOptions: string[];
};

type CommitResponse = {
  importId: string;
  imported: number;
  totalValid: number;
  hasMore: boolean;
  errorCount: number;
  errors: RowError[];
};

type ImportResult = {
  imported: number;
  errorCount: number;
  errors: RowError[];
  cancelled: boolean;
};

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(String((body as { error?: string }).error ?? "İşlem tamamlanamadı."));
  }
  return body;
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function SupplierImportPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [sourceType, setSourceType] = useState<SourceType>("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [detecting, setDetecting] = useState(false);
  const [fieldNames, setFieldNames] = useState<string[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [totalRecords, setTotalRecords] = useState<number | null>(null);
  const [markupPercent, setMarkupPercent] = useState("0");

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [excludeZeroStock, setExcludeZeroStock] = useState(false);

  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const cancelRef = useRef(false);

  const [error, setError] = useState("");
  const [existingCategories, setExistingCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/admin/categories", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ categories?: { name: string }[] }>)
      .then((body) =>
        setExistingCategories((body.categories ?? []).map((category) => category.name)),
      )
      .catch(() => setExistingCategories([]));
  }, []);

  const buildFilters = () => {
    const filters: Record<string, unknown> = {};
    if (selectedCategories.length) filters.categories = selectedCategories;
    if (selectedBrands.length) filters.brands = selectedBrands;
    const min = Number(minPrice);
    if (minPrice.trim() && Number.isFinite(min) && min > 0) filters.minPrice = min;
    if (excludeZeroStock) filters.excludeZeroStock = true;
    return filters;
  };

  const buildForm = (extra?: {
    mapping?: FieldMapping;
    includeMarkup?: boolean;
    includeFilters?: boolean;
    offset?: number;
    limit?: number;
    importId?: string;
  }) => {
    const form = new FormData();
    // Once the server has parsed+validated the feed once (importId set),
    // later batches reuse that cached result instead of re-uploading the
    // whole XML and re-parsing it from scratch on every request.
    if (!extra?.importId) {
      form.set("sourceType", sourceType);
      if (sourceType === "url") {
        form.set("url", url.trim());
      } else if (file) {
        form.set("file", file);
      }
    } else {
      form.set("importId", extra.importId);
    }
    if (extra?.mapping) form.set("mapping", JSON.stringify(extra.mapping));
    if (extra?.includeMarkup) form.set("markupPercent", markupPercent || "0");
    if (extra?.includeFilters) form.set("filters", JSON.stringify(buildFilters()));
    if (extra?.offset !== undefined) form.set("offset", String(extra.offset));
    if (extra?.limit !== undefined) form.set("limit", String(extra.limit));
    return form;
  };

  const sourceReady =
    sourceType === "url" ? url.trim().length > 0 : file !== null;

  const detectFields = async () => {
    if (!sourceReady) {
      setError("Önce bir XML linki girin veya dosya seçin.");
      return;
    }
    setDetecting(true);
    setError("");
    setPreview(null);
    setResult(null);
    try {
      const body = await readJson<PreviewResponse>(
        await fetch("/api/admin/supplier-import/preview", {
          method: "POST",
          body: buildForm(),
        }),
      );
      setFieldNames(body.fieldNames);
      setMapping(body.mapping);
      setTotalRecords(body.totalRecords);
      if (!body.fieldNames.length) {
        setError("XML içinde alan bulunamadı.");
      }
    } catch (detectError) {
      setError(
        detectError instanceof Error ? detectError.message : "XML okunamadı.",
      );
      setFieldNames([]);
      setTotalRecords(null);
    } finally {
      setDetecting(false);
    }
  };

  const updateMapping = (target: TargetField, field: string) => {
    setMapping((current) => ({ ...current, [target]: field || undefined }));
    setPreview(null);
    setResult(null);
    if (target === "category") setSelectedCategories([]);
    if (target === "brand") setSelectedBrands([]);
  };

  const runPreview = async () => {
    if (!mapping.name || !mapping.price) {
      setError("Ürün Adı ve Fiyat alanlarını eşleştirmeden önizleme yapılamaz.");
      return;
    }
    setPreviewing(true);
    setError("");
    setResult(null);
    try {
      const body = await readJson<PreviewResponse>(
        await fetch("/api/admin/supplier-import/preview", {
          method: "POST",
          body: buildForm({ mapping, includeMarkup: true, includeFilters: true }),
        }),
      );
      setPreview(body);
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Önizleme oluşturulamadı.",
      );
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };

  const runImport = async () => {
    if (!preview || preview.validCount === 0) return;
    if (
      !window.confirm(
        `${preview.validCount} ürün taslak olarak eklenecek. Devam edilsin mi?`,
      )
    ) {
      return;
    }
    setImporting(true);
    setError("");
    setResult(null);
    cancelRef.current = false;
    setProgress({ done: 0, total: preview.validCount });

    let imported = 0;
    let errorCount = 0;
    let firstBatchErrors: RowError[] = [];
    let offset = 0;
    let importId: string | undefined;

    try {
      while (!cancelRef.current) {
        const body = await readJson<CommitResponse>(
          await fetch("/api/admin/supplier-import/commit", {
            method: "POST",
            body: buildForm({
              mapping,
              includeMarkup: true,
              includeFilters: true,
              offset,
              limit: BATCH_SIZE,
              importId,
            }),
          }),
        );
        importId = body.importId;
        imported += body.imported;
        errorCount = body.errorCount;
        if (offset === 0) firstBatchErrors = body.errors;
        setProgress({ done: imported, total: body.totalValid });
        if (!body.hasMore || body.imported === 0) break;
        offset += BATCH_SIZE;
      }
      setResult({
        imported,
        errorCount,
        errors: firstBatchErrors,
        cancelled: cancelRef.current,
      });
      onNotice(
        cancelRef.current
          ? `İptal edildi, ${imported} ürün taslak olarak eklendi.`
          : `${imported} ürün taslak olarak eklendi.`,
      );
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "İçe aktarma başarısız oldu.",
      );
    } finally {
      setImporting(false);
      setProgress(null);
    }
  };

  const cancelImport = () => {
    cancelRef.current = true;
  };

  return (
    <div className="admin-panel admin-supplier-import">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-kicker">Ürünler</p>
          <h2>Tedarikçi İçe Aktarma</h2>
          <p>
            Bir tedarikçinin XML ürün akışından toplu ürün aktarın. Aktarılan
            ürünler, siz gözden geçirip yayınlayana kadar taslak olarak kalır.
          </p>
        </div>
      </div>

      {error && (
        <div className="admin-inline-error" role="alert">
          {error}
        </div>
      )}

      <section className="admin-supplier-step">
        <h3>1. XML kaynağı</h3>
        <div className="admin-supplier-source-toggle">
          <label>
            <input
              type="radio"
              name="sourceType"
              checked={sourceType === "url"}
              onChange={() => {
                setSourceType("url");
                setFieldNames([]);
                setPreview(null);
                setResult(null);
              }}
            />
            Link (URL)
          </label>
          <label>
            <input
              type="radio"
              name="sourceType"
              checked={sourceType === "file"}
              onChange={() => {
                setSourceType("file");
                setFieldNames([]);
                setPreview(null);
                setResult(null);
              }}
            />
            Dosya yükle
          </label>
        </div>
        {sourceType === "url" ? (
          <label className="admin-field full">
            <span>XML linki</span>
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://tedarikci.com/urunler.xml"
            />
          </label>
        ) : (
          <label className="admin-field full">
            <span>XML dosyası</span>
            <input
              type="file"
              accept=".xml,text/xml,application/xml"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
        )}
        <button
          className="admin-secondary-button"
          type="button"
          disabled={detecting || !sourceReady}
          onClick={() => void detectFields()}
        >
          {detecting ? "Okunuyor…" : "Getir ve Eşleştir"}
        </button>
        {totalRecords !== null && (
          <p className="admin-supplier-hint">
            XML&apos;de {totalRecords} kayıt bulundu, {fieldNames.length} alan tespit edildi.
          </p>
        )}
      </section>

      {fieldNames.length > 0 && (
        <section className="admin-supplier-step">
          <h3>2. Alan eşleştirme</h3>
          <div className="admin-supplier-mapping">
            {targetFields.map(({ key, label, required }) => (
              <label key={key} className="admin-field">
                <span>
                  {label}
                  {required ? " *" : ""}
                </span>
                <select
                  value={mapping[key] ?? ""}
                  onChange={(event) => updateMapping(key, event.target.value)}
                >
                  <option value="">— seçilmedi —</option>
                  {fieldNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {existingCategories.length > 0 && (
            <p className="admin-supplier-hint">
              Mevcut kategoriler (Kategori alanındaki metin bunlarla birebir
              eşleşirse ürün o kategoriye eklenir, eşleşmezse yeni bir kategori
              adı olarak kaydedilir): {existingCategories.join(", ")}
            </p>
          )}

          <h3>3. Kâr marjı</h3>
          <label className="admin-field">
            <span>% Kâr marjı (XML fiyatına eklenir)</span>
            <input
              type="number"
              min="0"
              max="500"
              value={markupPercent}
              onChange={(event) => setMarkupPercent(event.target.value)}
            />
          </label>

          <button
            className="admin-primary-button"
            type="button"
            disabled={previewing || !mapping.name || !mapping.price}
            onClick={() => void runPreview()}
          >
            {previewing ? "Önizleniyor…" : "Önizle"}
          </button>
        </section>
      )}

      {preview && (
        <section className="admin-supplier-step">
          <h3>4. Filtreler</h3>
          <p className="admin-supplier-hint">
            Sadece istediğiniz ürünleri içe aktarmak için filtre seçin, sonra
            değişikliği görmek için tekrar &quot;Önizle&quot;ye tıklayın. Hiçbir
            şey seçilmezse tüm ürünler alınır.
          </p>
          <div className="admin-supplier-filters">
            {preview.categoryOptions.length > 0 && (
              <div className="admin-supplier-filter-group">
                <span>Kategori (seçilenler alınır)</span>
                <div className="admin-supplier-checkbox-list">
                  {preview.categoryOptions.map((category) => (
                    <label key={category}>
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category)}
                        onChange={() =>
                          setSelectedCategories((current) => toggleValue(current, category))
                        }
                      />
                      {category}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {preview.brandOptions.length > 0 && (
              <div className="admin-supplier-filter-group">
                <span>Marka (seçilenler alınır)</span>
                <div className="admin-supplier-checkbox-list">
                  {preview.brandOptions.map((brand) => (
                    <label key={brand}>
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(brand)}
                        onChange={() =>
                          setSelectedBrands((current) => toggleValue(current, brand))
                        }
                      />
                      {brand}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className="admin-field">
              <span>Minimum fiyat (TL)</span>
              <input
                type="number"
                min="0"
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                placeholder="ör. 100"
              />
            </label>
            <div className="admin-supplier-source-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={excludeZeroStock}
                  onChange={(event) => setExcludeZeroStock(event.target.checked)}
                />
                Stoku 0 olan ürünleri alma
              </label>
            </div>
          </div>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={previewing}
            onClick={() => void runPreview()}
          >
            {previewing ? "Önizleniyor…" : "Filtreyi uygula (yeniden önizle)"}
          </button>

          <h3>5. Önizleme</h3>
          <p className="admin-supplier-hint">
            {preview.validCount} / {preview.totalRecords} kayıt geçerli
            {preview.filteredCount > 0 && `, ${preview.filteredCount} kayıt filtrelendi`}
            {preview.errorCount > 0 && `, ${preview.errorCount} kayıt atlanacak`}.
            İlk {preview.rows.length} geçerli kayıt aşağıda gösteriliyor.
          </p>

          {preview.rows.length > 0 && (
            <div className="admin-supplier-table-wrap">
              <table className="admin-supplier-table">
                <thead>
                  <tr>
                    <th>Ürün Adı</th>
                    <th>Fiyat</th>
                    <th>Stok</th>
                    <th>Kategori</th>
                    {mapping.brand && <th>Marka</th>}
                    <th>Görsel</th>
                    <th>Uyarılar</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.index}>
                      <td>{row.product.name}</td>
                      <td>{money.format(row.product.price)}</td>
                      <td>{row.product.stock}</td>
                      <td>{row.product.category || "—"}</td>
                      {mapping.brand && <td>{row.brand || "—"}</td>}
                      <td className="admin-supplier-image-cell">
                        {row.product.image || "—"}
                      </td>
                      <td>
                        {row.warnings.length
                          ? row.warnings.join(" ")
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.errors.length > 0 && (
            <div className="admin-supplier-errors">
              <strong>Hata listesi (atlanacak satırlar)</strong>
              <ul>
                {preview.errors.map((rowError) => (
                  <li key={rowError.index}>
                    Satır {rowError.index + 1}: {rowError.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {progress && (
            <div className="admin-supplier-progress">
              <p className="admin-supplier-hint">
                {progress.done} / {progress.total} ürün aktarıldı…
              </p>
              <div className="admin-supplier-progress-bar">
                <span
                  style={{
                    width: `${progress.total ? Math.min(100, (progress.done / progress.total) * 100) : 0}%`,
                  }}
                />
              </div>
              <button className="admin-secondary-button" type="button" onClick={cancelImport}>
                İptal
              </button>
            </div>
          )}

          {!progress && (
            <button
              className="admin-primary-button"
              type="button"
              disabled={importing || preview.validCount === 0}
              onClick={() => void runImport()}
            >
              {importing
                ? "Aktarılıyor…"
                : `İçe Aktar (${preview.validCount} ürün, taslak olarak)`}
            </button>
          )}
        </section>
      )}

      {result && (
        <section className="admin-supplier-step admin-supplier-result">
          <h3>Sonuç</h3>
          <p>
            <strong>{result.imported}</strong> ürün taslak olarak eklendi.
            {result.cancelled && " (İşlem elle iptal edildi.)"}
            {result.errorCount > 0 &&
              ` ${result.errorCount} satır veri hatası nedeniyle atlandı.`}
          </p>
          {result.errors.length > 0 && (
            <div className="admin-supplier-errors">
              <strong>Atlanan satırlar (ilk {result.errors.length})</strong>
              <ul>
                {result.errors.map((rowError) => (
                  <li key={rowError.index}>
                    Satır {rowError.index + 1}: {rowError.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
