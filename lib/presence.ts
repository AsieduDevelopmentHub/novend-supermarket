export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

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

export type PresenceUserRow = {
  name: string;
  presence?: "online" | "offline";
  lastSeenAt?: number | null;
};

/** Match Convex `users.list` ordering: online first, then name. */
export function sortUsersByPresence<T extends PresenceUserRow>(rows: T[], now = Date.now()): T[] {
  return [...rows].sort((a, b) => {
    const pa = presenceFromLastSeenAt(a.lastSeenAt, now);
    const pb = presenceFromLastSeenAt(b.lastSeenAt, now);
    const aOnline = a.presence === "online" || pa.presence === "online";
    const bOnline = b.presence === "online" || pb.presence === "online";
    if (aOnline !== bOnline) return aOnline ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
