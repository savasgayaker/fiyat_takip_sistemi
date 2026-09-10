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
      {/* Every screen shares this footer: base day, data date and method stamp (CLAUDE.md). */}
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span data-testid="footer-baseday">
          {tr.common.baseDay}: {fmtDate(meta?.base_day)} = 100
        </span>
        <span data-testid="footer-datadate">
          {tr.common.dataDate}: {fmtDate(meta?.data_date)}
        </span>
        <span data-testid="footer-method-version" className="font-medium">
          {tr.common.methodVersion}: {meta?.yontem_surumu || "—"}
        </span>
        <span data-testid="footer-version">
          {tr.common.version}: v{meta?.app_version || "—"}
        </span>
      </span>
    </footer>
  );
}
