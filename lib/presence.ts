import { presenceFromLastSeenAt } from "@/convex/shared/presence";

export {
  ONLINE_WINDOW_MS,
  normalizeLastSeenAt,
  presenceFromLastSeenAt,
} from "@/convex/shared/presence";

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
