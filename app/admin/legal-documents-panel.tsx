"use client";

import { useState } from "react";
import {
  legalDocuments,
  legalFieldKeys,
  parseLegalSections,
  type LegalDocumentKey,
  type LegalSection,
  type SiteContent,
  type SiteContentKey,
} from "../../lib/site-content-types";

export default function LegalDocumentsPanel({
  draft,
  onFieldChange,
}: {
  draft: SiteContent;
  onFieldChange: (key: SiteContentKey, value: string) => void;
}) {
  const [activeKey, setActiveKey] = useState<LegalDocumentKey>("kvkk");
  const meta = legalDocuments.find((item) => item.key === activeKey) ?? legalDocuments[0];
  const keys = legalFieldKeys(meta.fieldPrefix);
  const sections = parseLegalSections(draft[keys.sections]);

  const updateSections = (next: LegalSection[]) => {
    onFieldChange(keys.sections, JSON.stringify(next));
  };

  const updateSection = (index: number, patch: Partial<LegalSection>) => {
    updateSections(
      sections.map((section, i) => (i === index ? { ...section, ...patch } : section)),
    );
  };

  const addSection = () => {
    updateSections([...sections, { title: "Yeni bölüm", type: "paragraph", text: "" }]);
  };

  const removeSection = (index: number) => {
    if (!window.confirm("Bu bölüm silinsin mi?")) return;
    updateSections(sections.filter((_, i) => i !== index));
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = sections.slice();
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    updateSections(next);
  };

  return (
    <div className="admin-legal-editor">
      <nav className="admin-legal-doc-tabs" aria-label="Hukuki belgeler">
        {legalDocuments.map((doc) => (
          <button
            key={doc.key}
            type="button"
            className={doc.key === activeKey ? "active" : ""}
            onClick={() => setActiveKey(doc.key)}
          >
            {doc.label}
          </button>
        ))}
      </nav>

      <div className="admin-legal-doc-body">
        <a
          className="admin-legal-preview-link"
          href={meta.previewUrl}
          target="_blank"
          rel="noreferrer"
        >
          Sayfayı görüntüle ↗
        </a>

        <div className="admin-content-fields">
          <label>
            <span>
              <strong>Üst başlık</strong>
              <small>Ana başlığın üstünde görünen kısa etiket.</small>
            </span>
            <input
              value={draft[keys.eyebrow]}
              onChange={(event) => onFieldChange(keys.eyebrow, event.target.value)}
            />
          </label>
          <label>
            <span>
              <strong>Sayfa başlığı</strong>
              <small>Belgenin ana başlığı.</small>
            </span>
            <input
              value={draft[keys.title]}
              onChange={(event) => onFieldChange(keys.title, event.target.value)}
            />
          </label>
          <label className="multiline">
            <span>
              <strong>Kısa açıklama</strong>
              <small>Başlığın altında görünen özet cümle.</small>
            </span>
            <textarea
              rows={2}
              value={draft[keys.summary]}
              onChange={(event) => onFieldChange(keys.summary, event.target.value)}
            />
          </label>
          <label>
            <span>
              <strong>Son güncelleme tarihi</strong>
              <small>Sayfada "Son güncelleme:" olarak görünür.</small>
            </span>
            <input
              value={draft[keys.updated]}
              onChange={(event) => onFieldChange(keys.updated, event.target.value)}
            />
          </label>
        </div>

        <div className="admin-legal-sections">
          <div className="admin-legal-sections-head">
            <h3>Bölümler</h3>
            <button
              type="button"
              className="admin-secondary-button"
              onClick={addSection}
            >
              ＋ Bölüm ekle
            </button>
          </div>

          {sections.map((section, index) => (
            <div className="admin-legal-section-card" key={index}>
              <div className="admin-legal-section-head">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <input
                  value={section.title}
                  onChange={(event) => updateSection(index, { title: event.target.value })}
                  placeholder="Bölüm başlığı"
                />
                <select
                  value={section.type}
                  onChange={(event) =>
                    updateSection(index, {
                      type: event.target.value === "bullets" ? "bullets" : "paragraph",
                    })
                  }
                >
                  <option value="paragraph">Paragraf</option>
                  <option value="bullets">Madde listesi</option>
                </select>
                <div className="admin-legal-section-actions">
                  <button
                    type="button"
                    onClick={() => moveSection(index, -1)}
                    disabled={index === 0}
                    aria-label="Yukarı taşı"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(index, 1)}
                    disabled={index === sections.length - 1}
                    aria-label="Aşağı taşı"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => removeSection(index)}
                    aria-label="Bölümü sil"
                  >
                    ×
                  </button>
                </div>
              </div>
              <textarea
                rows={4}
                value={section.text}
                onChange={(event) => updateSection(index, { text: event.target.value })}
                placeholder={
                  section.type === "bullets"
                    ? "Her satıra bir madde yazın"
                    : "Paragraf metni (yeni paragraf için bir satır boş bırakın)"
                }
              />
            </div>
          ))}

          {sections.length === 0 && (
            <p className="admin-legal-empty">
              Bu belgede henüz bölüm yok. "Bölüm ekle" ile başlayın.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
