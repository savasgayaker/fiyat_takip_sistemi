import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { searchAll } from "@/lib/api";
import { tr } from "@/i18n/tr";
import type { SearchHit } from "@/types";
import { Badge } from "@/components/ui/badge";

export function SearchBox() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data = [] } = useQuery<SearchHit[]>({
    queryKey: ["search", q],
    queryFn: () => searchAll(q),
    enabled: q.length >= 2,
  });

  // "/" focuses the search box globally.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA"].includes(target.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (hit: SearchHit) => {
    setOpen(false);
    setQ("");
    if (hit.type === "class") {
      navigate(`/kirilim?kod=${hit.kod}`);
    } else {
      navigate(`/kirilim?item=${hit.kimlik}`);
    }
  };

  return (
    <div className="relative w-full max-w-md" ref={boxRef}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={tr.common.search}
        className="h-9 pl-9"
        data-testid="global-search-input"
      />
      {open && q.length >= 2 && (
        <div
          className="scrollbar-thin absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg"
          data-testid="search-results"
        >
          {data.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              {tr.common.noResults}
            </div>
          ) : (
            data.map((hit, i) => (
              <button
                key={`${hit.type}-${hit.kod || hit.kimlik}-${i}`}
                onClick={() => go(hit)}
                className="flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent"
                data-testid={`search-hit-${i}`}
              >
                <span className="truncate">{hit.ad_tr}</span>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {hit.type === "class"
                    ? (tr.seviye as any)[hit.seviye || ""] || "Sınıf"
                    : hit.kaynak}
                </Badge>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
