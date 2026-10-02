"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const FALLBACK_GIFS = [
  "https://media.tenor.com/images/fb923e84a4c9a02a1ea9c0a1e05c01b8/tenor.gif",
  "https://media.tenor.com/images/c9f545f73cc6a4c94571c45e44d24e5e/tenor.gif",
] as const;

export const GIF_BUTTON_KEY = process.env.NEXT_PUBLIC_TENOR_KEY ?? "";

type HubGifPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closeAllEmojis: () => void;
  closeSiblingGifPickers: () => void;
  disabled?: boolean;
  onSendGif: (gifUrl: string) => Promise<void>;
};

export function HubGifPicker({
  open,
  onOpenChange,
  closeAllEmojis,
  closeSiblingGifPickers,
  disabled,
  onSendGif,
}: HubGifPickerProps) {
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<string[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const gifPickerRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGifs = useCallback(async (query: string) => {
    setLoadingGifs(true);
    try {
      const base = "https://tenor.googleapis.com/v2";
      const endpoint = query.trim()
        ? `${base}/search?q=${encodeURIComponent(query)}&key=${GIF_BUTTON_KEY}&limit=12&media_filter=tinygif`
        : `${base}/featured?key=${GIF_BUTTON_KEY}&limit=12&media_filter=tinygif`;

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Tenor API failed");
      const data = (await res.json()) as {
        results?: {
          media_formats?: { tinygif?: { url?: string }; gif?: { url?: string } };
        }[];
      };

      const urls = (data.results ?? [])
        .map(
          (r) =>
            r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || ""
        )
        .filter(Boolean);
      setGifs(urls.length > 0 ? urls : [...FALLBACK_GIFS]);
    } catch (err) {
      console.error("GIF fetch error:", err);
      setGifs([...FALLBACK_GIFS]);
    } finally {
      setLoadingGifs(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchGifs("");
    }
  }, [open, fetchGifs]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (gifPickerRef.current && !gifPickerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handler);
    }
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative" ref={gifPickerRef}>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          const next = !open;
          if (next) {
            closeSiblingGifPickers();
            closeAllEmojis();
          }
          onOpenChange(next);
        }}
        disabled={disabled}
        className="rounded-lg p-1.5 text-xs font-bold text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-500 dark:hover:bg-[#102840] dark:hover:text-slate-300"
        title="Send GIF"
      >
        GIF
      </button>

      {open ? (
        <div
          className="absolute bottom-10 left-0 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]"
          style={{ zIndex: 9999 }}
        >
          <div className="border-b border-gray-100 p-2 dark:border-[#1a3550]">
            <input
              type="text"
              placeholder="Search GIFs..."
              value={gifSearch}
              onChange={(e) => {
                const val = e.target.value;
                setGifSearch(val);
                if (searchDebounceRef.current) {
                  clearTimeout(searchDebounceRef.current);
                }
                searchDebounceRef.current = setTimeout(() => {
                  void fetchGifs(val);
                }, 400);
              }}
              className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none dark:border-[#1a3550] dark:bg-[#071929] dark:text-[#E8EAEE]"
            />
          </div>

          <div className="grid max-h-52 grid-cols-3 gap-1 overflow-y-auto p-2">
            {loadingGifs ? (
              <div className="col-span-3 py-6 text-center">
                <p className="text-xs text-gray-400 dark:text-slate-500">Loading GIFs...</p>
              </div>
            ) : gifs.length === 0 ? (
              <div className="col-span-3 py-6 text-center">
                <p className="text-xs text-gray-400 dark:text-slate-500">No GIFs found</p>
              </div>
            ) : (
              gifs.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void onSendGif(url);
                  }}
                  className="overflow-hidden rounded-lg border border-gray-100 transition-opacity hover:opacity-80 dark:border-[#1a3550]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-20 w-full object-cover" loading="lazy" />
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
