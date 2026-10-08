"use client";

import { useEffect, useState } from "react";

type Photo = { id: number; imageUrl: string; caption: string; sortOrder: number };

async function readJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(body.error ?? "İşlem tamamlanamadı."));
  }
  return body;
}

export default function CustomProductionPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadPhotos = async () => {
    setLoading(true);
    setError("");
    try {
      const body = await readJson(
        await fetch("/api/admin/custom-production-photos", { cache: "no-store" }),
      );
      setPhotos((body.photos as Photo[] | undefined) ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Fotoğraflar alınamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPhotos();
  }, []);

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const uploadBody = await readJson(
        await fetch("/api/admin/upload", { method: "POST", body: formData }),
      );
      const body = await readJson(
        await fetch("/api/admin/custom-production-photos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ imageUrl: uploadBody.url, caption }),
        }),
      );
      setPhotos((body.photos as Photo[] | undefined) ?? []);
      setCaption("");
      onNotice("Fotoğraf eklendi.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Fotoğraf eklenemedi.",
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const deletePhoto = async (photo: Photo) => {
    if (!window.confirm("Bu fotoğraf kaldırılsın mı?")) return;
    setDeletingId(photo.id);
    setError("");
    try {
      await readJson(
        await fetch(`/api/admin/custom-production-photos?id=${photo.id}`, {
          method: "DELETE",
        }),
      );
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      onNotice("Fotoğraf kaldırıldı.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Fotoğraf silinemedi.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-discounts">
      <section className="admin-discount-hero">
        <div>
          <p className="admin-kicker">Özel üretim</p>
          <h2>Geçmiş özel üretim örneklerini yönetin.</h2>
          <p>
            Buraya eklenen fotoğraflar /ozel-uretim sayfasındaki galeride,
            eklenme sırasıyla görünür.
          </p>
        </div>
      </section>

      {error && (
        <div className="admin-alert error" role="alert">
          <span>!</span>
          <p>{error}</p>
          <button type="button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}

      <div className="admin-field-grid" style={{ marginBottom: 16 }}>
        <label className="admin-field">
          <span>Açıklama (opsiyonel)</span>
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Örn. Özel tasarım nişan yüzüğü"
          />
        </label>
        <label className="admin-upload-button">
          {uploading ? "Yükleniyor…" : "Fotoğraf ekle"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={upload}
            disabled={uploading}
          />
        </label>
      </div>

      {loading ? (
        <div className="admin-loading">
          <span />
          <p>Fotoğraflar hazırlanıyor…</p>
        </div>
      ) : photos.length ? (
        <div className="admin-tile-image-grid">
          {photos.map((photo) => (
            <div className="admin-tile-image-card" key={photo.id}>
              <div className="admin-image-preview">
                <img src={photo.imageUrl} alt={photo.caption || "Özel üretim örneği"} />
              </div>
              <p>{photo.caption || "(açıklama yok)"}</p>
              <button
                className="admin-secondary-button"
                type="button"
                onClick={() => void deletePhoto(photo)}
                disabled={deletingId === photo.id}
              >
                {deletingId === photo.id ? "Kaldırılıyor…" : "Kaldır"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="admin-empty">
          <span>⌁</span>
          <h2>Henüz fotoğraf yok</h2>
          <p>İlk özel üretim fotoğrafınızı ekleyin.</p>
        </div>
      )}
    </div>
  );
}
