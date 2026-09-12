import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Check, Save, Trash2, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import { ExportButtons } from "@/components/common/ExportButtons";
import { LoadingState } from "@/components/common/States";
import { IndexLineChart, LineSeries } from "@/components/charts/IndexLineChart";
import { getBaskets, getBasketSabit, getTuikBasket, getIndexMulti, getTree, saveBasketApi, deleteBasketApi } from "@/lib/api";
import { useApp, DEFAULT_BASKET_PRESET } from "@/context/AppContext";
import { tr } from "@/i18n/tr";
import { fmtNum, fmtPct, fmtSigned } from "@/lib/format";
import { SERIES_PALETTE, colorForKod } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  computeBasket,
  normalizeWeights,
  parseWeight,
  periodChange,
  sameWeights,
  scaleTo100,
  weightSum,
  type Pt,
} from "@/lib/basket";
import type { ExportTable } from "@/types";

const CUSTOM = tr.basket.custom; // "Özel"
const REFERENCE_COLOR = "#9CA3AF";
const DEBOUNCE_MS = 150;
const MAX_COMPARE = 3;

/** Value that follows `value` after `ms` of silence (≤150 ms for weight edits). */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

const nfInput = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 4, useGrouping: false });
const fmtInput = (v: number | undefined) => (v === undefined || v === 0 ? "0" : nfInput.format(v));

