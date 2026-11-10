"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Board filters (api/ROUTES.md "Board filters"). They live in the URL, so a
// filtered board can be bookmarked or shared, and the page refetches on change.

const FIELDS = [
  { key: "from", label: "From", placeholder: "DEL", airport: true },
  { key: "to", label: "To", placeholder: "ORD", airport: true },
  { key: "via", label: "Via (layover)", placeholder: "FRA", airport: true },
  { key: "date", label: "Date", placeholder: "", airport: false },
  { key: "flight", label: "Flight number", placeholder: "LH761", airport: false },
  { key: "language", label: "Language", placeholder: "Hindi", airport: false },
] as const;

type Key = (typeof FIELDS)[number]["key"];

/** The current filters as an API query string ("" when none are set). */
export function useBoardQuery(): string {
  const params = useSearchParams();
  const q = new URLSearchParams();
  for (const f of FIELDS) {
    const v = params.get(f.key)?.trim();
    if (v) q.set(f.key, v);
  }
  return q.toString();
}

export function BoardFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = Object.fromEntries(FIELDS.map((f) => [f.key, params.get(f.key) ?? ""])) as Record<Key, string>;
  const active = FIELDS.filter((f) => current[f.key]).length;
  const [open, setOpen] = useState(active > 0);
  const [values, setValues] = useState(current);

  const go = (v: Record<Key, string>) => {
    const q = new URLSearchParams();
    for (const f of FIELDS) {
      const x = v[f.key].trim();
      if (x) q.set(f.key, f.airport ? x.toUpperCase() : x);
    }
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  const clear = () => {
    const empty = Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Record<Key, string>;
    setValues(empty);
    go(empty);
  };

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <SlidersHorizontal /> Filters{active ? ` (${active})` : ""}
        </Button>
        {active > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <X /> Clear
          </Button>
        )}
      </div>
      {open && (
        <form
          className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            go(values);
          }}
        >
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              {f.label}
              <Input
                type={f.key === "date" ? "date" : "text"}
                value={values[f.key]}
                placeholder={f.placeholder}
                maxLength={f.airport ? 3 : 40}
                className={f.airport ? "uppercase" : undefined}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </label>
          ))}
          <div className="col-span-full flex gap-2">
            <Button type="submit" size="sm">
              Apply
            </Button>
            {active > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={clear}>
                Clear all
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
