"use client";

import { useEffect, useState } from "react";

type Supplier = {
  id: number;
  name: string;
  feedUrl: string;
  fieldMapping: string;
  filters: string;
  defaultMarkupPercent: number;
  active: number;
  lastSyncedAt: string | null;
};

type SyncLog = {
  id: number;
  supplierName: string | null;
  status: string;
  startedAt: string;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorMessage: string | null;
};

type Draft = {
  name: string;
  feedUrl: string;
  fieldMapping: string;
  defaultMarkupPercent: number;
  active: boolean;
  filterCategories: string;
  filterBrands: string;
  filterMinPrice: string;
  filterExcludeZeroStock: boolean;
};

const emptySupplier: Draft = {
  name: "",
  feedUrl: "",
  fieldMapping: "{}",
  defaultMarkupPercent: 20,
  active: true,
  filterCategories: "",
  filterBrands: "",
  filterMinPrice: "",
  filterExcludeZeroStock: false,
};

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function supplierToDraft(supplier: Supplier): Draft {
  let filters: { categories?: string[]; brands?: string[]; minPrice?: number; excludeZeroStock?: boolean } = {};
  try {
    filters = JSON.parse(supplier.filters || "{}");
  } catch {
    filters = {};
  }
  return {
    name: supplier.name,
    feedUrl: supplier.feedUrl,
    fieldMapping: supplier.fieldMapping,
    defaultMarkupPercent: supplier.defaultMarkupPercent,
    active: Boolean(supplier.active),
    filterCategories: (filters.categories ?? []).join(", "),
    filterBrands: (filters.brands ?? []).join(", "),
    filterMinPrice: filters.minPrice ? String(filters.minPrice) : "",
    filterExcludeZeroStock: Boolean(filters.excludeZeroStock),
  };
}

