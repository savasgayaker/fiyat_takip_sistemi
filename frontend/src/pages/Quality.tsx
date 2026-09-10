import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { LoadingState, ErrorState } from "@/components/common/States";
import { HoverTip } from "@/components/common/HoverTip";
import { getQuality } from "@/lib/api";
import { tr } from "@/i18n/tr";
import { fmtDateShort, fmtDate, fmtNum } from "@/lib/format";
import { colorForKod } from "@/lib/palette";
import type { ExportTable, RcCode } from "@/types";

export default function Quality() {
  const q = useQuery({ queryKey: ["quality"], queryFn: () => getQuality(14) });

  const dates = useMemo(
    () => q.data?.sections?.[0]?.days.map((d) => d.tarih) || [],
    [q.data],
  );
  // rc -> {ad, aciklama, renk} from config/rc_kodlari.json; nothing hard-coded here.
  const rcMap = useMemo(() => {
    const m = new Map<number, RcCode>();
    (q.data?.rc_kodlari || []).forEach((r) => m.set(r.rc, r));
    return m;
  }, [q.data]);

  const exportTables: ExportTable[] = useMemo(() => {
    if (!q.data) return [];
    return [
      {
        name: "rc Izgarasi",
        columns: ["Kısım", "Ad", ...dates.map(fmtDateShort)],
        rows: q.data.sections.map((s) => [
          s.kisim_no,
          s.ad,
          ...s.days.map((d) => d.rc),
        ]),
      },
      {
        name: "Devreden Sınıflar",
        columns: ["Kod", "Sınıf", "Ağırlık", "Gün"],
        rows: q.data.carry_classes.map((c) => [c.kod, c.ad_tr, c.agirlik, c.gun]),
      },
      {
        name: "Dışlamalar",
        columns: ["Neden", "Satır"],
        rows: q.data.exclusions.map((e) => [e.neden, e.satir]),
      },
    ];
  }, [q.data, dates]);

  return (
    <div data-testid="page-quality">
      <PageHeader
        title={tr.quality.title}
        right={<ExportButtons screen="kalite" tables={exportTables} />}
      >
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{tr.quality.rcLegend}:</span>
          {(q.data?.rc_kodlari || []).map((r) => (
            <span key={r.rc} className="inline-flex items-center gap-1" data-testid={`rc-legend-${r.rc}`}>
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: r.renk }} />
              <span className="font-mono">{r.rc}</span> {r.ad}
            </span>
          ))}
        </p>
      </PageHeader>

      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{tr.quality.grid}</CardTitle>
            </CardHeader>
            <CardContent className="scrollbar-thin overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="mb-1 flex items-center gap-1 pl-[232px] text-[10px] text-muted-foreground">
                  {dates.map((d) => (
                    <div key={d} className="w-6 text-center">
                      {fmtDateShort(d).split(".")[0]}
                    </div>
                  ))}
                </div>
                {q.data!.sections.map((s) => (
                  <div
                    key={s.kisim_no}
                    className="flex items-center gap-1 py-0.5"
                    data-testid={`quality-row-${s.kisim_no}`}
                  >
                    <div className="flex w-[232px] shrink-0 items-center gap-1 text-xs">
                      <span className="w-5 shrink-0 font-mono text-muted-foreground">
                        {s.kisim_no}
                      </span>
                      <span className="min-w-0 flex-1 truncate" title={s.ad}>
                        {s.ad}
                      </span>
                      <span
                        className="flex shrink-0 gap-0.5"
                        title={`${tr.quality.feeds}: ${s.bolumler.join(", ")}`}
                        data-testid={`section-bolumler-${s.kisim_no}`}
                      >
                        {s.bolumler.map((b) => (
                          <span
                            key={b}
                            className="rounded-sm px-1 font-mono text-[9px] leading-4 text-white"
                            style={{ background: colorForKod(b) }}
                          >
                            {b}
                          </span>
                        ))}
                      </span>
                    </div>
                    {s.days.map((d) => {
                      const rc = rcMap.get(d.rc);
                      return (
                        <HoverTip
                          key={d.tarih}
                          className="h-6 w-6 rounded-sm"
                          style={{ background: rc?.renk || "hsl(var(--muted))" }}
                          testid={`rc-cell-${s.kisim_no}-${d.tarih}`}
                          content={
                            <div className="space-y-0.5">
                              <div className="font-medium">{fmtDate(d.tarih)}</div>
                              <div>
                                {tr.quality.section} {s.kisim_no} · {s.ad}
                              </div>
                              <div>
                                <span className="font-mono">rc={d.rc}</span>{" "}
                                {rc ? rc.ad : tr.quality.unknownRc}
                              </div>
                              {rc?.aciklama && (
                                <div className="text-muted-foreground">{rc.aciklama}</div>
                              )}
                            </div>
                          }
                        >
                          <span className="sr-only">{`${s.ad} ${d.tarih} rc=${d.rc}`}</span>
                        </HoverTip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{tr.quality.carryTable}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kod</TableHead>
                      <TableHead>Sınıf</TableHead>
                      <TableHead className="text-right">{tr.common.weight}</TableHead>
                      <TableHead className="text-right">Gün</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {q.data!.carry_classes.map((c) => (
                      <TableRow key={c.kod} data-testid={`carry-${c.kod}`}>
                        <TableCell className="font-mono">{c.kod}</TableCell>
                        <TableCell>{c.ad_tr}</TableCell>
                        <TableCell className="text-right tabular">
                          {fmtNum(c.agirlik)}%
                        </TableCell>
                        <TableCell className="text-right tabular">{c.gun}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{tr.quality.exclusions}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tr.quality.reason}</TableHead>
                      <TableHead className="text-right">{tr.quality.rows}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {q.data!.exclusions.map((e, i) => (
                      <TableRow key={i} data-testid={`exclusion-${i}`}>
                        <TableCell>{e.neden}</TableCell>
                        <TableCell className="text-right tabular">{e.satir}</TableCell>
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
