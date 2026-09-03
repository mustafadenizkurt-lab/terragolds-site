"use client";

import { useEffect, useMemo, useState } from "react";
import {
  contentGroups,
  defaultSiteContent,
  type ContentGroupId,
  type SiteContent,
  type SiteContentKey,
} from "../../lib/site-content-types";
import LegalDocumentsPanel from "./legal-documents-panel";
import HomeTileImagesPanel from "./home-tile-images-panel";
import CustomOrderGalleryPanel from "./custom-order-gallery-panel";

type AdminContentState = {
  draft: SiteContent;
  published: SiteContent;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  updatedAt: string | null;
};

async function readResponse(response: Response) {
  const body = (await response.json()) as {
    content?: AdminContentState;
    error?: string;
  };
  if (!response.ok) throw new Error(body.error || "İçerik alınamadı.");
  return body;
}

export default function ContentManagementPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [activeGroup, setActiveGroup] = useState<ContentGroupId>("home");
  const [content, setContent] = useState<AdminContentState>({
    draft: defaultSiteContent,
    published: defaultSiteContent,
    hasUnpublishedChanges: false,
    publishedAt: null,
    updatedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"draft" | "publish" | "">("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/content", { cache: "no-store" })
      .then(readResponse)
      .then((body) => {
        if (body.content) setContent(body.content);
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "İçerik alınamadı.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const group = useMemo(
    () =>
      contentGroups.find((item) => item.id === activeGroup) ??
      contentGroups[0],
    [activeGroup],
  );

  const hasLocalChanges = Object.keys(content.draft).some(
    (key) =>
      content.draft[key as SiteContentKey] !==
      content.published[key as SiteContentKey],
  );

  const updateField = (key: SiteContentKey, value: string) => {
    setContent((current) => ({
      ...current,
      draft: { ...current.draft, [key]: value },
      hasUnpublishedChanges: true,
    }));
  };

  const save = async (action: "draft" | "publish") => {
    setSaving(action);
    setError("");
    try {
      const body = await readResponse(
        await fetch("/api/admin/content", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, values: content.draft }),
        }),
      );
      if (body.content) setContent(body.content);
      onNotice(
        action === "publish"
          ? "Sayfa içerikleri yayınlandı."
          : "İçerik taslak olarak kaydedildi.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "İçerik kaydedilemedi.",
      );
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="admin-content-manager">
      <section className="admin-content-hero">
        <div>
          <p className="admin-kicker">İçerik yönetimi</p>
          <h2>Mağaza metinlerini tek yerden yönetin.</h2>
          <p>
            Sayfa düzeni korunur; yalnızca müşterinin gördüğü başlıklar,
            açıklamalar, menüler ve Google metinleri değişir.
          </p>
        </div>
        <div className="admin-content-state">
          <span className={hasLocalChanges ? "draft" : "published"} />
          <div>
            <strong>
              {hasLocalChanges ? "Yayınlanmamış değişiklik var" : "İçerik güncel"}
            </strong>
            <small>
              {content.publishedAt
                ? `Son yayın: ${new Date(content.publishedAt).toLocaleString(
                    "tr-TR",
                    { dateStyle: "medium", timeStyle: "short" },
                  )}`
                : "Varsayılan içerik yayında"}
            </small>
          </div>
        </div>
      </section>

      <div className="admin-content-layout">
        <nav aria-label="Düzenlenecek sayfalar">
          {contentGroups.map((item, index) => (
            <button
              type="button"
              className={activeGroup === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setActiveGroup(item.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </div>
            </button>
          ))}
        </nav>

        <section className="admin-content-editor">
          <header>
            <div>
              <p>Sayfa</p>
              <h2>{group.label}</h2>
              <span>{group.description}</span>
            </div>
            {group.id !== "legal" && (
              <a href={group.previewUrl} target="_blank" rel="noreferrer">
                Sayfayı görüntüle ↗
              </a>
            )}
          </header>

          {error && (
            <div className="admin-inline-error" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="admin-content-loading">İçerik hazırlanıyor…</div>
          ) : group.id === "legal" ? (
            <LegalDocumentsPanel draft={content.draft} onFieldChange={updateField} />
          ) : group.id === "customOrder" ? (
            <CustomOrderGalleryPanel onNotice={onNotice} />
          ) : (
            <>
              <div className="admin-content-fields">
                {group.fields.map((field) => (
                  <label
                    className={field.multiline ? "multiline" : ""}
                    key={field.key}
                  >
                    <span>
                      <strong>{field.label}</strong>
                      <small>{field.help}</small>
                    </span>
                    {field.multiline ? (
                      <textarea
                        rows={4}
                        maxLength={field.maximum}
                        value={content.draft[field.key]}
                        onChange={(event) =>
                          updateField(field.key, event.target.value)
                        }
                      />
                    ) : (
                      <input
                        maxLength={field.maximum}
                        value={content.draft[field.key]}
                        onChange={(event) =>
                          updateField(field.key, event.target.value)
                        }
                      />
                    )}
                    <em>
                      {content.draft[field.key].length}/{field.maximum}
                    </em>
                  </label>
                ))}
              </div>
              {group.id === "home" && (
                <HomeTileImagesPanel
                  draft={content.draft}
                  onFieldChange={updateField}
                />
              )}
            </>
          )}

          {!loading && group.id !== "customOrder" && (
            <footer>
              <button
                className="admin-secondary-button"
                type="button"
                disabled={Boolean(saving)}
                onClick={() => void save("draft")}
              >
                {saving === "draft" ? "Kaydediliyor…" : "Taslak kaydet"}
              </button>
              <button
                className="admin-primary-button"
                type="button"
                disabled={Boolean(saving) || !hasLocalChanges}
                onClick={() => void save("publish")}
              >
                {saving === "publish" ? "Yayınlanıyor…" : "Değişiklikleri yayınla"}
              </button>
            </footer>
          )}
        </section>
      </div>
    </div>
  );
}
