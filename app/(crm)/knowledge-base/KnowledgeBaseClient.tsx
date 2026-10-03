"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseKnowledgeMarkdown } from "@/lib/knowledge-base/markdown";

type Article = {
  id: string;
  title: string;
  body: string;
  sort_order: number;
  updated_at: string;
};

type Draft = {
  id: string | null;
  title: string;
  body: string;
};

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={index} className="font-semibold text-slate-900 dark:text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function ArticleBody({ body }: { body: string }) {
  const blocks = parseKnowledgeMarkdown(body);
  if (blocks.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">This article has no body yet.</p>;
  }
  return (
    <div className="space-y-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3 key={index} className="text-base font-semibold text-slate-900 dark:text-white">
              <RichText text={block.text} />
            </h3>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items.map((item) => (
                <li key={item}>
                  <RichText text={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index}>
            <RichText text={block.text} />
          </p>
        );
      })}
    </div>
  );
}

function formatUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function KnowledgeBaseClient({ canEdit }: { canEdit: boolean }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("knowledge_base_articles")
      .select("id, title, body, sort_order, updated_at")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });
    if (error) {
      setLoadError(error.message);
      setArticles([]);
    } else {
      const rows = (data ?? []) as Article[];
      setArticles(rows);
      setSelectedId((current) => {
        if (current && rows.some((row) => row.id === current)) return current;
        return rows[0]?.id ?? null;
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = articles.find((article) => article.id === selectedId) ?? null;

  async function saveDraft() {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) {
      setSaveError("Add a title before saving.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();
    if (draft.id) {
      const { error } = await supabase
        .from("knowledge_base_articles")
        .update({ title, body: draft.body })
        .eq("id", draft.id);
      setSaving(false);
      if (error) {
        setSaveError(error.message);
        return;
      }
      setDraft(null);
      await load();
      setSelectedId(draft.id);
      return;
    }
    const nextOrder = articles.reduce((max, article) => Math.max(max, article.sort_order), 0) + 10;
    const { data, error } = await supabase
      .from("knowledge_base_articles")
      .insert({ title, body: draft.body, sort_order: nextOrder })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    const id = (data as { id: string }).id;
    setDraft(null);
    await load();
    setSelectedId(id);
  }

  async function removeArticle(article: Article) {
    if (!window.confirm(`Delete “${article.title}”?`)) return;
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();
    const { error } = await supabase.from("knowledge_base_articles").delete().eq("id", article.id);
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    if (draft?.id === article.id) setDraft(null);
    await load();
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-slate-600 dark:text-slate-400">
        How Golden Pathway staff create clients, use MIDs, and send documents.
        {canEdit ? " Admins can edit these articles." : " You can read these articles."}
      </p>

      {saveError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          {saveError}
        </div>
      ) : null}

      {loading ? (
        <div className="gp-card" role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin text-[#A87830]" aria-hidden />
            Loading articles…
          </div>
        </div>
      ) : loadError ? (
        <div role="alert" className="gp-card text-sm text-red-700 dark:text-red-300">
          {loadError}
        </div>
      ) : articles.length === 0 && !draft ? (
        <div className="gp-card text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-white">No articles yet</p>
          <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">
            {canEdit
              ? "Add the first article. It is stored in the database."
              : "An admin has not published any articles yet."}
          </p>
          {canEdit ? (
            <button
              type="button"
              className="crm-btn-primary mt-4"
              onClick={() => {
                setSaveError(null);
                setDraft({ id: null, title: "", body: "" });
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              New article
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="gp-card !p-2">
            {canEdit ? (
              <button
                type="button"
                className="crm-btn-primary mb-2 w-full"
                onClick={() => {
                  setSaveError(null);
                  setDraft({ id: null, title: "", body: "" });
                }}
              >
                <Plus className="h-4 w-4" aria-hidden />
                New article
              </button>
            ) : null}
            <ul className="space-y-1">
              {articles.map((article) => {
                const active = article.id === selectedId && !draft;
                return (
                  <li key={article.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(null);
                        setSelectedId(article.id);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                        active
                          ? "bg-[#F4E8D4] font-semibold text-[#161616] dark:bg-[#A87830]/20 dark:text-white"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                      }`}
                    >
                      {article.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <section className="gp-card min-w-0">
            {draft ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveDraft();
                }}
              >
                <label className="block text-sm">
                  <span className="font-medium text-slate-800 dark:text-slate-200">Title</span>
                  <input
                    aria-label="Title"
                    value={draft.title}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#A87830] focus:outline-none focus:ring-2 focus:ring-[#A87830]/20 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-800 dark:text-slate-200">Body</span>
                  <textarea
                    aria-label="Body"
                    value={draft.body}
                    rows={12}
                    onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#A87830] focus:outline-none focus:ring-2 focus:ring-[#A87830]/20 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                  />
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Markdown: a line starting with # for a heading, a line starting with - for a list, and **bold**.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="crm-btn-primary" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    Save article
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                    onClick={() => {
                      setDraft(null);
                      setSaveError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : selected ? (
              <article>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{selected.title}</h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Updated {formatUpdated(selected.updated_at)}
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-[#A87830] dark:border-[#2E2E2E] dark:text-slate-200"
                        onClick={() => {
                          setSaveError(null);
                          setDraft({ id: selected.id, title: selected.title, body: selected.body });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                        disabled={saving}
                        onClick={() => void removeArticle(selected)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="mt-4">
                  <ArticleBody body={selected.body} />
                </div>
              </article>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Select an article.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
