/** Strict helpers for comparing native app versions with release metadata. */
export function normalizeAppVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^v/i, "");
  if (!/^\d+(?:\.\d+){0,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(trimmed)) return null;
  return trimmed;
}

/** Returns a positive number when left is newer than right. */
export function compareAppVersions(left: string, right: string): number {
  const a = normalizeAppVersion(left);
  const b = normalizeAppVersion(right);
  if (!a || !b) return 0;
  const [aCore] = a.split(/[+-]/, 1);
  const [bCore] = b.split(/[+-]/, 1);
  const aParts = aCore.split(".").map((part) => Number(part));
  const bParts = bCore.split(".").map((part) => Number(part));
  for (let index = 0; index < Math.max(aParts.length, bParts.length); index += 1) {
    const delta = (aParts[index] ?? 0) - (bParts[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}
