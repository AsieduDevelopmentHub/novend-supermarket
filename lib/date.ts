import { format, formatDistanceToNow } from "date-fns";

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
  const lastSeenAt = args.lastSeenAt ?? 0;
  const online =
    args.presence === "online" || (lastSeenAt > 0 && Date.now() - lastSeenAt <= ONLINE_MS);
  if (online) return { online: true, label: "Online" };
  const stamp = args.lastSeenAt || args.lastLoginAt;
  if (!stamp) return { online: false, label: "Never seen" };
  const age = Date.now() - stamp;
  if (age < 24 * 60 * 60 * 1000) {
    return { online: false, label: `Last active ${formatRelative(stamp)}` };
  }
  return { online: false, label: `Last active ${formatDateTime(stamp)}` };
}
