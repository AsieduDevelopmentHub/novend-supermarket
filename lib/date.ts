import { format, formatDistanceToNow } from "date-fns";

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "month"
  | "custom"
  | "all";

/** YYYY-MM-DD in the local calendar (avoids UTC off-by-one). */
export function toLocalDateInput(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function endOfLocalDay(date: Date) {
  return startOfLocalDay(date) + 24 * 60 * 60 * 1000 - 1;
}

export function rangeForDatePreset(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string,
): { startDate?: number; endDate?: number } {
  const now = new Date();
  if (preset === "all") return {};
  if (preset === "today") {
    return { startDate: startOfLocalDay(now), endDate: endOfLocalDay(now) };
  }
  if (preset === "yesterday") {
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return { startDate: startOfLocalDay(yesterday), endDate: endOfLocalDay(yesterday) };
  }
  if (preset === "7d") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return { startDate: startOfLocalDay(start), endDate: endOfLocalDay(now) };
  }
  if (preset === "30d") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    return { startDate: startOfLocalDay(start), endDate: endOfLocalDay(now) };
  }
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: startOfLocalDay(start), endDate: endOfLocalDay(now) };
  }
  const start = customStart ? parseLocalDateInput(customStart) : null;
  const end = customEnd ? parseLocalDateInput(customEnd) : null;
  if (!start && !end) return {};
  let startDate = start ? startOfLocalDay(start) : undefined;
  let endDate = end ? endOfLocalDay(end) : undefined;
  if (startDate !== undefined && endDate !== undefined && endDate < startDate) {
    const swappedStart = startOfLocalDay(end!);
    const swappedEnd = endOfLocalDay(start!);
    startDate = swappedStart;
    endDate = swappedEnd;
  }
  return { startDate, endDate };
}

export function formatDate(value: number | Date) {
  return format(value, "dd MMM yyyy");
}

export function formatDateTime(value: number | Date) {
  return format(value, "dd MMM yyyy · HH:mm");
}

export function formatTime(value: number | Date) {
  return format(value, "HH:mm");
}

export function formatRelative(value: number | Date) {
  return formatDistanceToNow(value, { addSuffix: true });
}

const ONLINE_MS = 2 * 60 * 1000;

export function formatPresence(args: {
  presence?: "online" | "offline";
  lastSeenAt?: number | null;
  lastLoginAt?: number | null;
}) {
  const clearedSeen = args.lastSeenAt === 0;
  const seenAt =
    !clearedSeen && args.lastSeenAt != null && args.lastSeenAt > 0 ? args.lastSeenAt : null;
  const online =
    args.presence === "online" ||
    (seenAt !== null && Date.now() - seenAt <= ONLINE_MS);
  if (online) return { online: true, label: "Online" };
  const stamp = seenAt ?? (clearedSeen ? null : args.lastLoginAt ?? null);
  if (!stamp || stamp <= 0) return { online: false, label: "Never seen" };
  const age = Date.now() - stamp;
  if (age < 24 * 60 * 60 * 1000) {
    return { online: false, label: `Last active ${formatRelative(stamp)}` };
  }
  return { online: false, label: `Last active ${formatDateTime(stamp)}` };
}
