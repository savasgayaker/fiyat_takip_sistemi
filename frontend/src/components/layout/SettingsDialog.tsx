import { Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/AppContext";
import { tr } from "@/i18n/tr";
import { fmtDate } from "@/lib/format";

export function SettingsDialog() {
  const { dbPath, setDbPath, meta, theme, toggleTheme } = useApp();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={tr.common.settings}
          data-testid="settings-trigger"
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle>{tr.common.settings}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{tr.common.dbPath}</Label>
            <Input
              value={dbPath}
              onChange={(e) => setDbPath(e.target.value)}
              className="font-mono text-xs"
              data-testid="settings-dbpath-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{tr.common.baseDay}</Label>
              <div className="rounded-md border border-border px-3 py-2 text-sm tabular">
                {fmtDate(meta?.base_day)} = 100
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{tr.common.language}</Label>
              <div className="rounded-md border border-border px-3 py-2 text-sm">
                Türkçe (TR)
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">{tr.common.theme}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              data-testid="settings-theme-toggle"
            >
              {theme === "light" ? tr.common.light : tr.common.dark}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
