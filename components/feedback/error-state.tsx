import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "We could not load this content. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "border-destructive/20 bg-card flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-12 text-center",
        className,
      )}
    >
      <AlertCircle className="text-destructive h-8 w-8" />
      <div>
        <h3 className="text-foreground font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">{message}</p>
      </div>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
