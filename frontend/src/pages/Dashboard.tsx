import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingDown, Layers, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/common/PageHeader";
import { ExportButtons } from "@/components/common/ExportButtons";
import { IndexLineChart } from "@/components/charts/IndexLineChart";
import { ContribBar } from "@/components/charts/ContribBar";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/States";
import { getIndex, getContrib, getQuality } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { tr } from "@/i18n/tr";
import { ACCENT } from "@/lib/palette";
import { fmtNum, fmtPct, fmtDate } from "@/lib/format";
import type { ExportTable } from "@/types";

function StatCard({
  label,
  value,
  sub,
  positive,
  testid,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean | null;
  testid: string;
}) {
  const color =
    positive === true
      ? "text-emerald-600"
      : positive === false
        ? "text-red-600"
        : "text-foreground";
  return (
    <Card data-testid={testid}>
      <CardContent className="p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className={`mt-1 text-3xl font-bold tabular ${color}`}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { from, to, meta } = useApp();
  const [absolute, setAbsolute] = useState(false);

  const idxQ = useQuery({
    queryKey: ["index", "TOPLAM", from, to],
    queryFn: () => getIndex("TOPLAM", "TOPLAM", from, to),
    enabled: !!from && !!to,
  });
  const contribQ = useQuery({
    queryKey: ["contrib", from, to],
    queryFn: () => getContrib(from, to, "bolum"),
    enabled: !!from && !!to,
  });
  const qualityQ = useQuery({ queryKey: ["quality"], queryFn: () => getQuality(14) });

  const series = useMemo(() => idxQ.data?.series || [], [idxQ.data]);

  const stats = useMemo(() => {
    if (series.length < 2) return null;
    const last = series[series.length - 1].endeks;
    const prev = series[series.length - 2].endeks;
    const first = series[0].endeks;
    const daily = (last / prev - 1) * 100;
    const period = (last / first - 1) * 100;
    const w7 =
      series.length >= 8
        ? (last / series[series.length - 8].endeks - 1) * 100
        : period;
    return { last, daily, period, w7 };
  }, [series]);

  const chartSeries = useMemo(() => {
    if (!series.length) return [];
    const base = series[0].endeks;
    const data = absolute
      ? series
      : series.map((p) => ({ tarih: p.tarih, endeks: (p.endeks / base) * 100 }));
    return [
      { kod: "TOPLAM", ad_tr: tr.dashboard.mainChart, color: ACCENT, series: data },
    ];
  }, [series, absolute]);

  const carryCount = meta?.carry_count ?? 0;
  const liveCount = (meta?.class_count ?? 0) - carryCount;
  // Weight share of carried classes (Σ agirlik of carry_classes, percent of basket).
  const carryWeight = useMemo(
    () => (qualityQ.data?.carry_classes || []).reduce((a, c) => a + c.agirlik, 0),
    [qualityQ.data],
  );
  const weakClasses = qualityQ.data?.weak_classes || [];

  const exportTables: ExportTable[] = useMemo(() => {
    const t: ExportTable[] = [];
    if (stats) {
      t.push({
        name: "Özet",
        columns: ["Gösterge", "Değer"],
        rows: [
          ["Güncel endeks", fmtNum(stats.last)],
          ["Günlük değişim %", fmtNum(stats.daily)],
          ["Son 7 gün %", fmtNum(stats.w7)],
          ["Dönem değişimi %", fmtNum(stats.period)],
          ["Veri tarihi", fmtDate(meta?.data_date)],
        ],
      });
    }
    if (contribQ.data?.length) {
      t.push({
        name: "Bölüm Katkıları",
        columns: ["Kod", "Bölüm", "Ağırlık", "Değişim %", "Katkı (puan)"],
        rows: contribQ.data.map((c) => [
          c.kod,
          c.ad_tr,
          c.agirlik,
          c.degisim,
          c.katki_puan,
        ]),
      });
    }
    return t;
  }, [stats, contribQ.data, meta]);

  return (
    <div data-testid="page-dashboard">
      <PageHeader
        title={tr.dashboard.title}
        right={<ExportButtons screen="pano" tables={exportTables} />}
      >
        <p className="mt-1 text-sm text-muted-foreground">
          {tr.common.dataDate}: {fmtDate(meta?.data_date)}
        </p>
      </PageHeader>

      {idxQ.isLoading ? (
        <LoadingState />
      ) : idxQ.isError ? (
        <ErrorState onRetry={idxQ.refetch} />
      ) : !stats ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label={tr.dashboard.latestIndex}
              value={fmtNum(stats.last)}
              sub={`${tr.common.baseDay}: ${fmtDate(meta?.base_day)} = 100`}
              testid="stat-latest"
            />
            <StatCard
              label={tr.dashboard.dailyChange}
              value={fmtPct(stats.daily)}
              positive={stats.daily >= 0}
              testid="stat-daily"
            />
            <StatCard
              label={tr.dashboard.weeklyChange}
              value={fmtPct(stats.w7)}
              positive={stats.w7 >= 0}
              testid="stat-weekly"
            />
            <StatCard
              label={tr.dashboard.periodChange}
              value={fmtPct(stats.period)}
              sub={`${fmtDate(from)} – ${fmtDate(to)}`}
              positive={stats.period >= 0}
              testid="stat-period"
            />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">{tr.dashboard.mainChart}</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="abs" className="text-xs text-muted-foreground">
                  {absolute ? tr.dashboard.absoluteBase : tr.dashboard.baseAtStart}
                </Label>
                <Switch
                  id="abs"
                  checked={absolute}
                  onCheckedChange={setAbsolute}
                  data-testid="base-toggle"
                />
              </div>
            </CardHeader>
            <CardContent>
              <IndexLineChart series={chartSeries} filename="pano-toplam" />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {tr.dashboard.contributions}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contribQ.isLoading ? (
                  <LoadingState />
                ) : contribQ.data?.length ? (
                  <ContribBar
                    data={contribQ.data.map((c) => ({
                      kod: c.kod,
                      ad_tr: c.ad_tr,
                      katki_puan: c.katki_puan,
                      degisim: c.degisim,
                    }))}
                    filename="pano-katki"
                  />
                ) : (
                  <EmptyState />
                )}
              </CardContent>
            </Card>

            <Card data-testid="coverage-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{tr.dashboard.coverage}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">
                      {tr.dashboard.coverageWeight}
                    </span>
                    <span className="text-2xl font-bold tabular">
                      {fmtNum(meta?.coverage_weight)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${meta?.coverage_weight ?? 0}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Layers className="h-3.5 w-3.5" /> {tr.dashboard.liveClasses}
                    </div>
                    <div className="mt-1 text-xl font-bold tabular text-emerald-600">
                      {liveCount}
                    </div>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingDown className="h-3.5 w-3.5" />{" "}
                      {tr.dashboard.carryClasses}
                    </div>
                    <div className="mt-1 text-xl font-bold tabular text-amber-600">
                      {carryCount}
                      <span
                        className="ml-1 text-xs font-medium text-muted-foreground"
                        data-testid="carry-weight-share"
                      >
                        · %{fmtNum(carryWeight)}
                      </span>
                    </div>
                  </div>
                </div>
                {qualityQ.data?.carry_classes?.length ? (
                  <div className="text-xs text-muted-foreground">
                    {qualityQ.data.carry_classes.map((c) => (
                      <div key={c.kod} className="flex justify-between">
                        <span className="truncate">{c.ad_tr}</span>
                        <span className="tabular">{c.gun} gün</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {weakClasses.length ? (
                  <div
                    className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-700 dark:bg-amber-950/40"
                    data-testid="weak-representation"
                  >
                    <div
                      className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400"
                      title={tr.dashboard.weakReprHint}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" /> {tr.dashboard.weakRepr}
                    </div>
                    <div className="mt-1.5 space-y-1 text-muted-foreground">
                      {weakClasses.map((w) => (
                        <div
                          key={w.kod}
                          className="flex items-center justify-between gap-2"
                          data-testid={`weak-${w.kod}`}
                        >
                          <span className="truncate">
                            <span className="mr-1 font-mono text-[10px]">{w.kod}</span>
                            {w.ad_tr}
                          </span>
                          <span className="shrink-0 tabular">
                            %{fmtNum(w.agirlik)} · {w.kalem} {tr.dashboard.items}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 text-[10px] text-muted-foreground">
                      {tr.dashboard.weakReprHint}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
