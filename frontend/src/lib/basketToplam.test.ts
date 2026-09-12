import { computeBasket, scaleTo100 } from "./basket";

// tests/sepet_toplam.json: covered division weights + stored division series + stored TOPLAM (copy DB).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fx = require("../../../tests/sepet_toplam.json");

describe("TÜİK 2026 sepeti = Pano TOPLAM", () => {
  test("kapsanan bölüm ağırlıklarıyla doğrusal birleşim TOPLAM serisini 1e-9 içinde verir", () => {
    const r = computeBasket(fx.agirlik, fx.seriler);
    expect(r.series.length).toBe(fx.toplam.length);
    r.series.forEach((p: { tarih: string; endeks: number }, i: number) => {
      expect(p.tarih).toBe(fx.toplam[i].tarih);
      expect(Math.abs(p.endeks - fx.toplam[i].endeks)).toBeLessThan(1e-9);
    });
  });

  test("100'e ölçeklenmiş kutular aynı seriyi verir (yuvarlama yok)", () => {
    const a = computeBasket(fx.agirlik, fx.seriler);
    const b = computeBasket(scaleTo100(fx.agirlik), fx.seriler);
    a.series.forEach((p: { endeks: number }, i: number) => expect(Math.abs(p.endeks - b.series[i].endeks)).toBeLessThan(1e-9));
    const sum = Object.values(scaleTo100(fx.agirlik) as Record<string, number>).reduce((x, y) => x + y, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(1e-9);
  });
});
