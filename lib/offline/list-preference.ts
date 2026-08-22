/**
 * Prefer the Dexie replica for lists once it has rows.
 * Live Convex is a fallback for first online paint before the snapshot lands.
 */
export function pickReplicaList<T>(args: {
  local: T[] | null | undefined;
  remote: T[] | undefined;
  online: boolean;
}): { rows: T[] | undefined; source: "local" | "remote"; loading: boolean } {
  if (!args.online) {
    if (args.local != null) return { rows: args.local, source: "local", loading: false };
    return { rows: undefined, source: "local", loading: true };
  }
  if (args.local && args.local.length > 0) {
    return { rows: args.local, source: "local", loading: false };
  }
  if (args.remote !== undefined) {
    return { rows: args.remote, source: "remote", loading: false };
  }
  if (args.local != null) return { rows: args.local, source: "local", loading: false };
  return { rows: undefined, source: "local", loading: true };
}
