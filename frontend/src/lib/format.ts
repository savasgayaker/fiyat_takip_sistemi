const nf2 = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const nf3 = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

export function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (decimals === 0) return nf0.format(v);
  if (decimals === 3) return nf3.format(v);
  return nf2.format(v);
}

/** Percentage with explicit sign and 2 decimals, e.g. +1,23% */
export function fmtPct(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "" : "";
  const s = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);
  return `%${sign}${s}`;
}

/** Signed points value, e.g. +0,55 */
export function fmtSigned(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${fmtNum(v, decimals)}`;
}

/** ISO yyyy-MM-dd -> dd.MM.yyyy */
export function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

/** ISO -> dd.MM (short) */
export function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

export function fmtPrice(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${fmtNum(v)} ₺`;
}
