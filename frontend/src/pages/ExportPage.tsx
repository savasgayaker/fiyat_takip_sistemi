import { useQuery } from "@tanstack/react-query";
import { FileText, FileSpreadsheet, Image, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { getContrib, getQuality, exportExcel, exportPdf } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { tr } from "@/i18n/tr";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import type { ExportTable } from "@/types";

export default function ExportPage() {
  const { from, to, meta } = useApp();
  const contribQ = useQuery({
    queryKey: ["contrib", from, to],
    queryFn: () => getContrib(from, to, "bolum"),
    enabled: !!from && !!to,
  });
  const qualityQ = useQuery({ queryKey: ["quality"], queryFn: () => getQuality(14) });

  const buildTables = (): ExportTable[] => {
    const t: ExportTable[] = [];
    t.push({
      name: "Meta",
      columns: ["Alan", "Değer"],
      rows: [
        ["Veri tarihi", fmtDate(meta?.data_date)],
        ["Baz gün", fmtDate(meta?.base_day)],
        ["Kapsanan ağırlık %", meta?.coverage_weight ?? 0],
        ["Sınıf sayısı", meta?.class_count ?? 0],
        ["Devreden sınıf", meta?.carry_count ?? 0],
        ["Dönem", `${fmtDate(from)} – ${fmtDate(to)}`],
      ],
    });
    if (contribQ.data?.length) {
      t.push({
        name: "Bölüm Katkıları",
        columns: ["Kod", "Bölüm", "Ağırlık", "Endeks Baş", "Endeks Bit", "Değişim %", "Katkı"],
        rows: contribQ.data.map((c) => [
          c.kod, c.ad_tr, c.agirlik, c.endeks_bas, c.endeks_bit, c.degisim, c.katki_puan,
        ]),
      });
    }
    if (qualityQ.data) {
      t.push({
        name: "Devreden Sınıflar",
        columns: ["Kod", "Sınıf", "Ağırlık", "Gün"],
        rows: qualityQ.data.carry_classes.map((c) => [c.kod, c.ad_tr, c.agirlik, c.gun]),
      });
      t.push({
        name: "Dışlamalar",
        columns: ["Neden", "Satır"],
        rows: qualityQ.data.exclusions.map((e) => [e.neden, e.satir]),
      });
    }
    return t;
  };

  const doExcel = async () => {
    try {
      await exportExcel("bulten", buildTables());
      toast.success("Excel indirildi");
    } catch {
      toast.error(tr.common.error);
    }
  };
  const doPdf = async () => {
    try {
      await exportPdf(from, to);
      toast.success("PDF bülten indirildi");
    } catch {
      toast.error(tr.common.error);
    }
  };

  const Item = ({
    icon: Icon,
    title,
    desc,
    action,
    testid,
  }: any) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">{desc}</p>
        {action ? (
          <Button onClick={action} data-testid={testid}>
            <Download className="h-4 w-4" /> İndir
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Her grafiğin üstündeki PNG düğmesini kullanın
          </span>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div data-testid="page-export">
      <PageHeader title={tr.exportPage.title}>
        <p className="mt-1 text-sm text-muted-foreground">{tr.exportPage.desc}</p>
      </PageHeader>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Item
          icon={FileSpreadsheet}
          title={tr.exportPage.excel}
          desc="Meta, bölüm katkıları, devreden sınıflar ve dışlamalar — her tablo ayrı sayfada."
          action={doExcel}
          testid="export-page-excel"
        />
        <Item
          icon={FileText}
          title={tr.exportPage.pdf}
          desc="Kapak, ana grafik, bölüm tablosu, katkılar, en çok artan/azalan 10 sınıf, yöntem notu ve kapsam dipnotu."
          action={doPdf}
          testid="export-page-pdf"
        />
        <Item
          icon={Image}
          title={tr.exportPage.png}
          desc="Panodaki ve kırılımdaki her grafik yüksek çözünürlüklü PNG olarak indirilebilir."
        />
      </div>
    </div>
  );
}
