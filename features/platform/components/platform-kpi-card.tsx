import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PlatformKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <Card
      className={cn(
        "min-w-0 border-l-[3px]",
        tone === "default" && "border-l-primary",
        tone === "warning" && "border-l-warning",
        tone === "danger" && "border-l-destructive",
      )}
    >
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</p>
          {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
        </div>
        <div className="bg-accent text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </CardContent>
    </Card>
  );
}
