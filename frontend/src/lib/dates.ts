import dayjs from "dayjs";

export type PresetKey = "son7" | "ayBasi" | "son30" | "tuikAy" | "ozel";

export interface Range {
  from: string;
  to: string;
}

/** Compute a date range for a preset given the data date (ISO). */
export function presetRange(
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
