import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { getMeta } from "@/lib/api";
import { clampRange, presetRange, presetRangeRaw, PresetKey } from "@/lib/dates";
import type { Meta } from "@/types";

interface AppState {
  meta?: Meta;
  metaLoading: boolean;
  from: string;
  to: string;
  preset: PresetKey;
  setPreset: (p: PresetKey) => void;
  setCustomRange: (from: string, to: string) => void;
  /** İstenen başlangıç baz gününden önceydi ve baz gününe çekildi (tüm ekranlar için tek kural). */
  fromClamped: boolean;
  /** Kırpılmadan önce istenen başlangıç (bilgi amaçlı). */
  requestedFrom: string;
  theme: "light" | "dark";
  toggleTheme: () => void;
  dbPath: string;
  setDbPath: (p: string) => void;
  /** Kaydedilmemiş özel sepet ağırlıkları (bölüm kodu → ağırlık); ekran değişince ve F5'te kalır. */
  basketCustom: Record<string, number>;
  setBasketCustom: (w: Record<string, number>) => void;
  /** En son seçilen hazır sepet (referans, gri kesikli çizgi). */
  basketPreset: string;
  setBasketPreset: (name: string) => void;
}

const BASKET_CUSTOM_KEY = "basketCustom";
const BASKET_PRESET_KEY = "basketPreset";
export const DEFAULT_BASKET_PRESET = "TÜİK 2026";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { data: meta, isLoading: metaLoading } = useQuery({
    queryKey: ["meta"],
    queryFn: getMeta,
  });

  const [preset, setPresetState] = useState<PresetKey>("son30");
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [requestedFrom, setRequestedFrom] = useState<string>("");
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("theme") as "light" | "dark") || "light",
  );
  const [dbPath, setDbPath] = useState<string>(
    () => localStorage.getItem("dbPath") || "/data/fiyat_takip.sqlite",
  );
  const [basketCustom, setBasketCustom] = useState<Record<string, number>>(() =>
    readJson<Record<string, number>>(BASKET_CUSTOM_KEY, {}),
  );
  const [basketPreset, setBasketPreset] = useState<string>(
    () => localStorage.getItem(BASKET_PRESET_KEY) || DEFAULT_BASKET_PRESET,
  );

  useEffect(() => {
    try {
      localStorage.setItem(BASKET_CUSTOM_KEY, JSON.stringify(basketCustom));
    } catch {
      /* depolama kapalıysa sessizce geç */
    }
  }, [basketCustom]);

  useEffect(() => {
    try {
      localStorage.setItem(BASKET_PRESET_KEY, basketPreset);
    } catch {
      /* depolama kapalıysa sessizce geç */
    }
  }, [basketPreset]);

  // Initialise the range from the preset once meta is available.
  useEffect(() => {
    if (meta && !range) {
      setRequestedFrom(presetRangeRaw("son30", meta.data_date, meta.base_day).from);
      setRange(presetRange("son30", meta.data_date, meta.base_day));
    }
  }, [meta, range]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("dbPath", dbPath);
  }, [dbPath]);

  const setPreset = useCallback(
    (p: PresetKey) => {
      setPresetState(p);
      if (meta && p !== "ozel") {
        setRequestedFrom(presetRangeRaw(p, meta.data_date, meta.base_day).from);
        setRange(presetRange(p, meta.data_date, meta.base_day));
      }
    },
    [meta],
  );

  const setCustomRange = useCallback(
    (from: string, to: string) => {
      setPresetState("ozel");
      setRequestedFrom(from);
      const c = clampRange({ from, to }, meta?.base_day || "", meta?.data_date || "");
      setRange({ from: c.from, to: c.to });
    },
    [meta],
  );

  const value = useMemo<AppState>(
    () => ({
      meta,
      metaLoading,
      from: range?.from || meta?.base_day || "",
      to: range?.to || meta?.data_date || "",
      preset,
      setPreset,
      setCustomRange,
      fromClamped: !!meta && !!requestedFrom && requestedFrom < meta.base_day,
      requestedFrom,
      theme,
      toggleTheme: () => setTheme((t) => (t === "light" ? "dark" : "light")),
      dbPath,
      setDbPath,
      basketCustom,
      setBasketCustom,
      basketPreset,
      setBasketPreset,
    }),
    [meta, metaLoading, range, preset, requestedFrom, theme, dbPath, setPreset, setCustomRange, basketCustom, basketPreset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}
