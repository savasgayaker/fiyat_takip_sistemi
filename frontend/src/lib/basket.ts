/**
 * Sepet hesabı — frontend'de, saf fonksiyonlar. Arka uca istek gitmez.
 *
 *   I_S(t) = Σ_k w_k I_k(t) / Σ_k w_k          (ağırlıklar dönem boyunca sabit, tek düzey)
 *   π(t1,t2) = I(t2)/I(t1) − 1
 *   katkı_k  = 100 · w_k (I_k(t2) − I_k(t1)) / Σ_k w_k I_k(t1)   (Σ katkı = π, puan)
 *
 * Serisi olmayan (kapsanmayan) kod paydadan düşer; kapsanan pay `kapsananPay` ile döner.
 * Aynı formüller Python'da fiyat_takip.endeks.katki içinde; tests/sepet_capraz.json ile çapraz test edilir.
 */

export interface Pt {
  tarih: string;
  endeks: number;
}

export interface BasketContribRow {
  kod: string;
  agirlik: number;
  degisim: number;
  katki_puan: number;
}

export interface BasketCalc {
  series: Pt[];
  contrib: BasketContribRow[];
  /** Σ w (serisi olan) / Σ w (tümü) · 100 */
  kapsananPay: number;
  /** π(ilk, son) · 100 */
  donemDegisim: number;
}

/** Ağırlık kutusundaki metni sayıya çevirir: "12,5" ve "12.5" ikisi de 12.5; boş/geçersiz → 0. */
export function parseWeight(text: string | number | null | undefined): number {
  if (typeof text === "number") return Number.isFinite(text) && text >= 0 ? text : 0;
  const s = String(text ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // binlik nokta
    .replace(",", ".");
  const v = Number(s);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

export function weightSum(weights: Record<string, number>): number {
  return Object.values(weights).reduce((a, b) => a + (Number(b) || 0), 0);
}

/** Toplamı 100'e ölçekler (2 ondalık). */
export function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const sum = weightSum(weights);
  if (sum === 0) return { ...weights };
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) out[k] = Math.round(((Number(v) || 0) / sum) * 10000) / 100;
  return out;
}

export function sameWeights(a: Record<string, number>, b: Record<string, number>, eps = 1e-9): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (Math.abs((a[k] || 0) - (b[k] || 0)) > eps) return false;
  return true;
}

export function periodChange(series: Pt[]): number {
  if (series.length < 2 || !series[0].endeks) return 0;
  return 100 * (series[series.length - 1].endeks / series[0].endeks - 1);
}

/** Tarih üzerinden hizalar (konum indeksi değil): ortak tarihlerin kesişimi, sıralı. */
export function computeBasket(
  weights: Record<string, number>,
  seriesByKod: Record<string, Pt[]>,
): BasketCalc {
  const member = Object.entries(weights)
    .filter(([k, w]) => (Number(w) || 0) > 0 && seriesByKod[k]?.length)
    .map(([k, w]) => ({ kod: k, w: Number(w), map: new Map(seriesByKod[k].map((p) => [p.tarih, p.endeks])) }));
  const totalAll = weightSum(weights);
  const totalW = member.reduce((a, m) => a + m.w, 0);
  const empty: BasketCalc = { series: [], contrib: [], kapsananPay: totalAll ? (totalW / totalAll) * 100 : 0, donemDegisim: 0 };
  if (!member.length || totalW === 0) return empty;
  let dates: Set<string> | null = null;
  for (const m of member) {
    const d = new Set(m.map.keys());
    dates = dates ? new Set([...dates].filter((t) => d.has(t))) : d;
  }
  const tarihler = [...(dates || [])].sort();
  const series: Pt[] = tarihler.map((t) => ({
    tarih: t,
    endeks: member.reduce((a, m) => a + m.w * (m.map.get(t) as number), 0) / totalW,
  }));
  if (tarihler.length < 2) return { ...empty, series };
  const t1 = tarihler[0];
  const t2 = tarihler[tarihler.length - 1];
  const payda = member.reduce((a, m) => a + m.w * (m.map.get(t1) as number), 0);
  const contrib: BasketContribRow[] = member.map((m) => {
    const i1 = m.map.get(t1) as number;
    const i2 = m.map.get(t2) as number;
    return { kod: m.kod, agirlik: m.w, degisim: 100 * (i2 / i1 - 1), katki_puan: (100 * m.w * (i2 - i1)) / payda };
  });
  return { series, contrib, kapsananPay: (totalW / totalAll) * 100, donemDegisim: periodChange(series) };
}
