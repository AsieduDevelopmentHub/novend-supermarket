import { describe, expect, it } from "vitest";
import { formatPresence } from "@/lib/date";
import {
  normalizeLastSeenAt,
  presenceFromLastSeenAt,
  sortUsersByPresence,
} from "@/lib/presence";

describe("presence", () => {
  it("treats zero lastSeenAt as absent", () => {
    expect(normalizeLastSeenAt(0)).toBeNull();
    expect(normalizeLastSeenAt(-1)).toBeNull();
    expect(normalizeLastSeenAt(1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  it("marks users online inside the heartbeat window", () => {
    const now = 1_700_000_000_000;
    expect(presenceFromLastSeenAt(now - 30_000, now).presence).toBe("online");
    expect(presenceFromLastSeenAt(now - 3 * 60_000, now).presence).toBe("offline");
  });

  it("does not fall back to last login when lastSeenAt was cleared to zero", () => {
    const formatted = formatPresence({
      lastSeenAt: 0,
      lastLoginAt: 1_700_000_000_000,
    });
    expect(formatted.online).toBe(false);
    expect(formatted.label).toBe("Never seen");
  });

  it("sorts online users first", () => {
    const now = 1_700_000_000_000;
    const sorted = sortUsersByPresence(
      [
        { name: "Zed", lastSeenAt: now - 60_000 },
        { name: "Amy", lastSeenAt: now - 10 * 60_000 },
      ],
      now,
    );
    expect(sorted.map((row) => row.name)).toEqual(["Zed", "Amy"]);
  });
});
