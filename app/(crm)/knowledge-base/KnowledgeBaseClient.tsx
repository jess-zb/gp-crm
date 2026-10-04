"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { KNOWLEDGE_CATEGORIES } from "@/lib/knowledge-base/curriculum";
import { parseKnowledgeMarkdown } from "@/lib/knowledge-base/markdown";

type Article = {
  id: string;
  title: string;
  body: string;
  category: string;
  sort_order: number;
  updated_at: string;
};

type Draft = {
  id: string | null;
  title: string;
  category: string;
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
        if (block.type === "image") {
          return (
            <figure key={index} className="overflow-hidden rounded-lg border border-slate-200 dark:border-[#2E2E2E]">
              {/* Real product screenshots shipped with the guide. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={block.src} alt={block.alt} className="w-full bg-slate-950" />
              {block.alt ? (
                <figcaption className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-[#2E2E2E] dark:text-slate-400">
                  {block.alt}
                </figcaption>
              ) : null}
            </figure>
          );
        }
        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={index}
              className={`space-y-1 pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}
            >
              {block.items.map((item) => (
                <li key={item}>
                  <RichText text={item} />
                </li>
              ))}
            </ListTag>
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
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("knowledge_base_articles")
      .select("id, title, body, category, sort_order, updated_at")
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
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return articles;
    return articles.filter((article) =>
      [article.title, article.category, article.body].join("\n").toLowerCase().includes(needle)
    );
  }, [articles, query]);
  const grouped = useMemo(() => {
    const known = new Set<string>(KNOWLEDGE_CATEGORIES);
    const extras: string[] = [];
    for (const article of filtered) {
      const category = article.category || "Start here";
      if (!known.has(category) && !extras.includes(category)) extras.push(category);
    }
    const order = [...KNOWLEDGE_CATEGORIES, ...extras];
    return order
      .map((category) => ({
        category,
        articles: filtered.filter((article) => (article.category || "Start here") === category),
      }))
      .filter((group) => group.articles.length > 0);
  }, [filtered]);

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
        .update({ title, body: draft.body, category: draft.category })
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
      .insert({ title, body: draft.body, category: draft.category, sort_order: nextOrder })
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
        A walkthrough for each role and department. Follow one article at a time. The pictures are the real screens.
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
                setDraft({ id: null, title: "", category: "Start here", body: "" });
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              New article
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="gp-card !p-2">
            <label className="mb-2 block">
              <span className="sr-only">Search articles</span>
              <span className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 dark:border-[#2E2E2E]">
                <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search the guide"
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                />
              </span>
            </label>
            {canEdit ? (
              <button
                type="button"
                className="crm-btn-primary mb-2 w-full"
                onClick={() => {
                  setSaveError(null);
                  setDraft({ id: null, title: "", category: "Start here", body: "" });
                }}
              >
                <Plus className="h-4 w-4" aria-hidden />
                New article
              </button>
            ) : null}
            {grouped.length === 0 ? (
              <p className="px-2 py-3 text-sm text-slate-500 dark:text-slate-400">No articles match that search.</p>
            ) : (
              grouped.map((group) => (
                <div key={group.category} className="mb-3">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {group.category}
                  </p>
                  <ul className="space-y-1">
                    {group.articles.map((article) => {
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
              ))
            )}
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
                  <span className="font-medium text-slate-800 dark:text-slate-200">Section</span>
                  <select
                    aria-label="Section"
                    value={draft.category}
                    onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#A87830] focus:outline-none focus:ring-2 focus:ring-[#A87830]/20 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                  >
                    {KNOWLEDGE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
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
                  A line starting with # is a heading, 1. is a step, - is a bullet, and **bold** makes a word bold.
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
                      {selected.category} · Updated {formatUpdated(selected.updated_at)}
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-[#A87830] dark:border-[#2E2E2E] dark:text-slate-200"
                        onClick={() => {
                          setSaveError(null);
                          setDraft({
                            id: selected.id,
                            title: selected.title,
                            category: selected.category || "Start here",
                            body: selected.body,
                          });
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
