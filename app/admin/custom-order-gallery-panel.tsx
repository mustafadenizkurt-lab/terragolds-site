"use client";

import { useEffect, useState } from "react";

type GalleryItem = {
  id: number;
  imageUrl: string;
  title: string;
  description: string;
  createdAt: string;
};

async function readJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(body.error ?? "İşlem tamamlanamadı."));
  }
  return body;
}

async function uploadImage(file: File) {
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch("/api/admin/upload", {
    method: "POST",
    body: formData,
  });
  const body = await readJson(response);
  return String(body.url);
}

export default function CustomOrderGalleryPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<number | "">("");

  const [newImageUrl, setNewImageUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [adding, setAdding] = useState(false);

  const [drafts, setDrafts] = useState<
    Record<number, { title: string; description: string }>
  >({});

  const loadItems = async () => {
    setLoading(true);
    setError("");
    try {
      const body = await readJson(
        await fetch("/api/admin/custom-order-gallery", { cache: "no-store" }),
      );
      const loaded = (body.items as GalleryItem[] | undefined) ?? [];
      setItems(loaded);
      setDrafts(
        Object.fromEntries(
          loaded.map((item) => [
            item.id,
            { title: item.title, description: item.description },
          ]),
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Galeri öğeleri alınamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadItems();
  }, []);

  const handleNewImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      setNewImageUrl(await uploadImage(file));
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Görsel yüklenemedi.",
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const addItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newImageUrl) {
      setError("Eklemeden önce bir görsel yükleyin.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const body = await readJson(
        await fetch("/api/admin/custom-order-gallery", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            imageUrl: newImageUrl,
            title: newTitle,
            description: newDescription,
          }),
        }),
      );
      const loaded = (body.items as GalleryItem[] | undefined) ?? [];
      setItems(loaded);
      setDrafts(
        Object.fromEntries(
          loaded.map((item) => [
            item.id,
            { title: item.title, description: item.description },
          ]),
        ),
      );
      setNewImageUrl("");
      setNewTitle("");
      setNewDescription("");
      onNotice("Galeriye yeni çalışma eklendi.");
    } catch (addError) {
      setError(
        addError instanceof Error ? addError.message : "Galeri öğesi eklenemedi.",
      );
    } finally {
      setAdding(false);
    }
  };

  const saveItem = async (id: number) => {
    const draft = drafts[id];
    if (!draft) return;
    setBusyId(id);
    setError("");
    try {
      const body = await readJson(
        await fetch(`/api/admin/custom-order-gallery/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        }),
      );
      setItems((body.items as GalleryItem[] | undefined) ?? []);
      onNotice("Galeri öğesi güncellendi.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Galeri öğesi güncellenemedi.",
      );
    } finally {
      setBusyId("");
    }
  };

  const deleteItem = async (item: GalleryItem) => {
    if (
      !window.confirm(
        `${item.title || "Bu görsel"} galeriden kaldırılsın mı?`,
      )
    ) {
      return;
    }
    setBusyId(item.id);
    setError("");
    try {
      const body = await readJson(
        await fetch(`/api/admin/custom-order-gallery/${item.id}`, {
          method: "DELETE",
        }),
      );
      setItems((body.items as GalleryItem[] | undefined) ?? []);
      onNotice("Galeri öğesi kaldırıldı.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Galeri öğesi silinemedi.",
      );
    } finally {
      setBusyId("");
    }
  };

  const isDirty = (item: GalleryItem) => {
    const draft = drafts[item.id];
    if (!draft) return false;
    return draft.title !== item.title || draft.description !== item.description;
  };

  return (
    <div className="admin-tile-images admin-gallery-manager">
      <div className="admin-form-section-title compact">
        <div>
          <h2>Örnek Çalışmalar galerisi</h2>
          <p>
            Özel Üretim sayfasında gösterilecek geçmiş özel üretim
            fotoğrafları. İstediğiniz kadar görsel ekleyip
            çıkarabilirsiniz. JPG, JPEG, PNG veya WebP · en fazla 5 MB.
          </p>
        </div>
      </div>

      {error && (
        <div className="admin-inline-error" role="alert">
          {error}
        </div>
      )}

      <form className="admin-tile-image-card admin-gallery-add-card" onSubmit={addItem}>
        <strong>Yeni çalışma ekle</strong>
        <div className="admin-image-preview">
          {newImageUrl ? (
            <img src={newImageUrl} alt="" />
          ) : (
            <span className="admin-image-preview-empty">Görsel seçilmedi</span>
          )}
        </div>
        <label className="admin-upload-button">
          {uploading ? "Yükleniyor…" : "Görsel yükle"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleNewImageUpload}
            disabled={uploading}
          />
        </label>
        <label className="admin-field">
          <span>Başlık (isteğe bağlı)</span>
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Örn. Kişiye özel isim kolye"
          />
        </label>
        <label className="admin-field">
          <span>Açıklama (isteğe bağlı)</span>
          <input
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
            placeholder="Örn. 14 ayar altın, taş: safir"
          />
        </label>
        <button
          className="admin-primary-button"
          type="submit"
          disabled={adding || uploading || !newImageUrl}
        >
          {adding ? "Ekleniyor…" : "Galeriye ekle"}
        </button>
      </form>

      {loading ? (
        <div className="admin-loading">
          <span />
          <p>Galeri hazırlanıyor…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="admin-empty">
          <span>🖼</span>
          <h2>Henüz galeri öğesi yok</h2>
          <p>Yukarıdan ilk örnek çalışma fotoğrafınızı ekleyin.</p>
        </div>
      ) : (
        <div className="admin-tile-image-grid">
          {items.map((item) => {
            const draft = drafts[item.id] ?? {
              title: item.title,
              description: item.description,
            };
            return (
              <div className="admin-tile-image-card" key={item.id}>
                <div className="admin-image-preview">
                  <img src={item.imageUrl} alt={item.title || ""} />
                </div>
                <label className="admin-field">
                  <span>Başlık</span>
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.id]: { ...draft, title: event.target.value },
                      }))
                    }
                  />
                </label>
                <label className="admin-field">
                  <span>Açıklama</span>
                  <input
                    value={draft.description}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.id]: {
                          ...draft,
                          description: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <div className="admin-discount-actions">
                  <button
                    type="button"
                    onClick={() => void saveItem(item.id)}
                    disabled={busyId === item.id || !isDirty(item)}
                  >
                    {busyId === item.id ? "Kaydediliyor…" : "Kaydet"}
                  </button>
                  <button
                    className="danger"
                    type="button"
                    onClick={() => void deleteItem(item)}
                    disabled={busyId === item.id}
                  >
                    Sil
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
