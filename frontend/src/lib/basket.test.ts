import { computeBasket, normalizeWeights, parseWeight, periodChange, weightSum } from "./basket";

// Aynı fikstür Python tarafında (backend/tests/test_basket_capraz.py) fiyat_takip.endeks.katki ile doğrulanır.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const capraz = require("../../../tests/sepet_capraz.json");

describe("basket.ts — sepet hesabı (frontend)", () => {
  const seriesByKod: Record<string, { tarih: string; endeks: number }[]> = {};
  for (const [kod, vals] of Object.entries(capraz.seriler as Record<string, number[]>)) {
    seriesByKod[kod] = vals.map((v, i) => ({ tarih: capraz.tarihler[i], endeks: v }));
  }

  test("Python katki modülüyle aynı seri, katkı ve kapsanan pay (1e-9)", () => {
    const r = computeBasket(capraz.agirlik, seriesByKod);
    expect(r.series.length).toBe(capraz.beklenen.series.length);
    r.series.forEach((p, i) => {
      expect(p.tarih).toBe(capraz.beklenen.series[i].tarih);
      expect(Math.abs(p.endeks - capraz.beklenen.series[i].endeks)).toBeLessThan(1e-9);
    });
    const beklenen = new Map((capraz.beklenen.contrib as any[]).map((c) => [c.kod, c]));
    expect(new Set(r.contrib.map((c) => c.kod))).toEqual(new Set(beklenen.keys()));
    for (const c of r.contrib) {
      const b = beklenen.get(c.kod)!;
      expect(Math.abs(c.degisim - b.degisim)).toBeLessThan(1e-9);
      expect(Math.abs(c.katki_puan - b.katki_puan)).toBeLessThan(1e-9);
    }
    expect(Math.abs(r.kapsananPay - capraz.beklenen.kapsanan_pay)).toBeLessThan(1e-9);
    expect(Math.abs(r.donemDegisim - capraz.beklenen.donem_degisim)).toBeLessThan(1e-9);
  });

  test("katkılar toplamı = dönem değişimi", () => {
    const r = computeBasket(capraz.agirlik, seriesByKod);
    const sum = r.contrib.reduce((a, c) => a + c.katki_puan, 0);
    expect(Math.abs(sum - periodChange(r.series))).toBeLessThan(1e-9);
  });

  test("tarih üzerinden hizalama: eksik gün kesişimden düşer", () => {
    const s = { ...seriesByKod, "01": seriesByKod["01"].filter((p) => p.tarih !== "2026-08-19") };
    const r = computeBasket({ "01": 50, "04": 50 }, s);
    expect(r.series.map((p) => p.tarih)).toEqual(["2026-08-17", "2026-08-18", "2026-08-20", "2026-08-21"]);
  });

  test("ağırlık değişimi eğimi değiştirir, baz gününde her sepet 100", () => {
    const a = computeBasket({ "01": 100 }, seriesByKod);
    const b = computeBasket({ "01": 20, "07": 80 }, seriesByKod);
    expect(a.series[0].endeks).toBeCloseTo(100, 9);
    expect(b.series[0].endeks).toBeCloseTo(100, 9);
    expect(a.donemDegisim).not.toBeCloseTo(b.donemDegisim, 6);
  });

  test("parseWeight: virgül ve nokta ondalık, geçersiz → 0", () => {
    expect(parseWeight("12,5")).toBe(12.5);
    expect(parseWeight("12.5")).toBe(12.5);
    expect(parseWeight(" 7 ")).toBe(7);
    expect(parseWeight("1.234,5")).toBe(1234.5);
    expect(parseWeight("")).toBe(0);
    expect(parseWeight("abc")).toBe(0);
    expect(parseWeight("-3")).toBe(0);
  });

  test("normalizeWeights toplamı 100 yapar", () => {
    const n = normalizeWeights({ "01": 1, "02": 3 });
    expect(weightSum(n)).toBeCloseTo(100, 6);
    expect(n["02"]).toBe(75);
  });
});
