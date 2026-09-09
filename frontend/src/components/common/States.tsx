import { Loader2, AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "@/i18n/tr";

export function LoadingState({ label }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-muted-foreground"
      data-testid="loading-state"
    >
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="mt-3 text-sm">{label || tr.common.loading}</span>
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-muted-foreground"
      data-testid="error-state"
    >
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <span className="mt-3 text-sm">{tr.common.error}</span>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onRetry}
          data-testid="retry-button"
        >
          {tr.common.retry}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ label }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-muted-foreground"
      data-testid="empty-state"
    >
      <Inbox className="h-6 w-6" />
      <span className="mt-3 text-sm">{label || tr.common.empty}</span>
    </div>
  );
}
