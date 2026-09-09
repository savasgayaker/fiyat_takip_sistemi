import { useRef, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  ZAxis,
} from "recharts";
import { Upload, Loader2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { EmptyState } from "@/components/common/States";
import { tuikCompare } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { tr } from "@/i18n/tr";
import { fmtNum, fmtPct, fmtSigned, fmtDate } from "@/lib/format";
import { colorForKod } from "@/lib/palette";
import { exportChartPng } from "@/lib/exportChart";
import { toast } from "sonner";
import type { TuikCompareResult, ExportTable } from "@/types";

export default function TuikCompare() {
  const { from, to } = useApp();
  const [result, setResult] = useState<TuikCompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scatterRef = useRef<HTMLDivElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    try {
      const res = await tuikCompare(file, from, to);
      setResult(res);
      toast.success(`${res.rows.length} bölüm karşılaştırıldı`);
    } catch {
      toast.error("Dosya işlenemedi");
    } finally {
      setLoading(false);
    }
  };

  const exportTables: ExportTable[] = result
    ? [
        {
          name: "TÜİK Kıyas",
          columns: ["Kod", "Bölüm", "TÜİK %", "Biz %", "Fark", "Ağırlık", "Katkı Farkı"],
          rows: result.rows.map((r) => [
            r.kod, r.ad_tr, r.tuik, r.biz, r.fark, r.agirlik, r.katki_fark,
          ]),
        },
      ]
    : [];

  const scatterData =
    result?.rows.map((r) => ({ x: r.tuik, y: r.biz, kod: r.kod, ad: r.ad_tr })) || [];

  return (
    <div data-testid="page-tuik">
      <PageHeader
        title={tr.tuik.title}
        right={result && <ExportButtons screen="tuik" tables={exportTables} showPdf={false} />}
      />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">{tr.tuik.upload}</div>
            <div className="text-xs text-muted-foreground">{tr.tuik.uploadHint}</div>
            {fileName && (
              <div className="mt-1 text-xs text-primary" data-testid="tuik-filename">
                {fileName}
              </div>
            )}
          </div>
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={onFile}
              data-testid="tuik-file-input"
            />
            <Button
              onClick={() => inputRef.current?.click()}
              disabled={loading}
              data-testid="tuik-upload-button"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Dosya seç
            </Button>
          </div>
        </CardContent>
      </Card>

      {!result ? (
        <EmptyState label={tr.tuik.noFile} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card data-testid="tuik-summary-tuik">
              <CardContent className="p-4">
                <div className="text-xs uppercase text-muted-foreground">
                  {tr.tuik.tuikMonthly} ({fmtDate(result.month)})
                </div>
                <div className="mt-1 text-2xl font-bold tabular">
                  {fmtPct(result.summary.tuik)}
                </div>
              </CardContent>
            </Card>
            <Card data-testid="tuik-summary-biz">
              <CardContent className="p-4">
                <div className="text-xs uppercase text-muted-foreground">
                  {tr.tuik.ours}
                </div>
                <div className="mt-1 text-2xl font-bold tabular">
                  {fmtPct(result.summary.biz)}
                </div>
              </CardContent>
            </Card>
            <Card data-testid="tuik-summary-fark">
              <CardContent className="p-4">
                <div className="text-xs uppercase text-muted-foreground">
                  {tr.tuik.diff}
                </div>
                <div
                  className={`mt-1 text-2xl font-bold tabular ${
                    result.summary.fark >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {fmtSigned(result.summary.fark)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{tr.tuik.title}</CardTitle>
              </CardHeader>
              <CardContent className="scrollbar-thin overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bölüm</TableHead>
                      <TableHead className="text-right">TÜİK</TableHead>
                      <TableHead className="text-right">Biz</TableHead>
                      <TableHead className="text-right">Fark</TableHead>
                      <TableHead className="text-right">Katkı Farkı</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((r) => (
                      <TableRow key={r.kod} data-testid={`tuik-row-${r.kod}`}>
                        <TableCell className="max-w-[160px] truncate">
                          <span className="mr-1 font-mono text-muted-foreground">
                            {r.kod}
                          </span>
                          {r.ad_tr}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {fmtNum(r.tuik)}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {fmtNum(r.biz)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular ${
                            r.fark >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {fmtSigned(r.fark)}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {fmtSigned(r.katki_fark, 3)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{tr.tuik.scatter}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportChartPng(scatterRef.current, "tuik-scatter")}
                >
                  <Download className="h-4 w-4" /> PNG
                </Button>
              </CardHeader>
              <CardContent>
                <div ref={scatterRef} data-testid="tuik-scatter-chart">
                  <ResponsiveContainer width="100%" height={320}>
                    <ScatterChart margin={{ top: 10, right: 16, bottom: 20, left: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name="TÜİK"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        label={{ value: "TÜİK %", position: "insideBottom", offset: -10, fontSize: 11 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name="Biz"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        label={{ value: "Biz %", angle: -90, position: "insideLeft", fontSize: 11 }}
                      />
                      <ZAxis range={[80, 80]} />
                      <ReferenceLine
                        segment={[
                          { x: -100, y: -100 },
                          { x: 100, y: 100 },
                        ]}
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="4 4"
                      />
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                              <div className="font-semibold">{d.ad}</div>
                              <div className="tabular">TÜİK: {fmtNum(d.x)}</div>
                              <div className="tabular">Biz: {fmtNum(d.y)}</div>
                            </div>
                          );
                        }}
                      />
                      <Scatter data={scatterData}>
                        {scatterData.map((d) => (
                          <Cell key={d.kod} fill={colorForKod(d.kod)} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
