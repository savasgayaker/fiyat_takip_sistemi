import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import { tr } from "@/i18n/tr";
import { fmtDate } from "@/lib/format";
import { PresetKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

const presets: { key: PresetKey; label: string; hot: string }[] = [
  { key: "son7", label: tr.presets.son7, hot: "1" },
  { key: "ayBasi", label: tr.presets.ayBasi, hot: "2" },
  { key: "son30", label: tr.presets.son30, hot: "3" },
  { key: "tuikAy", label: tr.presets.tuikAy, hot: "4" },
  { key: "ozel", label: tr.presets.ozel, hot: "5" },
];

export function DateRangePicker() {
  const { from, to, preset, setPreset, setCustomRange, meta } = useApp();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          data-testid="date-range-trigger"
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="tabular">
            {fmtDate(from)} – {fmtDate(to)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => (
              <Button
                key={p.key}
                variant={preset === p.key ? "default" : "outline"}
                size="sm"
                className={cn("justify-between text-xs")}
                onClick={() => setPreset(p.key)}
                data-testid={`preset-${p.key}`}
              >
                {p.label}
                <kbd className="ml-1 rounded bg-black/10 px-1 text-[10px]">
                  {p.hot}
                </kbd>
              </Button>
            ))}
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">
                  Başlangıç
                </label>
                <Input
                  type="date"
                  value={from}
                  min={meta?.base_day}
                  max={to}
                  onChange={(e) => setCustomRange(e.target.value, to)}
                  className="h-8 text-xs"
                  data-testid="date-from-input"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Bitiş</label>
                <Input
                  type="date"
                  value={to}
                  min={from}
                  max={meta?.data_date}
                  onChange={(e) => setCustomRange(from, e.target.value)}
                  className="h-8 text-xs"
                  data-testid="date-to-input"
                />
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
