/** Fixed division (bolum) colour palette — consistent across every chart. */
export const DIVISION_COLORS: Record<string, string> = {
  "01": "#2563EB", // Gıda
  "02": "#7C3AED", // Alkollü içecekler / tütün
  "03": "#DB2777", // Giyim
  "04": "#059669", // Konut
  "05": "#D97706", // Ev eşyası
  "06": "#DC2626", // Sağlık
  "07": "#0891B2", // Ulaştırma
  "08": "#4F46E5", // Bilgi/iletişim
  "09": "#CA8A04", // Boş zaman
  "10": "#9333EA", // Eğitim
  "11": "#EA580C", // Lokanta/konaklama
  "12": "#0D9488", // Sigorta/finans
  "13": "#E11D48", // Kişisel bakım
};

export const ACCENT = "#1E3A8A"; // deep blue

/** Colour for any node code: divisions use the fixed map, deeper nodes
 *  inherit their division colour. */
export function colorForKod(kod: string): string {
  if (kod === "TOPLAM") return ACCENT;
  const bolum = kod.slice(0, 2);
  return DIVISION_COLORS[bolum] || ACCENT;
}

/** Distinct series colours for multi-select (up to 6). */
export const SERIES_PALETTE = [
  "#1E3A8A",
  "#0891B2",
  "#EA580C",
  "#059669",
  "#DB2777",
  "#CA8A04",
];
