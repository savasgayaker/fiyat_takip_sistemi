import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIndexMulti } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { LoadingState, EmptyState } from "@/components/common/States";
import { fmtDateShort, fmtPct } from "@/lib/format";
import { tr } from "@/i18n/tr";

interface Division {
  kod: string;
  ad_tr: string;
}

/** Diverging colour: green for positive daily change, red for negative. */
function heatColor(v: number, max: number): string {
  const t = Math.max(-1, Math.min(1, max ? v / max : 0));
  if (t >= 0) return `hsl(145 55% ${90 - t * 42}%)`;
  return `hsl(2 72% ${90 + t * 42}%)`;
}

export function DivisionHeatmap({ divisions }: { divisions: Division[] }) {
  const { from, to } = useApp();
  const kods = useMemo(() => divisions.map((d) => d.kod), [divisions]);

  const q = useQuery({
    queryKey: ["heatmap", kods, from, to],
    queryFn: () => getIndexMulti(kods, from, to),
    enabled: kods.length > 0 && !!from && !!to,
  });

  const { rows, dates, maxAbs } = useMemo(() => {
    const data = q.data || [];
    const dts = data[0]?.series.map((p) => p.tarih).slice(1) || [];
    let mx = 0.15;
    const rws = data.map((s) => {
      const deltas: number[] = [];
      for (let i = 1; i < s.series.length; i++) {
        const d = (s.series[i].endeks / s.series[i - 1].endeks - 1) * 100;
        deltas.push(d);
        mx = Math.max(mx, Math.abs(d));
      }
      return { kod: s.kod, ad_tr: s.ad_tr, deltas };
    });
    return { rows: rws, dates: dts, maxAbs: mx };
  }, [q.data]);

  return (
    <Card data-testid="division-heatmap">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{tr.breakdown.heatmap}</CardTitle>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{tr.breakdown.heatmapNeg}</span>
          <span
            className="h-3 w-4 rounded-sm"
            style={{ background: heatColor(-maxAbs, maxAbs) }}
          />
          <span
            className="h-3 w-4 rounded-sm"
            style={{ background: heatColor(0, maxAbs) }}
          />
          <span
            className="h-3 w-4 rounded-sm"
            style={{ background: heatColor(maxAbs, maxAbs) }}
          />
          <span>{tr.breakdown.heatmapPos}</span>
        </div>
      </CardHeader>
      <CardContent className="scrollbar-thin overflow-x-auto">
        {q.isLoading ? (
          <LoadingState />
        ) : rows.length === 0 || dates.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="min-w-max">
            <div className="mb-1 flex items-center gap-[2px] pl-[220px] text-[9px] text-muted-foreground">
              {dates.map((d) => (
                <div key={d} className="w-5 text-center">
                  {fmtDateShort(d).split(".")[0]}
                </div>
              ))}
            </div>
            {rows.map((r) => (
              <div
                key={r.kod}
                className="flex items-center gap-[2px] py-[2px]"
                data-testid={`heatmap-row-${r.kod}`}
              >
                <div className="w-[220px] shrink-0 truncate text-xs">
                  <span className="mr-1 font-mono text-muted-foreground">{r.kod}</span>
                  {r.ad_tr}
                </div>
                {r.deltas.map((v, i) => (
                  <div
                    key={i}
                    title={`${r.ad_tr} · ${dates[i]} · ${fmtPct(v)}`}
                    className="h-5 w-5 shrink-0 rounded-[2px]"
                    style={{ background: heatColor(v, maxAbs) }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
