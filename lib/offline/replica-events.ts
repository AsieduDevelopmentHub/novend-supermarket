/** In-process signal so Dexie-first UI refreshes immediately after local writes. */

const EVENT = "novend:replica-changed";

export type ReplicaChangedDetail = {
  /** When true, the offline provider should force-pull a Convex snapshot. */
  pull?: boolean;
};

export function notifyReplicaChanged(detail: ReplicaChangedDetail = {}) {
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
