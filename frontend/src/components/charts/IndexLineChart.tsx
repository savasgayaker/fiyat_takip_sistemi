import { useRef } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Brush,
  ReferenceDot,
  Legend,
} from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtDateShort, fmtNum, fmtSigned } from "@/lib/format";
import { exportChartPng } from "@/lib/exportChart";
import type { SeriesPoint } from "@/types";

export interface LineSeries {
  kod: string;
  ad_tr: string;
  color: string;
  series: { tarih: string; endeks: number }[];
}

interface Props {
  series: LineSeries[];
  height?: number;
  showBrush?: boolean;
  filename?: string;
  markers?: { tarih: string; label: string }[];
}

/** Merge multiple series into a single row-per-date dataset for Recharts. */
function mergeData(series: LineSeries[]) {
  const map = new Map<string, any>();
  for (const s of series) {
    let prev: number | null = null;
    for (const p of s.series) {
      const row = map.get(p.tarih) || { tarih: p.tarih };
      row[s.kod] = p.endeks;
      row[`${s.kod}__delta`] = prev === null ? 0 : p.endeks - prev;
      prev = p.endeks;
      map.set(p.tarih, row);
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.tarih < b.tarih ? -1 : 1,
  );
}

function CustomTooltip({ active, payload, label, series }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-semibold text-popover-foreground">
        {fmtDate(label)}
      </div>
      {payload.map((p: any) => {
        const s = series.find((x: LineSeries) => x.kod === p.dataKey);
        const delta = p.payload[`${p.dataKey}__delta`];
        return (
          <div key={p.dataKey} className="flex items-center gap-2 tabular">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: p.color }}
            />
            <span className="text-muted-foreground">{s?.ad_tr}:</span>
            <span className="font-medium text-popover-foreground">
              {fmtNum(p.value)}
            </span>
            <span
              className={
                delta > 0
                  ? "text-emerald-600"
                  : delta < 0
                    ? "text-red-600"
                    : "text-muted-foreground"
              }
            >
              {fmtSigned(delta)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function IndexLineChart({
  series,
  height = 320,
  showBrush = true,
  filename = "endeks",
  markers = [],
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const data = mergeData(series);
  const allVals = series.flatMap((s) => s.series.map((p) => p.endeks));
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const pad = Math.max((max - min) * 0.1, 0.3);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => exportChartPng(ref.current, filename)}
          data-testid="chart-png-button"
        >
          <Download className="h-4 w-4" /> PNG
        </Button>
      </div>
      <div ref={ref} data-testid="index-line-chart">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="tarih"
              tickFormatter={fmtDateShort}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              minTickGap={24}
            />
            <YAxis
              domain={[min - pad, max + pad]}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => fmtNum(v)}
              width={52}
            />
            <Tooltip content={<CustomTooltip series={series} />} />
            {series.length > 1 && (
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(v) =>
                  series.find((s) => s.kod === v)?.ad_tr || v
                }
              />
            )}
            {series.map((s) => (
              <Line
                key={s.kod}
                type="monotone"
                dataKey={s.kod}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ))}
            {markers.map((m) => {
              const row = data.find((d) => d.tarih === m.tarih);
              const val = row ? row[series[0]?.kod] : undefined;
              if (val === undefined) return null;
              return (
                <ReferenceDot
                  key={m.tarih}
                  x={m.tarih}
                  y={val}
                  r={5}
                  fill="hsl(var(--chart-3))"
                  stroke="#fff"
                />
              );
            })}
            {showBrush && data.length > 10 && (
              <Brush
                dataKey="tarih"
                height={22}
                stroke="hsl(var(--primary))"
                tickFormatter={fmtDateShort}
                travellerWidth={8}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
