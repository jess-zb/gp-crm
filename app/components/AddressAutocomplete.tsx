"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

export interface AddressResult {
  street: string;
  city: string;
  state: string;
  zip: string;
}

type HereAddress = {
  label?: string;
  houseNumber?: string;
  street?: string;
  city?: string;
  county?: string;
  state?: string;
  stateCode?: string;
  postalCode?: string;
};

type HereAutocompleteItem = {
  id: string;
  address?: HereAddress;
};

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSelect: (addr: AddressResult) => void;
  placeholder?: string;
  className?: string;
  name?: string;
}

const STATE_CODES: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
};

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing address...",
  className = "",
  name,
}: Props) {
  const [suggestions, setSuggestions] = useState<HereAutocompleteItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hereKey = process.env.NEXT_PUBLIC_HERE_KEY ?? "";
  const hereApiKey = hereKey.trim();

  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (val: string) => {
    onChange(val);
    if (debounceRef.current !== undefined) clearTimeout(debounceRef.current);

    if (val.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      setActiveIndex(-1);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (!hereApiKey) {
        setSuggestions([]);
        setShowDropdown(false);
        setActiveIndex(-1);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `https://autocomplete.search.hereapi.com/v1/autocomplete?` +
            `q=${encodeURIComponent(val)}` +
            `&in=countryCode:USA` +
            `&types=houseNumber` +
            `&limit=6` +
            `&apiKey=${hereApiKey}`,
          { headers: { Accept: "application/json" } }
        );
        const data = (await res.json()) as { items?: HereAutocompleteItem[] };
        const items = data.items ?? [];
        setSuggestions(items);
        setShowDropdown(items.length > 0);
      } catch (err) {
        console.error("Here autocomplete error:", err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSelect = async (item: HereAutocompleteItem) => {
    if (!hereApiKey) {
      setShowDropdown(false);
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch(
        `https://lookup.search.hereapi.com/v1/lookup?` +
          `id=${encodeURIComponent(item.id)}` +
          `&apiKey=${hereApiKey}`
      );
      const data = (await res.json()) as { address?: HereAddress };
      const addr = data.address ?? {};

      const street = [addr.houseNumber, addr.street].filter(Boolean).join(" ");
      const city = addr.city || addr.county || "";
      const stateCode =
        (addr.state && STATE_CODES[addr.state]) ||
        addr.stateCode ||
        addr.state ||
        "";
      const zip = addr.postalCode || "";

      onChange(street);
      onSelect({ street, city, state: stateCode, zip });
    } catch {
      const label = item.address?.label || "";
      const parts = label.split(",").map((s: string) => s.trim());
      const street = parts[0] || "";
      const city = parts[1] || "";
      const stateZip = parts[2] || "";
      const stateMatch = stateZip.match(/([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
      const state = stateMatch?.[1] || "";
      const zip = stateMatch?.[2] || "";

      onChange(street);
      onSelect({ street, city, state, zip });
    }

    setShowDropdown(false);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      void handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  const defaultClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#A87830] focus:outline-none focus:ring-1 focus:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white dark:placeholder:text-slate-500";

  return (
    <div ref={wrapperRef} className="relative w-full min-w-0">
      <input
        id={name || "address-autocomplete"}
        name={name || "street_address"}
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={className || defaultClass}
      />
      {loading ? (
        <div className="pointer-events-none absolute right-3 top-2.5 text-xs text-gray-400 dark:text-slate-500">
          Searching...
        </div>
      ) : null}
      {showDropdown && suggestions.length > 0 ? (
        <ul className="absolute z-50 mt-1 max-h-56 w-full min-w-0 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
          {suggestions.map((item, i) => {
            const addr = item.address ?? {};
            const street = [addr.houseNumber, addr.street].filter(Boolean).join(" ");
            const cityState = [addr.city, addr.stateCode].filter(Boolean).join(", ");
            const zip = addr.postalCode || "";
            return (
              <li
                key={item.id || String(i)}
                onMouseDown={() => void handleSelect(item)}
                className={`cursor-pointer border-b border-gray-100 px-4 py-2.5 text-sm last:border-0 dark:border-[#2E2E2E] ${
                  i === activeIndex
                    ? "bg-green-100 text-green-900 dark:bg-emerald-900/50 dark:text-emerald-100"
                    : "hover:bg-green-50 dark:hover:bg-[#242424]"
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-slate-100">
                  {street || addr.label}
                </div>
                <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                  {cityState} {zip}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {!hereApiKey ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Suggestions unavailable — you can still type the address manually.
        </p>
      ) : null}
    </div>
  );
}
