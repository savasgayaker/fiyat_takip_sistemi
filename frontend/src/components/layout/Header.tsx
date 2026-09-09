import { useEffect } from "react";
import { SearchBox } from "./SearchBox";
import { DateRangePicker } from "./DateRangePicker";
import { ThemeToggle } from "./ThemeToggle";
import { SettingsDialog } from "./SettingsDialog";
import { useApp } from "@/context/AppContext";
import { PRESET_HOTKEYS } from "@/lib/dates";

export function Header() {
  const { setPreset } = useApp();

  // Number keys 1–5 switch date presets (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const p = PRESET_HOTKEYS[e.key];
      if (p) {
        e.preventDefault();
        setPreset(p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPreset]);

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
      <div className="flex-1">
        <SearchBox />
      </div>
      <DateRangePicker />
      <ThemeToggle />
      <SettingsDialog />
    </header>
  );
}
