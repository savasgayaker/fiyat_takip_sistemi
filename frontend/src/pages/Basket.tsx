import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, Check, Save, Trash2 } from "lucide-react";
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
import { IndexLineChart } from "@/components/charts/IndexLineChart";
import { getBaskets, getTree, computeBasket } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { tr } from "@/i18n/tr";
import { fmtNum, fmtPct, fmtSigned } from "@/lib/format";
import { SERIES_PALETTE, colorForKod } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { BasketResult, ExportTable } from "@/types";

const CUSTOM = "Özel";

export default function Basket() {
  const { from, to } = useApp();
  const basketsQ = useQuery({ queryKey: ["baskets"], queryFn: getBaskets });
  const treeQ = useQuery({ queryKey: ["tree"], queryFn: getTree });

  const divisions = useMemo(
    () => (treeQ.data || []).map((n) => ({ kod: n.kod, ad_tr: n.ad_tr })),
    [treeQ.data],
  );

  const [custom, setCustom] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string[]>(["TÜİK 2026"]);
  const [computed, setComputed] = useState<Record<string, BasketResult>>({});
  const [computing, setComputing] = useState(false);
  const [saved, setSaved] = useState<Record<string, Record<string, number>>>(
    () => {
      try {
        return JSON.parse(localStorage.getItem("savedBaskets") || "{}");
      } catch {
        return {};
      }
    },
  );
  const [newName, setNewName] = useState("");

  // Initialise custom weights from the TÜİK 2026 preset once loaded.
  useEffect(() => {
    if (basketsQ.data && Object.keys(custom).length === 0) {
      setCustom({ ...basketsQ.data["TÜİK 2026"] });
    }
  }, [basketsQ.data, custom]);

  const presetNames = basketsQ.data ? Object.keys(basketsQ.data) : [];
  const sum = Object.values(custom).reduce((a, b) => a + (Number(b) || 0), 0);

  const basketWeights = (name: string): Record<string, number> =>
    name === CUSTOM ? custom : basketsQ.data?.[name] || saved[name] || {};

  const persistSaved = (next: Record<string, Record<string, number>>) => {
    setSaved(next);
    localStorage.setItem("savedBaskets", JSON.stringify(next));
  };
  const saveBasket = () => {
    const name = newName.trim();
    if (!name) return;
    if (Math.abs(sum - 100) >= 0.01) {
      toast.error(tr.basket.mustSum);
      return;
    }
    persistSaved({ ...saved, [name]: { ...custom } });
    setNewName("");
    toast.success(`"${name}" kaydedildi`);
  };
  const deleteBasket = (name: string) => {
    const next = { ...saved };
    delete next[name];
    persistSaved(next);
    setSelected((prev) => prev.filter((n) => n !== name));
  };

  const toggle = (name: string) => {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= 3) return prev;
      return [...prev, name];
    });
  };

  const loadPreset = (name: string) => {
    if (basketsQ.data?.[name]) setCustom({ ...basketsQ.data[name] });
  };

  const normalize = () => {
    if (sum === 0) return;
    const next: Record<string, number> = {};
    for (const [k, v] of Object.entries(custom)) {
      next[k] = Math.round(((Number(v) || 0) / sum) * 10000) / 100;
    }
    setCustom(next);
  };

  // Compute all selected baskets whenever selection / range / custom changes.
  useEffect(() => {
    if (!basketsQ.data || !from || !to) return;
    let cancelled = false;
    setComputing(true);
    Promise.all(
      selected.map((name) =>
        computeBasket(basketWeights(name), from, to).then((r) => [name, r] as const),
      ),
    )
      .then((pairs) => {
        if (cancelled) return;
        const map: Record<string, BasketResult> = {};
        for (const [n, r] of pairs) map[n] = r;
        setComputed(map);
      })
      .finally(() => !cancelled && setComputing(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, from, to, custom, basketsQ.data]);

  // Rebase each basket to 100 at range start for fair comparison.
  const chartSeries = useMemo(() => {
    return selected
      .filter((n) => computed[n]?.series?.length)
      .map((n, i) => {
        const s = computed[n].series;
        const base = s[0].endeks;
        return {
          kod: n,
          ad_tr: n,
          color: SERIES_PALETTE[i % SERIES_PALETTE.length],
          series: s.map((p) => ({ tarih: p.tarih, endeks: (p.endeks / base) * 100 })),
        };
      });
  }, [selected, computed]);

  const primary = selected[0];
  const primaryContrib = computed[primary]?.contrib || [];

  const exportTables: ExportTable[] = [
    {
      name: "Sepet Ağırlıkları",
      columns: ["Kod", "Bölüm", ...selected],
      rows: divisions.map((d) => [
        d.kod,
        d.ad_tr,
        ...selected.map((n) => basketWeights(n)[d.kod] ?? 0),
      ]),
    },
    {
      name: "Katkılar",
      columns: ["Kod", "Bölüm", "Ağırlık", "Değişim %", "Katkı"],
      rows: primaryContrib.map((c) => [c.kod, c.ad_tr, c.agirlik, c.degisim, c.katki_puan]),
    },
  ];

  return (
    <div data-testid="page-basket">
      <PageHeader
        title={tr.basket.title}
        right={<ExportButtons screen="sepet" tables={exportTables} showPdf={false} />}
      />

      {basketsQ.isLoading || treeQ.isLoading ? (
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
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  {tr.basket.presets}
                </div>
                <div className="flex flex-wrap gap-2">
                  {presetNames.map((n) => (
                    <Button
                      key={n}
                      variant="outline"
                      size="sm"
                      onClick={() => loadPreset(n)}
                      data-testid={`load-preset-${n}`}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="scrollbar-thin max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
                {divisions.map((d) => (
                  <div key={d.kod} className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{ background: colorForKod(d.kod) }}
                    />
                    <span className="flex-1 truncate text-xs" title={d.ad_tr}>
                      {d.ad_tr}
                    </span>
                    <Input
                      type="number"
                      value={custom[d.kod] ?? 0}
                      onChange={(e) =>
                        setCustom((c) => ({ ...c, [d.kod]: Number(e.target.value) }))
                      }
                      className="h-7 w-20 text-right text-xs tabular"
                      data-testid={`weight-${d.kod}`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <div className="text-sm">
                  {tr.basket.weightSum}:{" "}
                  <span
                    className={cn(
                      "font-bold tabular",
                      Math.abs(sum - 100) < 0.01 ? "text-emerald-600" : "text-amber-600",
                    )}
                    data-testid="weight-sum"
                  >
                    {fmtNum(sum)}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={normalize}
                  data-testid="normalize-button"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> {tr.common.normalize}
                </Button>
              </div>
              {Math.abs(sum - 100) >= 0.01 && (
                <p className="text-xs text-amber-600">{tr.basket.mustSum}</p>
              )}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="text-xs font-medium text-muted-foreground">
                  {tr.basket.savedBaskets}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={tr.basket.saveName}
                    className="h-8 text-xs"
                    data-testid="basket-name-input"
                  />
                  <Button
                    size="sm"
                    onClick={saveBasket}
                    data-testid="save-basket-button"
                  >
                    <Save className="h-3.5 w-3.5" /> {tr.basket.save}
                  </Button>
                </div>
                {Object.keys(saved).length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {tr.basket.noneSaved}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {Object.keys(saved).map((n) => (
                      <div
                        key={n}
                        className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-xs"
                        data-testid={`saved-basket-${n}`}
                      >
                        <span className="truncate">{n}</span>
                        <span className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => setCustom({ ...saved[n] })}
                            data-testid={`load-saved-${n}`}
                          >
                            {tr.basket.load}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => deleteBasket(n)}
                            data-testid={`delete-saved-${n}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
                <div className="mb-4 flex flex-wrap gap-2">
                  {[...presetNames, ...Object.keys(saved), CUSTOM].map((n) => {
                    const on = selected.includes(n);
                    return (
                      <Button
                        key={n}
                        variant={on ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggle(n)}
                        disabled={!on && selected.length >= 3}
                        data-testid={`compare-${n}`}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                        {n}
                      </Button>
                    );
                  })}
                </div>
                {computing ? (
                  <LoadingState />
                ) : chartSeries.length ? (
                  <IndexLineChart series={chartSeries} filename="sepet-karsilastirma" />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {tr.common.empty}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {tr.basket.contributions} — {primary}
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
                          <span className="mr-1 font-mono text-muted-foreground">
                            {c.kod}
                          </span>
                          {c.ad_tr}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {fmtNum(c.agirlik)}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {fmtPct(c.degisim)}
                        </TableCell>
                        <TableCell className="text-right tabular font-medium">
                          {fmtSigned(c.katki_puan, 3)}
                        </TableCell>
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
