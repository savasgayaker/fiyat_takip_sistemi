import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { ExportButtons } from "@/components/common/ExportButtons";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/States";
import { IndexLineChart } from "@/components/charts/IndexLineChart";
import { Sparkline } from "@/components/charts/Sparkline";
import { TreeView } from "@/components/breakdown/TreeView";
import { DivisionHeatmap } from "@/components/breakdown/DivisionHeatmap";
import {
  getTree,
  getIndexMulti,
  getSources,
  getItems,
  getItem,
  getIndex,
} from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { tr } from "@/i18n/tr";
import { fmtNum, fmtPct, fmtPrice, fmtDate } from "@/lib/format";
import { SERIES_PALETTE } from "@/lib/palette";
import { cn } from "@/lib/utils";
import type { ExportTable, Item } from "@/types";

const MAX = 6;

export default function Breakdown() {
  const { from, to } = useApp();
  const [params] = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [warn, setWarn] = useState(false);
  const [sortKey, setSortKey] = useState("urun_adi");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [activeItem, setActiveItem] = useState<string | null>(null);

  const treeQ = useQuery({ queryKey: ["tree"], queryFn: getTree });

  // Preselect from ?kod= (search navigation).
  useEffect(() => {
    const kod = params.get("kod");
    if (kod) setSelected([kod]);
  }, [params]);

  const primary = selected[0];

  const multiQ = useQuery({
    queryKey: ["multi", selected, from, to],
    queryFn: () => getIndexMulti(selected, from, to),
    enabled: selected.length > 0 && !!from && !!to,
  });
  const primaryQ = useQuery({
    queryKey: ["index-primary", primary, from, to],
    queryFn: () => getIndex("", primary, from, to),
    enabled: !!primary && !!from && !!to,
  });
  const sourcesQ = useQuery({
    queryKey: ["sources", primary, from, to],
    queryFn: () => getSources(primary, from, to),
    enabled: !!primary && !!from && !!to,
  });
  const sort = sortDir === "desc" ? `-${sortKey}` : sortKey;
  const itemsQ = useQuery({
    queryKey: ["items", primary, from, to, sort],
    queryFn: () => getItems(primary, from, to, 1, sort),
    enabled: !!primary && !!from && !!to,
  });
  const itemQ = useQuery({
    queryKey: ["item", activeItem, from, to],
    queryFn: () => getItem(activeItem!, from, to),
    enabled: !!activeItem && !!from && !!to,
  });

  const toggle = (kod: string) => {
    setSelected((prev) => {
      if (prev.includes(kod)) return prev.filter((k) => k !== kod);
      if (prev.length >= MAX) {
        setWarn(true);
        setTimeout(() => setWarn(false), 2500);
        return prev;
      }
      return [...prev, kod];
    });
  };

  const chartSeries = useMemo(
    () =>
      (multiQ.data || []).map((s, i) => ({
        kod: s.kod,
        ad_tr: s.ad_tr,
        color: SERIES_PALETTE[i % SERIES_PALETTE.length],
        series: s.series.map((p) => ({ tarih: p.tarih, endeks: p.endeks })),
      })),
    [multiQ.data],
  );

  const stats = useMemo(() => {
    const s = primaryQ.data?.series;
    if (!s || s.length < 2) return null;
    const period = (s[s.length - 1].endeks / s[0].endeks - 1) * 100;
    const durum = s[s.length - 1].durum || "FRESH";
    const items = s[s.length - 1].eslesen_kalem ?? 0;
    return {
      period,
      durum,
      items,
      weight: primaryQ.data?.agirlik,
      ad: primaryQ.data?.ad_tr,
    };
  }, [primaryQ.data]);

  const headerCell = (key: string, label: string, align = "left") => (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => {
          if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          else {
            setSortKey(key);
            setSortDir("asc");
          }
        }}
        data-testid={`sort-${key}`}
      >
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </TableHead>
  );

  const exportTables: ExportTable[] = [];
  if (multiQ.data?.length) {
    exportTables.push({
      name: "Seçili Seriler",
      columns: ["Kod", "Ad", "Ağırlık", "Son Endeks"],
      rows: multiQ.data.map((s) => [
        s.kod,
        s.ad_tr,
        s.agirlik,
        s.series[s.series.length - 1]?.endeks ?? 0,
      ]),
    });
  }
  if (itemsQ.data?.items?.length) {
    exportTables.push({
      name: "Kalemler",
      columns: ["Ürün", "Kaynak", "Kısım", "Son Fiyat", "Değişim %", "Gün"],
      rows: itemsQ.data.items.map((it: Item) => [
        it.urun_adi,
        it.kaynak,
        it.kisim_no,
        it.son_fiyat,
        it.degisim,
        it.gun,
      ]),
    });
  }

  return (
    <div data-testid="page-breakdown">
      <PageHeader
        title={tr.breakdown.title}
        right={
          selected.length > 0 && (
            <ExportButtons screen="kirilim" tables={exportTables} showPdf={false} />
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* tree */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              {tr.breakdown.tree}
              <Badge variant="secondary" data-testid="selected-count">
                {selected.length}/{MAX}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="scrollbar-thin max-h-[640px] overflow-y-auto">
            {treeQ.isLoading ? (
              <LoadingState />
            ) : treeQ.isError ? (
              <ErrorState onRetry={treeQ.refetch} />
            ) : (
              <>
                {warn && (
                  <p className="mb-2 text-xs text-amber-600" data-testid="max-warn">
                    {tr.breakdown.maxSeries}
                  </p>
                )}
                <TreeView
                  nodes={treeQ.data || []}
                  selected={selected}
                  onToggle={toggle}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* detail */}
        <div className="space-y-6 lg:col-span-3">
          {!primary ? (
            <Card>
              <CardContent className="py-16">
                <EmptyState label={tr.breakdown.selectNode} />
              </CardContent>
            </Card>
          ) : (
            <>
              {/* stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatMini label={tr.common.weight} value={`${fmtNum(stats?.weight)}%`} />
                <StatMini label={tr.common.itemCount} value={String(stats?.items ?? "—")} />
                <StatMini
                  label={tr.common.change}
                  value={fmtPct(stats?.period)}
                  positive={stats ? stats.period >= 0 : null}
                />
                <StatMini
                  label={tr.common.status}
                  value={(tr.durum as any)[stats?.durum || "FRESH"]}
                />
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{primaryQ.data?.ad_tr}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="chart">
                    <TabsList data-testid="breakdown-tabs">
                      <TabsTrigger value="chart" data-testid="tab-chart">
                        {tr.breakdown.tabChart}
                      </TabsTrigger>
                      <TabsTrigger value="sources" data-testid="tab-sources">
                        {tr.breakdown.tabSources}
                      </TabsTrigger>
                      <TabsTrigger value="items" data-testid="tab-items">
                        {tr.breakdown.tabItems}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="chart" className="pt-4">
                      {multiQ.isLoading ? (
                        <LoadingState />
                      ) : chartSeries.length ? (
                        <IndexLineChart series={chartSeries} filename="kirilim" />
                      ) : (
                        <EmptyState />
                      )}
                    </TabsContent>

                    <TabsContent value="sources" className="pt-4">
                      {sourcesQ.isLoading ? (
                        <LoadingState />
                      ) : sourcesQ.data?.length ? (
                        <IndexLineChart
                          filename="kirilim-kaynak"
                          series={sourcesQ.data.map((s, i) => ({
                            kod: s.kaynak,
                            ad_tr: `${s.kaynak} (${s.kalem_sayisi})`,
                            color: SERIES_PALETTE[i % SERIES_PALETTE.length],
                            series: s.series,
                          }))}
                        />
                      ) : (
                        <EmptyState />
                      )}
                    </TabsContent>

                    <TabsContent value="items" className="pt-4">
                      {itemsQ.isLoading ? (
                        <LoadingState />
                      ) : itemsQ.data?.items?.length ? (
                        <div className="scrollbar-thin overflow-x-auto">
                          <div className="mb-2 text-xs text-muted-foreground">
                            {tr.common.total}: {itemsQ.data.total}
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {headerCell("urun_adi", tr.breakdown.product)}
                                {headerCell("kaynak", tr.common.source)}
                                {headerCell("son_fiyat", tr.breakdown.lastPrice, "right")}
                                {headerCell("degisim", tr.common.change, "right")}
                                {headerCell("gun", tr.breakdown.days, "right")}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {itemsQ.data.items.map((it: Item) => (
                                <TableRow
                                  key={it.kimlik}
                                  className={cn(
                                    "cursor-pointer",
                                    activeItem === it.kimlik && "bg-accent",
                                  )}
                                  onClick={() => setActiveItem(it.kimlik)}
                                  data-testid={`item-row-${it.kimlik}`}
                                >
                                  <TableCell className="max-w-[200px] truncate">
                                    {it.urun_adi}
                                  </TableCell>
                                  <TableCell>{it.kaynak}</TableCell>
                                  <TableCell className="text-right tabular">
                                    {fmtPrice(it.son_fiyat)}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-right tabular",
                                      it.degisim >= 0 ? "text-emerald-600" : "text-red-600",
                                    )}
                                  >
                                    {fmtPct(it.degisim)}
                                  </TableCell>
                                  <TableCell className="text-right tabular">
                                    {it.gun}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>

                          {activeItem && itemQ.data?.series?.length ? (
                            <div
                              className="mt-4 rounded-md border border-border p-4"
                              data-testid="item-sparkline"
                            >
                              <div className="mb-2 flex items-center justify-between text-sm">
                                <span className="font-medium">
                                  {itemQ.data.urun_adi} · {itemQ.data.kaynak}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {tr.breakdown.itemSparkline} · {fmtDate(from)} –{" "}
                                  {fmtDate(to)}
                                </span>
                              </div>
                              <Sparkline data={itemQ.data.series} height={64} />
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <EmptyState />
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {treeQ.data && treeQ.data.length > 0 && (
        <div className="mt-6">
          <DivisionHeatmap divisions={treeQ.data} />
        </div>
      )}
    </div>
  );
}

function StatMini({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean | null;
}) {
  const color =
    positive === true
      ? "text-emerald-600"
      : positive === false
        ? "text-red-600"
        : "text-foreground";
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular ${color}`}>{value}</div>
    </div>
  );
}
