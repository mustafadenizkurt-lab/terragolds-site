"use client";

import { useEffect, useState } from "react";

type BlogPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  metaTitle: string;
  metaDescription: string;
  status: "draft" | "published";
  publishedAt: string | null;
  updatedAt: string;
};

type BlogDraft = {
  id?: number;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  metaTitle: string;
  metaDescription: string;
  status: "draft" | "published";
  slug: string;
};

const emptyDraft: BlogDraft = {
  title: "",
  excerpt: "",
  content: "",
  coverImage: "",
  category: "",
  metaTitle: "",
  metaDescription: "",
  status: "draft",
  slug: "",
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

async function readJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(body.error ?? "İşlem tamamlanamadı."));
  }
  return body;
}

export default function BlogPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [draft, setDraft] = useState<BlogDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const loadPosts = async () => {
    setLoading(true);
    setError("");
    try {
      const body = await readJson(
        await fetch("/api/admin/blog", { cache: "no-store" }),
      );
      setPosts((body.posts as BlogPost[] | undefined) ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Yazılar alınamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPosts();
  }, []);

  const editPost = (post: BlogPost) => {
    setDraft({
      id: post.id,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      coverImage: post.coverImage,
      category: post.category,
      metaTitle: post.metaTitle,
      metaDescription: post.metaDescription,
      status: post.status,
      slug: post.slug,
    });
    setError("");
  };

  const uploadCoverImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !draft) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const body = await readJson(response);
      setDraft((current) =>
        current ? { ...current, coverImage: String(body.url) } : current,
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Görsel yüklenemedi.",
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const savePost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        draft.id ? `/api/admin/blog/${draft.id}` : "/api/admin/blog",
        {
          method: draft.id ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const body = await readJson(response);
      setPosts(body.posts as BlogPost[]);
      setDraft(null);
      onNotice(draft.id ? "Yazı güncellendi." : "Yazı oluşturuldu.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Yazı kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deletePost = async (post: BlogPost) => {
    if (!window.confirm(`"${post.title}" kalıcı olarak silinsin mi?`)) return;
    setSaving(true);
    setError("");
    try {
      const body = await readJson(
        await fetch(`/api/admin/blog/${post.id}`, { method: "DELETE" }),
      );
      setPosts(body.posts as BlogPost[]);
      onNotice("Yazı silindi.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Yazı silinemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-discounts">
      <section className="admin-discount-hero">
        <div>
          <p className="admin-kicker">İçerik pazarlaması</p>
          <h2>Blog yazılarınızı yönetin.</h2>
          <p>
            Bakım rehberleri, taş bilgisi ve stil önerileri yayınlayarak
            organik trafiği artırın. Taslaklar mağazada görünmez.
          </p>
        </div>
        <button
          className="admin-primary-button"
          type="button"
          onClick={() => setDraft({ ...emptyDraft })}
        >
          ＋ Yeni yazı
        </button>
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

      {loading ? (
        <div className="admin-loading">
          <span />
          <p>Yazılar hazırlanıyor…</p>
        </div>
      ) : posts.length ? (
        <div className="admin-discount-list">
          {posts.map((post) => (
            <article key={post.id}>
              <div className="admin-discount-code">
                <strong>{post.title}</strong>
                <span
                  className={
                    post.status === "published"
                      ? "discount-state active"
                      : "discount-state"
                  }
                >
                  {post.status === "published" ? "Yayında" : "Taslak"}
                </span>
              </div>
              <div>
                <b>{post.category || "Kategorisiz"}</b>
                <small>
                  {post.publishedAt
                    ? dateFormatter.format(new Date(post.publishedAt))
                    : "Henüz yayınlanmadı"}
                </small>
              </div>
              <div className="admin-discount-actions">
                <button type="button" onClick={() => editPost(post)}>
                  Düzenle
                </button>
                <button
                  className="danger"
                  type="button"
                  onClick={() => void deletePost(post)}
                  disabled={saving}
                >
                  Sil
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-empty">
          <span>≡</span>
          <h2>Henüz blog yazısı yok</h2>
          <p>İlk içeriğinizi oluşturduğunuzda burada görünecek.</p>
          <button type="button" onClick={() => setDraft({ ...emptyDraft })}>
            Yazı oluştur
          </button>
        </div>
      )}

      {draft && (
        <div
          className="admin-payment-drawer-backdrop"
          role="presentation"
          onMouseDown={() => !saving && setDraft(null)}
        >
          <form
            className="admin-payment-drawer admin-blog-drawer"
            onSubmit={savePost}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="discount-drawer-mark">≡</span>
                <div>
                  <p>Blog</p>
                  <h2>{draft.id ? "Yazıyı düzenle" : "Yeni yazı"}</h2>
                </div>
              </div>
              <button type="button" aria-label="Kapat" onClick={() => setDraft(null)}>
                ×
              </button>
            </header>
            <div className="admin-payment-drawer-body">
              <div className="admin-field-grid">
                <label className="admin-field full">
                  <span>Başlık</span>
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                    placeholder="Örn. Gümüş Takılarınızı Nasıl Parlak Tutarsınız?"
                    required
                  />
                </label>
                <label className="admin-field">
                  <span>Kategori</span>
                  <input
                    value={draft.category}
                    onChange={(event) =>
                      setDraft({ ...draft, category: event.target.value })
                    }
                    placeholder="Bakım Rehberi"
                  />
                </label>
                <label className="admin-field">
                  <span>URL (slug)</span>
                  <input
                    value={draft.slug}
                    onChange={(event) =>
                      setDraft({ ...draft, slug: event.target.value })
                    }
                    placeholder="Boş bırakılırsa başlıktan oluşturulur"
                  />
                </label>
                <label className="admin-field full">
                  <span>Özet</span>
                  <textarea
                    rows={2}
                    value={draft.excerpt}
                    onChange={(event) =>
                      setDraft({ ...draft, excerpt: event.target.value })
                    }
                    placeholder="Liste sayfasında görünecek kısa özet"
                  />
                </label>
                <label className="admin-field full">
                  <span>İçerik</span>
                  <textarea
                    rows={12}
                    value={draft.content}
                    onChange={(event) =>
                      setDraft({ ...draft, content: event.target.value })
                    }
                    placeholder="Yazının tamamı - paragrafları boş satırla ayırın"
                  />
                </label>
                <div className="admin-field full">
                  <span>Kapak görseli</span>
                  {draft.coverImage && (
                    <div className="admin-image-preview">
                      <img src={draft.coverImage} alt="Kapak önizlemesi" />
                    </div>
                  )}
                  <label className="admin-upload-button">
                    {uploading ? "Yükleniyor…" : "Görsel yükle"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={uploadCoverImage}
                      disabled={uploading}
                    />
                  </label>
                  <input
                    value={draft.coverImage}
                    onChange={(event) =>
                      setDraft({ ...draft, coverImage: event.target.value })
                    }
                    placeholder="veya görsel bağlantısı yapıştırın"
                  />
                </div>
                <label className="admin-field full">
                  <span>Meta başlık (SEO)</span>
                  <input
                    value={draft.metaTitle}
                    onChange={(event) =>
                      setDraft({ ...draft, metaTitle: event.target.value })
                    }
                    placeholder="Boş bırakılırsa başlıktan oluşturulur"
                  />
                </label>
                <label className="admin-field full">
                  <span>Meta açıklama (SEO)</span>
                  <textarea
                    rows={2}
                    value={draft.metaDescription}
                    onChange={(event) =>
                      setDraft({ ...draft, metaDescription: event.target.value })
                    }
                    placeholder="Boş bırakılırsa özetten oluşturulur"
                  />
                </label>
                <label className="admin-field">
                  <span>Durum</span>
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        status: event.target.value as "draft" | "published",
                      })
                    }
                  >
                    <option value="draft">Taslak</option>
                    <option value="published">Yayında</option>
                  </select>
                </label>
              </div>
            </div>
            <footer>
              <button
                className="admin-secondary-button"
                type="button"
                onClick={() => setDraft(null)}
                disabled={saving}
              >
                Vazgeç
              </button>
              <button
                className="admin-primary-button"
                type="submit"
                disabled={saving || uploading}
              >
                {saving ? "Kaydediliyor…" : "Yazıyı kaydet"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
