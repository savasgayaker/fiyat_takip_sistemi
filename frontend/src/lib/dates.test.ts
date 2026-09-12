import { clampRange, presetRange, presetRangeRaw } from "./dates";

describe("dönem seçici — baz günü kuralı", () => {
  const base = "2026-08-17";
  const data = "2026-09-11";

  test("son30 baz gününden önce başlar; kırpılır ve ham pencere bilinir", () => {
    const raw = presetRangeRaw("son30", data, base);
    expect(raw.from).toBe("2026-08-13");
    const r = presetRange("son30", data, base);
    expect(r).toEqual({ from: base, to: data });
  });

  test("son7 bazdan sonra: dokunulmaz", () => {
    expect(presetRange("son7", data, base)).toEqual({ from: "2026-09-05", to: data });
  });

  test("tuikAy ve ayBasi de aynı kurala tabi", () => {
    expect(presetRange("tuikAy", data, base).from).toBe(base);
    expect(presetRange("ayBasi", data, base)).toEqual({ from: "2026-09-01", to: data });
  });

  test("clampRange: özel aralık bazdan önceyse çekilir, bitiş veri tarihini aşamaz", () => {
    expect(clampRange({ from: "2026-08-01", to: "2026-09-30" }, base, data)).toEqual({ from: base, to: data, clamped: true });
    expect(clampRange({ from: "2026-08-20", to: "2026-09-01" }, base, data)).toEqual({ from: "2026-08-20", to: "2026-09-01", clamped: false });
    // bitiş bazdan önceyse boş pencere yerine tek gün (baz)
    expect(clampRange({ from: "2026-08-01", to: "2026-08-10" }, base, data)).toEqual({ from: "2026-08-10", to: "2026-08-10", clamped: true });
  });
});
