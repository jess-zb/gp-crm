"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  articleSearchText,
  getHelpCategories,
  type HelpArticle,
  type HelpCategory,
  type HelpContentBlock,
  type HelpDeskRole,
  roleSubtitle,
} from "@/app/(crm)/help/helpContent";

type Props = {
  role: HelpDeskRole;
};

function flattenArticles(categories: HelpCategory[]) {
  const items: {
    category: HelpCategory;
    article: HelpArticle;
  }[] = [];
  for (const c of categories) {
    for (const a of c.articles) {
      items.push({ category: c, article: a });
    }
  }
  return items;
}

function matchesQuery(
  q: string,
  article: HelpArticle,
  categoryTitle: string
) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const blob = articleSearchText(article);
  return (
    article.title.toLowerCase().includes(s) ||
    blob.toLowerCase().includes(s) ||
    categoryTitle.toLowerCase().includes(s)
  );
}

function calloutClass(variant: "tip" | "note" | "warning") {
  if (variant === "tip") {
    return "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800/80 dark:bg-emerald-950/35 dark:text-emerald-100";
  }
  if (variant === "note") {
    return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-50";
  }
  return "border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100";
}

function calloutLabel(variant: "tip" | "note" | "warning") {
  if (variant === "tip") return "Tip";
  if (variant === "note") return "Important note";
  return "Warning";
}

