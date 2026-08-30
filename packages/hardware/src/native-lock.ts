/**
 * Capacitor's Android bridge is single-threaded. A hung plugin call (especially
 * LocalNotifications / checkBiometry) blocks camera, share, and print until it
 * settles. Settings probes must not stack.
 */
let exclusive: Promise<unknown> | null = null;

export function isNativeBridgeBusy(): boolean {
  return exclusive !== null;
}

export async function runExclusiveNative<T>(
  operation: () => Promise<T>,
  busyFallback: T,
  options?: { cooldownMs?: number },
): Promise<T> {
  if (exclusive) {
    return busyFallback;
  }
  const cooldownMs = options?.cooldownMs ?? 0;
  const run = (async () => {
    try {
      return await operation();
    } finally {
      if (cooldownMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, cooldownMs));
      }
    }
  })();
  exclusive = run;
  try {
    return await run;
  } finally {
    if (exclusive === run) {
      exclusive = null;
    }
  }
}
