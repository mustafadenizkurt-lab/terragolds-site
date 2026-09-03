"use client";

import { useEffect, useState } from "react";

type Supplier = { id: number; name: string; feedUrl: string };

type BackfillReport = {
  feedRecordCount: number;
  detectedFields: string[];
  codeField: string;
  imageField: string;
  candidateCount: number;
  matchedCount: number;
  unmatchedCount: number;
  ambiguousImageCount: number;
  sampleMatched: { id: number; name: string; image: string; externalId: string }[];
  sampleUnmatched: { id: number; name: string; image: string }[];
};

async function readJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(body.error ?? "İşlem tamamlanamadı."));
  }
  return body;
}

export default function XmlCodeBackfillPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [codeField, setCodeField] = useState("");
  const [imageField, setImageField] = useState("");
  const [report, setReport] = useState<BackfillReport | null>(null);
  const [running, setRunning] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const [committed, setCommitted] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/xml-suppliers", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ suppliers?: Supplier[] }>)
      .then((body) => {
        const loaded = body.suppliers ?? [];
        setSuppliers(loaded);
        if (loaded.length) setSupplierId(loaded[0].id);
      })
      .catch(() => {});
  }, []);

  const runPreview = async () => {
    if (!supplierId) {
      setError("Önce bir tedarikçi seçin.");
      return;
    }
    setRunning(true);
    setError("");
    setCommitted(null);
    try {
      const body = await readJson(
        await fetch("/api/admin/xml-code-backfill", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            supplierId,
            codeField: codeField || undefined,
            imageField: imageField || undefined,
            commit: false,
          }),
        }),
      );
      const nextReport = body.report as BackfillReport;
      setReport(nextReport);
      setCodeField(nextReport.codeField);
      setImageField(nextReport.imageField);
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Dry-run raporu alınamadı.",
      );
    } finally {
      setRunning(false);
    }
  };

  const runCommit = async () => {
    if (!supplierId || !report) return;
    if (
      !window.confirm(
        `${report.matchedCount} ürünün xml_external_id alanı güncellenecek. Devam edilsin mi?`,
      )
    ) {
      return;
    }
    setCommitting(true);
    setError("");
    try {
      const body = await readJson(
        await fetch("/api/admin/xml-code-backfill", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            supplierId,
            codeField: codeField || undefined,
            imageField: imageField || undefined,
            commit: true,
          }),
        }),
      );
      setReport(body.report as BackfillReport);
      setCommitted(Number(body.updated ?? 0));
      onNotice(`${body.updated ?? 0} ürünün ürün kodu dolduruldu.`);
    } catch (commitError) {
      setError(
        commitError instanceof Error
          ? commitError.message
          : "Güncelleme uygulanamadı.",
      );
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-kicker">Dropshipping</p>
          <h2>Ürün Kodu Geriye Dönük Eşleştirme</h2>
          <p>
            Mevcut ürünlerin xml_external_id alanını, tedarikçi XML
            feed&apos;indeki görsel URL&apos;si üzerinden eşleştirerek
            doldurur. Önce dry-run raporu alın; hiçbir şey yazılmaz. Rapor
            doğru görünüyorsa &quot;Uygula&quot; ile gerçek güncellemeyi
            yapın.
          </p>
        </div>
      </div>

      {error && (
        <div className="admin-inline-error" role="alert">
          {error}
        </div>
      )}

      <div className="admin-form">
        <div className="admin-field-grid">
          <label className="admin-field">
            <span>Tedarikçi</span>
            <select
              value={supplierId}
              onChange={(event) => {
                setSupplierId(Number(event.target.value));
                setReport(null);
                setCommitted(null);
              }}
            >
              <option value="" disabled>
                Seçin
              </option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Ürün kodu alanı (boş = otomatik tespit)</span>
            <input
              value={codeField}
              onChange={(event) => setCodeField(event.target.value)}
              placeholder="örn. StokKodu"
            />
          </label>
          <label className="admin-field">
            <span>Görsel alanı (boş = otomatik tespit)</span>
            <input
              value={imageField}
              onChange={(event) => setImageField(event.target.value)}
              placeholder="örn. Resim"
            />
          </label>
        </div>
        <button
          className="admin-secondary-button"
          type="button"
          disabled={running || !supplierId}
          onClick={() => void runPreview()}
        >
          {running ? "Rapor hazırlanıyor…" : "Dry-Run Raporu Al"}
        </button>
      </div>

      {report && (
        <div className="admin-backfill-report">
          <div className="admin-backfill-stats">
            <div>
              <strong>{report.feedRecordCount}</strong>
              <span>Feed&apos;deki ürün</span>
            </div>
            <div>
              <strong>{report.candidateCount}</strong>
              <span>Kodu boş DB ürünü</span>
            </div>
            <div>
              <strong>{report.matchedCount}</strong>
              <span>Eşleşen</span>
            </div>
            <div>
              <strong>{report.unmatchedCount}</strong>
              <span>Eşleşmeyen</span>
            </div>
            <div>
              <strong>{report.ambiguousImageCount}</strong>
              <span>Belirsiz görsel (feed&apos;de aynı görsel, farklı kod)</span>
            </div>
          </div>

          <p className="admin-backfill-fields">
            Kullanılan alanlar — Kod: <code>{report.codeField}</code> ·
            Görsel: <code>{report.imageField}</code>
          </p>

          {report.detectedFields.length > 0 && (
            <details className="admin-backfill-fields-detail">
              <summary>Feed&apos;de tespit edilen tüm alanlar ({report.detectedFields.length})</summary>
              <p>{report.detectedFields.join(", ")}</p>
            </details>
          )}

          {report.sampleMatched.length > 0 && (
            <div className="admin-backfill-sample">
              <h3>Örnek eşleşmeler</h3>
              <table className="admin-supplier-table">
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th>Kod</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sampleMatched.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.externalId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.sampleUnmatched.length > 0 && (
            <div className="admin-backfill-sample">
              <h3>Örnek eşleşmeyenler</h3>
              <table className="admin-supplier-table">
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th>Görsel</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sampleUnmatched.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td className="admin-supplier-image-cell">{item.image}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {committed === null ? (
            <button
              className="admin-primary-button"
              type="button"
              disabled={committing || report.matchedCount === 0}
              onClick={() => void runCommit()}
            >
              {committing
                ? "Uygulanıyor…"
                : `${report.matchedCount} ürünü güncelle`}
            </button>
          ) : (
            <p className="admin-backfill-done">
              ✓ {committed} ürünün ürün kodu dolduruldu.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
