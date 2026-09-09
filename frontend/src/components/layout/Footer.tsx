import { useApp } from "@/context/AppContext";
import { tr } from "@/i18n/tr";
import { fmtDate } from "@/lib/format";

export function Footer() {
  const { meta, dbPath } = useApp();
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-6 py-2 text-[11px] text-muted-foreground">
      <span data-testid="footer-dbpath" className="truncate">
        {tr.common.dbPath}: <span className="font-mono">{dbPath}</span>
      </span>
      <span className="flex items-center gap-4">
        <span data-testid="footer-datadate">
          {tr.common.dataDate}: {fmtDate(meta?.data_date)}
        </span>
        <span data-testid="footer-version">
          {tr.common.version}: v{meta?.app_version || "—"}
        </span>
      </span>
    </footer>
  );
}
