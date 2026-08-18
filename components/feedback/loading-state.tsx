import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  label?: string;
  className?: string;
  /** Layout that roughly matches the destination screen. */
  variant?: "page" | "form" | "table" | "cards" | "inline";
};

export function LoadingState({
  label = "Loading…",
  className,
  variant = "page",
}: LoadingStateProps) {
  return (
    <div className={cn("w-full", className)} role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      {variant === "inline" ? <InlineSkeleton /> : null}
      {variant === "form" ? <FormSkeleton /> : null}
      {variant === "table" ? <TableSkeleton /> : null}
      {variant === "cards" ? <CardsSkeleton /> : null}
      {variant === "page" ? <PageSkeleton /> : null}
    </div>
  );
}

function InlineSkeleton() {
  return (
    <div className="flex items-center justify-center gap-3 py-10">
      <Skeleton className="h-5 w-5 rounded-full" />
      <Skeleton className="h-4 w-28" />
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-6">
      <Skeleton className="mx-auto h-16 w-16 rounded-full" />
      <Skeleton className="mx-auto h-6 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-4 py-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="border-border space-y-3 rounded-xl border p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="space-y-4 py-2">
      <Skeleton className="h-7 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6 py-2">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
