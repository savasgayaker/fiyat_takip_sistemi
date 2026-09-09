import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportExcel, exportPdf } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { tr } from "@/i18n/tr";
import type { ExportTable } from "@/types";
import { toast } from "sonner";

interface Props {
  screen: string;
  tables: ExportTable[];
  showPdf?: boolean;
}

export function ExportButtons({ screen, tables, showPdf = true }: Props) {
  const { from, to } = useApp();
  const [busy, setBusy] = useState<"" | "excel" | "pdf">("");

  const doExcel = async () => {
    setBusy("excel");
    try {
      await exportExcel(screen, tables);
      toast.success("Excel indirildi");
    } catch {
      toast.error(tr.common.error);
    } finally {
      setBusy("");
    }
  };

  const doPdf = async () => {
    setBusy("pdf");
    try {
      await exportPdf(from, to);
      toast.success("PDF bülten indirildi");
    } catch {
      toast.error(tr.common.error);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={doExcel}
        disabled={busy !== ""}
        data-testid="export-excel-button"
      >
        {busy === "excel" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4" />
        )}
        {tr.exportPage.excel}
      </Button>
      {showPdf && (
        <Button
          variant="outline"
          size="sm"
          onClick={doPdf}
          disabled={busy !== ""}
          data-testid="export-pdf-button"
        >
          {busy === "pdf" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {tr.exportPage.pdf}
        </Button>
      )}
    </div>
  );
}
