import dayjs from "dayjs";

export type PresetKey = "son7" | "ayBasi" | "son30" | "tuikAy" | "ozel";

export interface Range {
  from: string;
  to: string;
}

/** Bazdan önce endeks tanımsız: başlangıç baz gününden erken olamaz, bitiş veri tarihini aşamaz. */
export function clampRange(range: Range, baseDay: string, dataDate: string): Range & { clamped: boolean } {
  let { from, to } = range;
  let clamped = false;
  if (baseDay && from < baseDay) {
    from = baseDay;
    clamped = true;
  }
  if (dataDate && to > dataDate) to = dataDate;
  if (from > to) from = to;
  return { from, to, clamped };
}

/** Compute a date range for a preset given the data date (ISO); start never before the base day. */
export function presetRange(
  key: PresetKey,
  dataDate: string,
  baseDay: string,
): Range {
  const r = presetRangeRaw(key, dataDate, baseDay);
  const c = clampRange(r, baseDay, dataDate);
  return { from: c.from, to: c.to };
}

/** The preset's own window before the base-day rule (used to tell the user it was clamped). */
export function presetRangeRaw(
  key: PresetKey,
  dataDate: string,
  baseDay: string,
): Range {
  const dd = dayjs(dataDate);
  switch (key) {
    case "son7":
      return { from: dd.subtract(6, "day").format("YYYY-MM-DD"), to: dataDate };
    case "son30":
      return { from: dd.subtract(29, "day").format("YYYY-MM-DD"), to: dataDate };
    case "ayBasi": {
      const start = dd.startOf("month").format("YYYY-MM-DD");
      const from = start < baseDay ? baseDay : start;
      return { from, to: dataDate };
    }
    case "tuikAy": {
      // Previous full calendar month (TÜİK measurement window).
      const prev = dd.subtract(1, "month");
      const from = prev.startOf("month").format("YYYY-MM-DD");
      const to = prev.endOf("month").format("YYYY-MM-DD");
      return { from: from < baseDay ? baseDay : from, to };
    }
    default:
      return { from: baseDay, to: dataDate };
  }
}

export const PRESET_HOTKEYS: Record<string, PresetKey> = {
  "1": "son7",
  "2": "ayBasi",
  "3": "son30",
  "4": "tuikAy",
  "5": "ozel",
};
