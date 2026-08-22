export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

/** Treat unset or cleared (0) timestamps as absent. */
export function normalizeLastSeenAt(value: number | null | undefined): number | null {
  if (value == null || value <= 0) return null;
  return value;
}

export function presenceFromLastSeenAt(
  lastSeenAt: number | null | undefined,
  now = Date.now(),
): { lastSeenAt: number | null; presence: "online" | "offline" } {
  const seen = normalizeLastSeenAt(lastSeenAt);
  const isOnline = seen !== null && now - seen <= ONLINE_WINDOW_MS;
  return { lastSeenAt: seen, presence: isOnline ? "online" : "offline" };
}