export default function XmlSuppliersPanel({
  tab = "suppliers",
  onNotice,
}: {
  tab: "suppliers" | "pricing" | "logs";
  onNotice: (message: string) => void;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [draft, setDraft] = useState<Draft>(emptySupplier);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const read = async (url: string, options?: RequestInit) => {
    const response = await fetch(url, { ...options, cache: "no-store" });
    const body = await response.json() as { error?: string; suppliers?: Supplier[]; logs?: SyncLog[]; results?: { result?: { imported: number; updated: number } }[] };
    if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
    return body;
  };

  const load = async () => {
    try {
      const [supplierBody, logBody] = await Promise.all([
        read("/api/admin/xml-suppliers"),
        read("/api/admin/xml-suppliers/logs"),
      ]);
      setSuppliers(supplierBody.suppliers ?? []);
      setLogs(logBody.logs ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "XML verileri alınamadı.");
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      JSON.parse(draft.fieldMapping);
      const filters: Record<string, unknown> = {};
      const categories = splitCsv(draft.filterCategories);
      const brands = splitCsv(draft.filterBrands);
      if (categories.length) filters.categories = categories;
      if (brands.length) filters.brands = brands;
      const minPrice = Number(draft.filterMinPrice);
      if (draft.filterMinPrice.trim() && Number.isFinite(minPrice) && minPrice > 0) {
        filters.minPrice = minPrice;
      }
      if (draft.filterExcludeZeroStock) filters.excludeZeroStock = true;

      await read(editingId ? `/api/admin/xml-suppliers/${editingId}` : "/api/admin/xml-suppliers", {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          feedUrl: draft.feedUrl,
          defaultMarkupPercent: draft.defaultMarkupPercent,
          active: draft.active,
          fieldMapping: JSON.parse(draft.fieldMapping),
          filters,
        }),
      });
      setDraft(emptySupplier); setEditingId(null); await load(); onNotice("XML tedarikçisi kaydedildi.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Tedarikçi kaydedilemedi.");
    } finally { setBusy(false); }
  };

  const sync = async (supplierId?: number) => {
    setBusy(true); setError("");
    try {
      const body = await read("/api/admin/xml-suppliers/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(supplierId ? { supplierId } : {}) });
      const totals = (body.results ?? []).reduce((sum, item) => sum + (item.result?.imported ?? 0) + (item.result?.updated ?? 0), 0);
      await load(); onNotice(`${totals} XML ürünü işlendi.`);
    } catch (syncError) { setError(syncError instanceof Error ? syncError.message : "XML senkronu başarısız."); }
    finally { setBusy(false); }
  };

  const editSupplier = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setDraft(supplierToDraft(supplier));
  };

  return <div className="admin-panel">
    <div className="admin-panel-heading"><div><p className="admin-kicker">Dropshipping</p><h2>{tab === "suppliers" ? "XML tedarikçileri" : tab === "pricing" ? "Fiyatlandırma kuralları" : "Senkron geçmişi"}</h2><p>XML kaynaklarını ve ürün senkronlarını mevcut mağaza yönetimiyle birlikte yönetin.</p></div>{tab !== "logs" && <button className="admin-primary-button" type="button" disabled={busy} onClick={() => void sync()}>Tümünü senkronla</button>}</div>
    {error && <div className="admin-inline-error" role="alert">{error}</div>}
    {tab === "suppliers" && <>
      <form className="admin-form" onSubmit={save}><div className="admin-field-grid">
        <label className="admin-field"><span>Tedarikçi adı</span><input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} required /></label>
        <label className="admin-field"><span>XML URL</span><input type="url" value={draft.feedUrl} onChange={event => setDraft({ ...draft, feedUrl: event.target.value })} required /></label>
        <label className="admin-field"><span>Varsayılan kâr marjı (%)</span><input type="number" min="0" max="500" value={draft.defaultMarkupPercent} onChange={event => setDraft({ ...draft, defaultMarkupPercent: Number(event.target.value) })} /></label>
        <label className="admin-field full"><span>Alan eşleme (JSON)</span><textarea rows={3} value={draft.fieldMapping} onChange={event => setDraft({ ...draft, fieldMapping: event.target.value })} placeholder='{"externalId":"id","name":"name","price":"price","stock":"stock","image":"image","category":"category","brand":"brand"}' /></label>
        <label className="admin-field"><span>Kategori filtresi (virgülle ayrılmış, boş = hepsi)</span><input value={draft.filterCategories} onChange={event => setDraft({ ...draft, filterCategories: event.target.value })} placeholder="Erkek Yüzük, Bileklik" /></label>
        <label className="admin-field"><span>Marka filtresi (virgülle ayrılmış, boş = hepsi)</span><input value={draft.filterBrands} onChange={event => setDraft({ ...draft, filterBrands: event.target.value })} /></label>
        <label className="admin-field"><span>Minimum fiyat (TL)</span><input type="number" min="0" value={draft.filterMinPrice} onChange={event => setDraft({ ...draft, filterMinPrice: event.target.value })} placeholder="ör. 100" /></label>
        <div className="admin-supplier-source-toggle"><label><input type="checkbox" checked={draft.filterExcludeZeroStock} onChange={event => setDraft({ ...draft, filterExcludeZeroStock: event.target.checked })} /> Stoku 0 olan ürünleri alma</label></div>
      </div><button className="admin-secondary-button" type="submit" disabled={busy}>{editingId ? "Tedarikçiyi güncelle" : "Tedarikçi ekle"}</button></form>
      <div className="admin-supplier-table-wrap"><table className="admin-supplier-table"><thead><tr><th>Tedarikçi</th><th>URL</th><th>Marj</th><th>Durum</th><th /></tr></thead><tbody>{suppliers.map(supplier => <tr key={supplier.id}><td>{supplier.name}</td><td className="admin-supplier-image-cell">{supplier.feedUrl}</td><td>%{supplier.defaultMarkupPercent}</td><td>{supplier.active ? "Aktif" : "Pasif"}</td><td><button type="button" onClick={() => editSupplier(supplier)}>Düzenle</button> <button type="button" onClick={() => void sync(supplier.id)} disabled={busy}>Senkronla</button></td></tr>)}</tbody></table></div>
    </>}
    {tab === "pricing" && <div className="admin-supplier-step"><h3>Aktif fiyatlandırma kuralları</h3><p>Her tedarikçinin varsayılan marjı XML maliyetine uygulanır. Değişiklik için tedarikçiyi düzenleyin.</p>{suppliers.map(supplier => <div className="admin-bulk-toolbar" key={supplier.id}><strong>{supplier.name}</strong><span>XML maliyeti + %{supplier.defaultMarkupPercent} = mağaza fiyatı</span><button type="button" onClick={() => editSupplier(supplier)}>Kuralı düzenle</button></div>)}</div>}
    {tab === "logs" && <div className="admin-supplier-table-wrap"><table className="admin-supplier-table"><thead><tr><th>Tedarikçi</th><th>Tarih</th><th>Durum</th><th>Yeni</th><th>Güncellenen</th><th>Atlanan</th></tr></thead><tbody>{logs.map(log => <tr key={log.id}><td>{log.supplierName ?? "Silinmiş tedarikçi"}</td><td>{new Date(log.startedAt).toLocaleString("tr-TR")}</td><td>{log.status === "success" ? "Başarılı" : log.status === "failed" ? "Hatalı" : "Çalışıyor"}</td><td>{log.importedCount}</td><td>{log.updatedCount}</td><td>{log.skippedCount}</td></tr>)}</tbody></table>{!logs.length && <p className="admin-empty">Henüz senkron geçmişi yok.</p>}</div>}
  </div>;
}
