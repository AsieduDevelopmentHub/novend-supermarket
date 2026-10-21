/** In-process signal so Dexie-first UI refreshes immediately after local writes. */

const EVENT = "novend:replica-changed";

let writeEpoch = 0;

/** Bump when Dexie changes so an in-flight Convex snapshot cannot overwrite it. */
export function bumpReplicaWriteEpoch(): void {
  writeEpoch += 1;
}

export function replicaWriteEpoch(): number {
  return writeEpoch;
}

export function shouldApplyFetchedSnapshot(epochAtFetchStart: number): boolean {
  return epochAtFetchStart === writeEpoch;
}

export type ReplicaChangedDetail = {
  /** When true, the offline provider should force-pull a Convex snapshot. */
  pull?: boolean;
  /** When true, drain the outbox in the background (do not block the UI). */
  flush?: boolean;
  /** List refresh only — do not invalidate an in-flight snapshot apply. */
  silent?: boolean;
  /**
   * Product photo blob cache only — Sales catalog warm cache must stay intact
   * so painting tiles does not re-scan Dexie for every image put.
   */
  imagesOnly?: boolean;
};

export function notifyReplicaChanged(detail: ReplicaChangedDetail = {}) {
  if (!detail.silent) bumpReplicaWriteEpoch();
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail }));
}

export function subscribeReplicaChanged(
  onChange: (detail: ReplicaChangedDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<ReplicaChangedDetail>).detail ?? {};
    onChange(detail);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
