"use client";

import { useState } from "react";
import type { ProductCategory } from "../../lib/category-types";

type CategoryDraft = {
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
};

const emptyDraft: CategoryDraft = {
  name: "",
  description: "",
  active: true,
  sortOrder: 0,
};

async function readResponse(response: Response) {
  const body = (await response.json()) as {
    categories?: ProductCategory[];
    error?: string;
  };
  if (!response.ok) throw new Error(body.error || "İşlem tamamlanamadı.");
  return body;
}

export default function CategoriesPanel({
  categories,
  onChanged,
  onNotice,
  onAddProduct,
}: {
  categories: ProductCategory[];
  onChanged: (categories: ProductCategory[]) => void;
  onNotice: (message: string) => void;
  onAddProduct: (categoryName: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const beginCreate = () => {
    setEditingId(null);
    setDraft({
      ...emptyDraft,
      sortOrder: categories.length + 1,
    });
    setCreating(true);
    setError("");
  };

  const beginEdit = (category: ProductCategory) => {
    setCreating(false);
    setEditingId(category.id);
    setDraft({
      name: category.name,
      description: category.description,
      active: category.active,
      sortOrder: category.sortOrder,
    });
    setError("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        editingId
          ? `/api/admin/categories/${editingId}`
          : "/api/admin/categories",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const body = await readResponse(response);
      onChanged(body.categories ?? []);
      setCreating(false);
      setEditingId(null);
      setDraft(emptyDraft);
      onNotice(editingId ? "Kategori güncellendi." : "Yeni kategori eklendi.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Kategori kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (category: ProductCategory) => {
    if (!window.confirm(`${category.name} kategorisi silinsin mi?`)) return;
    setSaving(true);
    setError("");
    try {
      const body = await readResponse(
        await fetch(`/api/admin/categories/${category.id}`, {
          method: "DELETE",
        }),
      );
      onChanged(body.categories ?? []);
      onNotice("Kategori silindi.");
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Kategori silinemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const editorVisible = creating || editingId !== null;

  return (
    <div className="admin-categories">
      <section className="admin-categories-hero">
        <div>
          <p className="admin-kicker">Ürün yapısı</p>
          <h2>Kategoriler</h2>
          <p>
            Mağaza filtrelerini düzenleyin. Kategori adı değiştirildiğinde bağlı
            ürünler otomatik olarak yeni kategoriye taşınır.
          </p>
        </div>
        <button
          className="admin-primary-button"
          type="button"
          onClick={beginCreate}
        >
          ＋ Yeni kategori
        </button>
      </section>

      {error && (
        <div className="admin-inline-error" role="alert">
          {error}
        </div>
      )}

      {editorVisible && (
        <section className="admin-category-editor">
          <header>
            <div>
              <p>{editingId ? "Kategori düzenle" : "Yeni kategori"}</p>
              <h3>{editingId ? draft.name : "Kategori bilgileri"}</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditingId(null);
              }}
            >
              ×
            </button>
          </header>
          <div className="admin-field-grid">
            <label className="admin-field">
              <span>Kategori adı</span>
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                maxLength={80}
                required
              />
            </label>
            <label className="admin-field">
              <span>Sıralama</span>
              <input
                type="number"
                min="0"
                value={draft.sortOrder}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    sortOrder: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="admin-field full">
              <span>Açıklama</span>
              <textarea
                rows={3}
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                maxLength={500}
                placeholder="Yönetim ekranında kategori hakkında kısa not."
              />
            </label>
          </div>
          <label className="admin-category-toggle">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  active: event.target.checked,
                }))
              }
            />
            <span>
              <strong>Mağaza filtresinde göster</strong>
              <small>Kapalı kategoriler yeni müşterilere gösterilmez.</small>
            </span>
          </label>
          <footer>
            <button
              className="admin-secondary-button"
              type="button"
              onClick={() => {
                setCreating(false);
                setEditingId(null);
              }}
            >
              Vazgeç
            </button>
            <button
              className="admin-primary-button"
              type="button"
              disabled={saving || !draft.name.trim()}
              onClick={() => void save()}
            >
              {saving ? "Kaydediliyor…" : "Kategoriyi kaydet"}
            </button>
          </footer>
        </section>
      )}

      <section className="admin-category-list">
        <header>
          <span>Kategori</span>
          <span>Ürün sayısı</span>
          <span>Görünürlük</span>
          <span>Sıralama</span>
          <span />
        </header>
        {categories.map((category) => (
          <article key={category.id}>
            <div>
              <strong>{category.name}</strong>
              <small>{category.description || "Açıklama eklenmemiş"}</small>
            </div>
            <b>{category.productCount} ürün</b>
            <span className={category.active ? "active" : "inactive"}>
              {category.active ? "Gösteriliyor" : "Gizli"}
            </span>
            <em>{category.sortOrder}</em>
            <div>
              <button
                type="button"
                onClick={() => onAddProduct(category.name)}
              >
                ＋ Ürün ekle
              </button>
              <button type="button" onClick={() => beginEdit(category)}>
                Düzenle
              </button>
              <button
                className="danger"
                type="button"
                disabled={saving}
                onClick={() => void remove(category)}
              >
                Sil
              </button>
            </div>
          </article>
        ))}
        {!categories.length && (
          <div className="admin-category-empty">
            Henüz kategori bulunmuyor.
          </div>
        )}
      </section>
    </div>
  );
}
