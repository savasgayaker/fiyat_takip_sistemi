import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { getMeta } from "@/lib/api";
import { presetRange, PresetKey } from "@/lib/dates";
import type { Meta } from "@/types";

interface AppState {
  meta?: Meta;
  metaLoading: boolean;
  from: string;
  to: string;
  preset: PresetKey;
  setPreset: (p: PresetKey) => void;
  setCustomRange: (from: string, to: string) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  dbPath: string;
  setDbPath: (p: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { data: meta, isLoading: metaLoading } = useQuery({
    queryKey: ["meta"],
    queryFn: getMeta,
  });

  const [preset, setPresetState] = useState<PresetKey>("son30");
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("theme") as "light" | "dark") || "light",
  );
  const [dbPath, setDbPath] = useState<string>(
    () => localStorage.getItem("dbPath") || "/data/fiyat_takip.sqlite",
  );

  // Initialise the range from the preset once meta is available.
  useEffect(() => {
    if (meta && !range) {
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

  const setPreset = (p: PresetKey) => {
    setPresetState(p);
    if (meta && p !== "ozel") {
      setRange(presetRange(p, meta.data_date, meta.base_day));
    }
  };

  const setCustomRange = (from: string, to: string) => {
    setPresetState("ozel");
    setRange({ from, to });
  };

  const value = useMemo<AppState>(
    () => ({
      meta,
      metaLoading,
      from: range?.from || meta?.base_day || "",
      to: range?.to || meta?.data_date || "",
      preset,
      setPreset,
      setCustomRange,
      theme,
      toggleTheme: () => setTheme((t) => (t === "light" ? "dark" : "light")),
      dbPath,
      setDbPath,
    }),
    [meta, metaLoading, range, preset, theme, dbPath],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}