export default function Basket() {
  const { from, to, basketCustom, setBasketCustom, basketPreset, setBasketPreset } = useApp();
  const qc = useQueryClient();
  const basketsQ = useQuery({ queryKey: ["baskets"], queryFn: getBaskets });
  const sabitQ = useQuery({ queryKey: ["baskets-sabit"], queryFn: getBasketSabit });
  const tuikQ = useQuery({ queryKey: ["baskets-tuik"], queryFn: getTuikBasket });
  const treeQ = useQuery({ queryKey: ["tree"], queryFn: getTree });

  const divisions = useMemo(
    () => (treeQ.data || []).map((n) => ({ kod: n.kod, ad_tr: n.ad_tr })),
    [treeQ.data],
  );
  const kodlar = useMemo(() => divisions.map((d) => d.kod), [divisions]);

  // All division series once per range; every basket is a linear combination computed here.
  const multiQ = useQuery({
    queryKey: ["index-multi", kodlar.join(","), from, to],
    queryFn: () => getIndexMulti(kodlar, from, to),
    enabled: kodlar.length > 0 && !!from && !!to,
  });
  const seriesByKod = useMemo(() => {
    const m: Record<string, Pt[]> = {};
    for (const s of multiQ.data || []) m[s.kod] = s.series.map((p) => ({ tarih: p.tarih, endeks: p.endeks }));
    return m;
  }, [multiQ.data]);

  const presets = useMemo(() => basketsQ.data || {}, [basketsQ.data]);
  const presetNames = Object.keys(presets);
  const sabit = useMemo(() => new Set(sabitQ.data || []), [sabitQ.data]);
  const adOf = useMemo(() => Object.fromEntries(divisions.map((d) => [d.kod, d.ad_tr])), [divisions]);

  // Reference preset must exist; fall back to the default / first one.
  const refName = presets[basketPreset] ? basketPreset : presets[DEFAULT_BASKET_PRESET] ? DEFAULT_BASKET_PRESET : presetNames[0];
  const refRaw = useMemo(() => (refName ? presets[refName] : {}) || {}, [presets, refName]);
  // Boxes always show the preset scaled to 100 (TÜİK 2026 arrives as covered weights summing to ~93.5).
  const refWeights = useMemo(() => scaleTo100(refRaw), [refRaw]);
  const isTuikRef = refName === DEFAULT_BASKET_PRESET && !!tuikQ.data;

  // First visit: seed custom weights from the reference preset.
  useEffect(() => {
    if (refName && Object.keys(basketCustom).length === 0 && Object.keys(refWeights).length) {
      setBasketCustom({ ...refWeights });
    }
  }, [refName, refWeights, basketCustom, setBasketCustom]);

  const isCustom = Object.keys(basketCustom).length > 0 && !sameWeights(basketCustom, refWeights);
  const weightTitle = (kod: string): string | undefined => {
    if (!isTuikRef || !tuikQ.data) return undefined;
    const kaps = tuikQ.data.agirlik[kod];
    const tam = tuikQ.data.tam_agirlik[kod];
    if (kaps === undefined) return undefined;
    return `${tr.basket.coveredWeight} %${fmtNum(kaps)}; ${tr.basket.fullWeight} %${fmtNum(tam)}`;
  };
  const [selected, setSelected] = useState<string[]>([]);
  const [customActive, setCustomActive] = useState(false);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const flashRef = useRef<HTMLButtonElement>(null);

  // Initial compare selection: reference preset (+ Özel when unsaved edits survived a reload).
  useEffect(() => {
    if (selected.length === 0 && refName) {
      setSelected(isCustom ? [CUSTOM, refName] : [refName]);
      setCustomActive(isCustom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refName]);

  const activateCustom = () => {
    setCustomActive(true);
    setSelected((prev) => (prev.includes(CUSTOM) ? prev : [CUSTOM, ...prev].slice(0, MAX_COMPARE)));
    flashRef.current?.animate?.([{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 300 });
  };

  const onWeightChange = (kod: string, text: string) => {
    setEditing((e) => ({ ...e, [kod]: text }));
    setBasketCustom({ ...basketCustom, [kod]: parseWeight(text) });
    activateCustom();
  };
  const onWeightBlur = (kod: string) =>
    setEditing((e) => {
      const n = { ...e };
      delete n[kod];
      return n;
    });

  const loadPreset = (name: string) => {
    if (!presets[name]) return;
    setBasketPreset(name);
    setBasketCustom(scaleTo100(presets[name]));
    setEditing({});
    setCustomActive(false);
    setSelected((prev) => [name, ...prev.filter((n) => n !== name && n !== CUSTOM)].slice(0, MAX_COMPARE));
  };
  const resetToPreset = () => {
    setBasketCustom({ ...refWeights });
    setEditing({});
    setCustomActive(false);
    setSelected((prev) => {
      const rest = prev.filter((n) => n !== CUSTOM);
      return rest.includes(refName) ? rest : [refName, ...rest].slice(0, MAX_COMPARE);
    });
  };
  const normalize = () => {
    if (weightSum(basketCustom) === 0) return;
    setBasketCustom(normalizeWeights(basketCustom));
    setEditing({});
    activateCustom();
  };
  const toggle = (name: string) => {
    if (name === CUSTOM) setCustomActive(true);
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, name];
    });
  };

  const saveBasket = async () => {
    const name = newName.trim();
    if (!name) return;
    if (Math.abs(weightSum(basketCustom) - 100) >= 0.01) {
      toast.error(tr.basket.mustSum);
      return;
    }
    setSaving(true);
    try {
      const all = await saveBasketApi(name, basketCustom);
      qc.setQueryData(["baskets"], all);
      setNewName("");
      setBasketPreset(name);
      setCustomActive(false);
      setSelected((prev) => [name, ...prev.filter((n) => n !== name && n !== CUSTOM)].slice(0, MAX_COMPARE));
      toast.success(`"${name}" ${tr.basket.saved}`);
    } catch (e: any) {
      toast.error(`${tr.basket.saveFailed}: ${e?.response?.data?.detail || e?.message || ""}`);
    } finally {
      setSaving(false);
    }
  };
  const deleteBasket = async (name: string) => {
    try {
      const all = await deleteBasketApi(name);
      qc.setQueryData(["baskets"], all);
      setSelected((prev) => prev.filter((n) => n !== name));
      if (basketPreset === name) setBasketPreset(DEFAULT_BASKET_PRESET);
      toast.success(`"${name}" ${tr.basket.deleted}`);
    } catch (e: any) {
      toast.error(`${tr.basket.deleteFailed}: ${e?.response?.data?.detail || e?.message || ""}`);
    }
  };

  // ---- computation (browser only, debounced ≤150 ms)
  const debouncedCustom = useDebounced(basketCustom, DEBOUNCE_MS);
  const weightsOf = (name: string): Record<string, number> => (name === CUSTOM ? debouncedCustom : presets[name] || {});
  const calc = useMemo(() => {
    const out: Record<string, ReturnType<typeof computeBasket>> = {};
    const names = new Set([...selected, refName].filter(Boolean) as string[]);
    for (const n of names) out[n] = computeBasket(n === CUSTOM ? debouncedCustom : presets[n] || {}, seriesByKod);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, refName, debouncedCustom, presets, seriesByKod]);

  const rebase = (s: Pt[]): Pt[] => (s.length ? s.map((p) => ({ tarih: p.tarih, endeks: (p.endeks / s[0].endeks) * 100 })) : s);

  // While Özel is drawn, the reference preset is always the grey dashed line underneath (never a coloured line).
  const showReference = selected.includes(CUSTOM) && !!refName;
  const chartSeries = useMemo<LineSeries[]>(() => {
    const lines: LineSeries[] = [];
    if (showReference && calc[refName]?.series.length) {
      lines.push({ kod: `ref:${refName}`, ad_tr: `${refName} (${tr.basket.reference})`, color: REFERENCE_COLOR, dash: "6 4", width: 1.5, series: rebase(calc[refName].series) });
    }
    selected
      .filter((n) => calc[n]?.series.length && !(showReference && n === refName))
      .forEach((n, i) => lines.push({ kod: n, ad_tr: n, color: SERIES_PALETTE[i % SERIES_PALETTE.length], series: rebase(calc[n].series) }));
    return lines;
  }, [selected, calc, refName, showReference]);

  const primary = customActive && selected.includes(CUSTOM) ? CUSTOM : selected[0];
  const primaryCalc = primary ? calc[primary] : undefined;
  const primaryContrib = (primaryCalc?.contrib || [])
    .map((c) => ({ ...c, ad_tr: adOf[c.kod] || c.kod }))
    .sort((a, b) => Math.abs(b.katki_puan) - Math.abs(a.katki_puan));

  const customChange = calc[CUSTOM] ? periodChange(calc[CUSTOM].series) : null;
  const refChange = refName && calc[refName] ? periodChange(calc[refName].series) : null;
  const sum = weightSum(basketCustom);
  const sumOk = Math.abs(sum - 100) < 0.01;

  const exportTables: ExportTable[] = [
    {
      name: "Sepet Ağırlıkları",
      columns: ["Kod", "Bölüm", ...selected],
      rows: divisions.map((d) => [d.kod, d.ad_tr, ...selected.map((n) => weightsOf(n)[d.kod] ?? 0)]),
    },
    {
      name: `Katkılar — ${primary || ""}`,
      columns: ["Kod", "Bölüm", "Ağırlık", "Değişim %", "Katkı"],
      rows: primaryContrib.map((c) => [c.kod, c.ad_tr, c.agirlik, c.degisim, c.katki_puan]),
    },
  ];

  const loading = basketsQ.isLoading || treeQ.isLoading || sabitQ.isLoading;

  return (
    <div data-testid="page-basket">
      <PageHeader
        title={tr.basket.title}
        right={<ExportButtons screen="sepet" tables={exportTables} showPdf={false} />}
      />

      {loading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* editor */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{tr.basket.build}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">{tr.basket.presets}</div>
                <div className="flex flex-wrap gap-2">
                  {presetNames.map((n) => (
                    <span key={n} className="inline-flex items-center">
                      <Button
                        variant={n === refName ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => loadPreset(n)}
                        data-testid={`load-preset-${n}`}
                      >
                        {n}
                      </Button>
                      {!sabit.has(n) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => deleteBasket(n)}
                          title={`${n} — ${tr.basket.deleted}?`}
                          data-testid={`delete-saved-${n}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <div className="scrollbar-thin max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
                {divisions.map((d) => (
                  <div key={d.kod} className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: colorForKod(d.kod) }} />
                    <span className="flex-1 truncate text-xs" title={d.ad_tr}>
                      {d.ad_tr}
                    </span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={editing[d.kod] ?? fmtInput(basketCustom[d.kod])}
                      onChange={(e) => onWeightChange(d.kod, e.target.value)}
                      onBlur={() => onWeightBlur(d.kod)}
                      onFocus={(e) => e.target.select()}
                      title={weightTitle(d.kod)}
                      className={cn("h-7 w-20 text-right text-xs tabular", isCustom && (basketCustom[d.kod] || 0) !== (refWeights[d.kod] || 0) && "border-primary")}
                      data-testid={`weight-${d.kod}`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <div className="text-sm">
                  {tr.basket.weightSum}:{" "}
                  <span className={cn("font-bold tabular", sumOk ? "text-emerald-600" : "text-amber-600")} data-testid="weight-sum">
                    {fmtNum(sum)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button variant="secondary" size="sm" onClick={normalize} data-testid="normalize-button">
                    <RotateCcw className="h-3.5 w-3.5" /> {tr.common.normalize}
                  </Button>
                  <Button variant="outline" size="sm" onClick={resetToPreset} disabled={!isCustom} data-testid="reset-preset-button">
                    <Undo2 className="h-3.5 w-3.5" /> {tr.basket.resetToPreset} ({refName})
                  </Button>
                </div>
              </div>
              {!sumOk && <p className="text-xs text-amber-600">{tr.basket.mustSum}</p>}
              {isTuikRef && tuikQ.data && (
                <p className="text-[11px] text-muted-foreground" data-testid="tuik-note">
                  {tr.basket.tuikNote} ({tr.basket.coveredWeight} %{fmtNum(tuikQ.data.kapsanan_toplam, 1)})
                </p>
              )}
              {isCustom && (
                <p className="text-xs text-muted-foreground" data-testid="unsaved-hint">
                  {tr.basket.unsavedHint}
                </p>
              )}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="text-xs font-medium text-muted-foreground">{tr.basket.savedBaskets}</div>
                <div className="flex gap-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={tr.basket.saveName}
                    className="h-8 text-xs"
                    onKeyDown={(e) => e.key === "Enter" && saveBasket()}
                    data-testid="basket-name-input"
                  />
                  <Button size="sm" onClick={saveBasket} disabled={saving || !newName.trim()} data-testid="save-basket-button">
                    <Save className="h-3.5 w-3.5" /> {tr.basket.save}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {presetNames.filter((n) => !sabit.has(n)).length === 0 ? tr.basket.noneSaved : `config/sepetler.json: ${presetNames.filter((n) => !sabit.has(n)).join(", ")}`}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* compare + chart */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{tr.basket.compare}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex flex-wrap gap-2">
                  {[...presetNames, CUSTOM].map((n) => {
                    const on = selected.includes(n);
                    const isCustomTab = n === CUSTOM;
                    return (
                      <Button
                        key={n}
                        ref={isCustomTab ? flashRef : undefined}
                        variant={on ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggle(n)}
                        disabled={!on && selected.length >= MAX_COMPARE}
                        className={cn(isCustomTab && customActive && on && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
                        data-testid={`compare-${n}`}
                        data-active={isCustomTab && customActive ? "true" : undefined}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                        {n}
                      </Button>
                    );
                  })}
                </div>
                {selected.includes(CUSTOM) && customChange !== null && refName && refChange !== null && (
                  <div className="mb-2 text-sm tabular" data-testid="custom-vs-reference">
                    <span className="font-semibold">{CUSTOM} {fmtPct(customChange)}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span>{refName} {fmtPct(refChange)}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span className={cn("font-medium", customChange - refChange > 0 ? "text-red-600" : customChange - refChange < 0 ? "text-emerald-600" : "")}>
                      {tr.basket.diff} {fmtSigned(customChange - refChange)} {tr.basket.points}
                    </span>
                    {calc[CUSTOM] && calc[CUSTOM].kapsananPay < 99.99 && (
                      <span className="text-muted-foreground"> · {tr.basket.coveredShare} %{fmtNum(calc[CUSTOM].kapsananPay, 0)}</span>
                    )}
                  </div>
                )}
                {multiQ.isLoading ? (
                  <LoadingState />
                ) : chartSeries.length ? (
                  <IndexLineChart series={chartSeries} filename="sepet-karsilastirma" />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">{tr.common.empty}</p>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">{tr.basket.computedLocally}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {tr.basket.contributions} — {primary}
                  {primaryCalc && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground tabular">{fmtPct(primaryCalc.donemDegisim)}</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="scrollbar-thin overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bölüm</TableHead>
                      <TableHead className="text-right">{tr.common.weight}</TableHead>
                      <TableHead className="text-right">{tr.common.change}</TableHead>
                      <TableHead className="text-right">Katkı (puan)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {primaryContrib.map((c) => (
                      <TableRow key={c.kod} data-testid={`basket-contrib-${c.kod}`}>
                        <TableCell className="max-w-[220px] truncate">
                          <span className="mr-1 font-mono text-muted-foreground">{c.kod}</span>
                          {c.ad_tr}
                        </TableCell>
                        <TableCell className="text-right tabular">{fmtNum(c.agirlik)}</TableCell>
                        <TableCell className="text-right tabular">{fmtPct(c.degisim)}</TableCell>
                        <TableCell className="text-right tabular font-medium">{fmtSigned(c.katki_puan, 3)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
