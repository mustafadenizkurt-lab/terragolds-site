"use client";

import { useState } from "react";
import type { SiteContent, SiteContentKey } from "../../lib/site-content-types";

const tiles: {
  imageKey: Extract<
    SiteContentKey,
    "homeTileRawStonesImage" | "homeTileMeditationImage" | "homeTileCollectionSetsImage"
  >;
  titleKey: Extract<
    SiteContentKey,
    "homeTileRawStonesTitle" | "homeTileMeditationTitle" | "homeTileCollectionSetsTitle"
  >;
  taglineKey: Extract<
    SiteContentKey,
    "homeTileRawStonesTagline" | "homeTileMeditationTagline" | "homeTileCollectionSetsTagline"
  >;
  linkKey: Extract<
    SiteContentKey,
    "homeTileRawStonesLink" | "homeTileMeditationLink" | "homeTileCollectionSetsLink"
  >;
  label: string;
  fallbackImage: string;
  fallbackLink: string;
}[] = [
  {
    imageKey: "homeTileRawStonesImage",
    titleKey: "homeTileRawStonesTitle",
    taglineKey: "homeTileRawStonesTagline",
    linkKey: "homeTileRawStonesLink",
    label: "Ham Taşlar",
    fallbackImage: "/stone-amethyst.jpg",
    fallbackLink: "/#shop",
  },
  {
    imageKey: "homeTileMeditationImage",
    titleKey: "homeTileMeditationTitle",
    taglineKey: "homeTileMeditationTagline",
    linkKey: "homeTileMeditationLink",
    label: "Meditasyon Serisi",
    fallbackImage: "/story-hands.jpg",
    fallbackLink: "/#shop",
  },
  {
    imageKey: "homeTileCollectionSetsImage",
    titleKey: "homeTileCollectionSetsTitle",
    taglineKey: "homeTileCollectionSetsTagline",
    linkKey: "homeTileCollectionSetsLink",
    label: "Koleksiyon Setleri",
    fallbackImage: "/stone-collection.jpg",
    fallbackLink: "/#shop",
  },
];

async function readJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(body.error ?? "Görsel yüklenemedi."));
  }
  return body;
}

export default function HomeTileImagesPanel({
  draft,
  onFieldChange,
}: {
  draft: SiteContent;
  onFieldChange: (key: SiteContentKey, value: string) => void;
}) {
  const [uploadingKey, setUploadingKey] = useState<SiteContentKey | "">("");
  const [error, setError] = useState("");

  const upload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    key: SiteContentKey,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingKey(key);
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const body = await readJson(response);
      onFieldChange(key, String(body.url));
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Görsel yüklenemedi.",
      );
    } finally {
      setUploadingKey("");
      event.target.value = "";
    }
  };

  return (
    <div className="admin-tile-images">
      <div className="admin-form-section-title compact">
        <div>
          <h2>Koleksiyon Vitrinleri görselleri</h2>
          <p>
            Ana sayfada "Ham Taşlar / Meditasyon Serisi / Koleksiyon Setleri"
            kartlarında görünen fotoğraf, başlık, açıklama metni ve tıklanınca
            gidilecek bağlantı. JPG, JPEG, PNG veya WebP · en fazla 5 MB.
          </p>
        </div>
      </div>

      {error && (
        <div className="admin-inline-error" role="alert">
          {error}
        </div>
      )}

      <div className="admin-tile-image-grid">
        {tiles.map((tile) => (
          <div className="admin-tile-image-card" key={tile.imageKey}>
            <strong>{tile.label}</strong>
            <div className="admin-image-preview">
              <img src={draft[tile.imageKey] || tile.fallbackImage} alt={tile.label} />
            </div>
            <label className="admin-upload-button">
              {uploadingKey === tile.imageKey ? "Yükleniyor…" : "Yeni görsel yükle"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => upload(event, tile.imageKey)}
                disabled={uploadingKey !== ""}
              />
            </label>
            <label className="admin-field">
              <span>Görsel bağlantısı</span>
              <input
                value={draft[tile.imageKey]}
                onChange={(event) => onFieldChange(tile.imageKey, event.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>Başlık</span>
              <input
                value={draft[tile.titleKey]}
                onChange={(event) => onFieldChange(tile.titleKey, event.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>Açıklama</span>
              <input
                value={draft[tile.taglineKey]}
                onChange={(event) => onFieldChange(tile.taglineKey, event.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>Bağlantı (tıklanınca gidilecek sayfa)</span>
              <input
                value={draft[tile.linkKey] || tile.fallbackLink}
                onChange={(event) => onFieldChange(tile.linkKey, event.target.value)}
                placeholder="/kategori/kadin-kolye veya /#shop"
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