function HelpArticleBody({ article }: { article: HelpArticle }) {
  if (article.blocks?.length) {
    return (
      <div className="space-y-5">
        {article.blocks.map((b: HelpContentBlock, i: number) => {
          switch (b.type) {
            case "p":
              return (
                <p key={i} className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                  {b.text}
                </p>
              );
            case "h3":
              return (
                <h4
                  key={i}
                  className="scroll-mt-24 text-base font-semibold tracking-tight text-slate-900 dark:text-white"
                >
                  {b.text}
                </h4>
              );
            case "ol":
              return (
                <ol
                  key={i}
                  className="list-decimal space-y-2.5 pl-6 text-[15px] leading-relaxed text-slate-700 marker:font-semibold dark:text-slate-300"
                >
                  {b.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ol>
              );
            case "ul":
              return (
                <ul
                  key={i}
                  className="list-disc space-y-2.5 pl-6 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300"
                >
                  {b.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              );
            case "callout":
              return (
                <div
                  key={i}
                  role="note"
                  className={`rounded-xl border-2 px-4 py-3 shadow-sm ${calloutClass(b.variant)}`}
                >
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide opacity-90">
                    {calloutLabel(b.variant)}
                  </p>
                  <p className="text-sm leading-relaxed">{b.text}</p>
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
    );
  }
  return (
    <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
      {article.body}
    </div>
  );
}

export default function HelpDeskClient({ role }: Props) {
  const categories = useMemo(() => getHelpCategories(role), [role]);
  const flat = useMemo(() => flattenArticles(categories), [categories]);

  const [query, setQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    categories[0]?.id ?? ""
  );
  const [selectedArticleId, setSelectedArticleId] = useState(
    categories[0]?.articles[0]?.id ?? ""
  );
  const [mobileShowArticle, setMobileShowArticle] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? categories[0],
    [categories, selectedCategoryId]
  );

  const selectedArticle = useMemo(() => {
    if (!selectedCategory) return null;
    return (
      selectedCategory.articles.find((a) => a.id === selectedArticleId) ??
      selectedCategory.articles[0] ??
      null
    );
  }, [selectedCategory, selectedArticleId]);

  const filteredFlat = useMemo(() => {
    return flat.filter(({ category, article }) =>
      matchesQuery(query, article, category.title)
    );
  }, [flat, query]);

  useEffect(() => {
    if (!query.trim()) return;
    const first = filteredFlat[0];
    if (first) {
      setSelectedCategoryId(first.category.id);
      setSelectedArticleId(first.article.id);
    }
  }, [query, filteredFlat]);

  const selectArticle = useCallback(
    (categoryId: string, articleId: string, isMobile?: boolean) => {
      setSelectedCategoryId(categoryId);
      setSelectedArticleId(articleId);
      if (isMobile) setMobileShowArticle(true);
    },
    []
  );

  const breadcrumbCategory = selectedCategory?.title ?? "—";
  const breadcrumbArticle = selectedArticle?.title ?? "—";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 md:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Help Center
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {roleSubtitle(role)}
        </p>
      </header>

      <div className="mb-6">
        <label htmlFor="help-search" className="sr-only">
          Search help articles
        </label>
        <input
          id="help-search"
          type="search"
          placeholder="Search articles…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#8DE3B5] focus:outline-none focus:ring-2 focus:ring-[#8DE3B5]/30 dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-[#E8EAEE] dark:placeholder:text-slate-500"
        />
      </div>

      <nav
        className="mb-4 flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400 md:text-sm"
        aria-label="Breadcrumb"
      >
        <span className="font-medium text-slate-700 dark:text-slate-300">
          Help Center
        </span>
        <span aria-hidden>/</span>
        <span className="truncate">{breadcrumbCategory}</span>
        <span aria-hidden>/</span>
        <span className="truncate text-slate-800 dark:text-slate-200">
          {breadcrumbArticle}
        </span>
      </nav>

      {/* Mobile: category dropdown + list or article */}
      <div className="md:hidden">
        {!mobileShowArticle ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="help-category" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Category
              </label>
              <select
                id="help-category"
                value={selectedCategoryId}
                disabled={Boolean(query.trim())}
                onChange={(e) => {
                  const cid = e.target.value;
                  setSelectedCategoryId(cid);
                  const cat = categories.find((c) => c.id === cid);
                  const firstArt = cat?.articles[0];
                  if (firstArt) setSelectedArticleId(firstArt.id);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:opacity-60 dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-[#E8EAEE]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              {query.trim() ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Category filter is disabled while searching.
                </p>
              ) : null}
            </div>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-[#1a3550] dark:border-[#1a3550] dark:bg-[#0d2035]">
              {(query.trim()
                ? filteredFlat
                : (selectedCategory?.articles ?? []).map((article) => ({
                    category: selectedCategory!,
                    article,
                  }))
              ).map(({ category, article }) => {
                const active =
                  selectedArticleId === article.id &&
                  selectedCategoryId === category.id;
                return (
                  <li key={`${category.id}-${article.id}`}>
                    <button
                      type="button"
                      onClick={() => selectArticle(category.id, article.id, true)}
                      className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors ${
                        active
                          ? "bg-[#8DE3B5] text-[#0A2540]"
                          : "text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#071929]"
                      }`}
                    >
                      {query.trim() ? (
                        <span className="block text-xs font-normal opacity-80">
                          {category.title}
                        </span>
                      ) : null}
                      {article.title}
                    </button>
                  </li>
                );
              })}
            </ul>
            {query.trim() && filteredFlat.length === 0 ? (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                No articles match your search.
              </p>
            ) : null}
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setMobileShowArticle(false)}
              className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-[#E8EAEE] dark:hover:bg-[#102840]"
            >
              ← Back to articles
            </button>
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedArticle?.title}
                </h3>
                {selectedArticle ? (
                  <Link
                    href={`/help/guides/${role}/${selectedArticle.id}`}
                    className="shrink-0 text-sm font-semibold text-[#8DE3B5] hover:underline"
                  >
                    Interactive guide →
                  </Link>
                ) : null}
              </div>
              <div className="mt-4">
                {selectedArticle ? <HelpArticleBody article={selectedArticle} /> : null}
              </div>
            </article>
          </div>
        )}
      </div>

      {/* Desktop: two columns */}
      <div className="hidden gap-8 md:grid md:grid-cols-[minmax(220px,280px)_1fr]">
        <aside className="sticky top-6 max-h-[calc(100vh-8rem)] self-start overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 dark:border-[#1a3550] dark:bg-[#0d2035]">
          {query.trim() ? (
            <div className="space-y-1">
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Results ({filteredFlat.length})
              </p>
              {filteredFlat.map(({ category, article }) => {
                const active =
                  selectedArticleId === article.id &&
                  selectedCategoryId === category.id;
                return (
                  <button
                    key={`${category.id}-${article.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(category.id);
                      setSelectedArticleId(article.id);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-[#8DE3B5] font-medium text-[#0A2540]"
                        : "text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#071929]"
                    }`}
                  >
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {category.title}
                    </span>
                    <span className="block">{article.title}</span>
                  </button>
                );
              })}
              {filteredFlat.length === 0 ? (
                <p className="px-2 text-sm text-slate-500">No articles match.</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              {categories.map((cat) => (
                <div key={cat.id}>
                  <p className="mb-2 px-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {cat.title}
                  </p>
                  <ul className="space-y-0.5">
                    {cat.articles.map((a) => {
                      const active =
                        selectedCategoryId === cat.id && selectedArticleId === a.id;
                      return (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategoryId(cat.id);
                              setSelectedArticleId(a.id);
                            }}
                            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                              active
                                ? "bg-[#8DE3B5] font-medium text-[#0A2540]"
                                : "text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#071929]"
                            }`}
                          >
                            {a.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </aside>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {selectedArticle?.title ?? "Select an article"}
            </h3>
            {selectedArticle ? (
              <Link
                href={`/help/guides/${role}/${selectedArticle.id}`}
                className="shrink-0 text-sm font-semibold text-[#8DE3B5] hover:underline"
              >
                Interactive guide →
              </Link>
            ) : null}
          </div>
          <div className="mt-4">
            {selectedArticle ? <HelpArticleBody article={selectedArticle} /> : null}
          </div>
        </article>
      </div>
    </div>
  );
}
