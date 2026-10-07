import { formatClockIn } from "@/lib/date";

export function ClockInLabel({
  clockedInAt,
  clockedInOn,
}: {
  clockedInAt?: number | null;
  clockedInOn?: string | null;
}) {
  const label = formatClockIn({ clockedInAt, clockedInOn });
  if (!label) return null;
  return <p className="text-muted-foreground text-xs">{label}</p>;
}
