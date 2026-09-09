import { useRef } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtNum, fmtPct, fmtSigned } from "@/lib/format";
import { colorForKod } from "@/lib/palette";
import { exportChartPng } from "@/lib/exportChart";

export interface ContribDatum {
  kod: string;
  ad_tr: string;
  katki_puan: number;
  degisim: number;
}

/** Horizontal contribution bars sorted by absolute value; negative left, positive right. */
export function ContribBar({
  data,
  filename = "katki",
}: {
  data: ContribDatum[];
  filename?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const sorted = [...data].sort(
    (a, b) => Math.abs(b.katki_puan) - Math.abs(a.katki_puan),
  );
  const height = Math.max(sorted.length * 34 + 20, 160);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => exportChartPng(ref.current, filename)}
          data-testid="contrib-png-button"
        >
          <Download className="h-4 w-4" /> PNG
        </Button>
      </div>
      <div ref={ref} data-testid="contrib-bar-chart">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            layout="vertical"
            data={sorted}
            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => fmtSigned(v)}
            />
            <YAxis
              type="category"
              dataKey="ad_tr"
              width={150}
              tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))" }}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as ContribDatum;
                return (
                  <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                    <div className="font-semibold">{d.ad_tr}</div>
                    <div className="tabular text-muted-foreground">
                      Katkı: {fmtSigned(d.katki_puan)} puan
                    </div>
                    <div className="tabular text-muted-foreground">
                      Değişim: {fmtPct(d.degisim)}
                    </div>
                  </div>
                );
              }}
            />
            <ReferenceLine x={0} stroke="hsl(var(--border))" />
            <Bar dataKey="katki_puan" radius={[2, 2, 2, 2]}>
              {sorted.map((d) => (
                <Cell
                  key={d.kod}
                  fill={
                    d.katki_puan >= 0 ? colorForKod(d.kod) : "hsl(var(--destructive))"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
