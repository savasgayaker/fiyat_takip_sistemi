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
import { getQuality } from "@/lib/api";
import { tr } from "@/i18n/tr";
import { fmtDateShort, fmtNum } from "@/lib/format";
import type { ExportTable } from "@/types";

const RC_COLOR: Record<number, string> = {
  0: "bg-emerald-500",
  1: "bg-amber-400",
  4: "bg-orange-500",
  5: "bg-red-600",
  6: "bg-red-700",
};

export default function Quality() {
  const q = useQuery({ queryKey: ["quality"], queryFn: () => getQuality(14) });

  const dates = q.data?.sections?.[0]?.days.map((d) => d.tarih) || [];

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
        <p className="mt-1 text-sm text-muted-foreground">{tr.quality.rcLegend}</p>
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
              <div className="min-w-[720px]">
                <div className="mb-1 flex items-center gap-1 pl-[168px] text-[10px] text-muted-foreground">
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
                    <div className="w-[168px] shrink-0 truncate text-xs">
                      <span className="mr-1 font-mono text-muted-foreground">
                        {s.kisim_no}
                      </span>
                      {s.ad}
                    </div>
                    {s.days.map((d) => (
                      <div
                        key={d.tarih}
                        title={`${s.ad} · ${d.tarih} · rc=${d.rc}`}
                        className={`h-6 w-6 rounded-sm ${RC_COLOR[d.rc] || "bg-muted"}`}
                        data-testid={`rc-cell-${s.kisim_no}-${d.tarih}`}
                      />
                    ))}
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
