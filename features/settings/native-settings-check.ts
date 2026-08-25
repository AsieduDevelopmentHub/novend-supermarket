import { NATIVE_SETTINGS_PROBE_MS, withTimeout } from "@novend/hardware";

let queue: Promise<void> = Promise.resolve();

/**
 * Serialize native status probes so Security cannot stack bridge calls.
 * Each operation is hard-capped so a hung Cap plugin cannot hold the queue forever.
 */
export function runNativeSettingsCheck<T>(
  operation: () => Promise<T>,
  ms = NATIVE_SETTINGS_PROBE_MS * 2,
): Promise<T> {
  const result = queue.then(
    () => withTimeout(operation(), ms),
    () => withTimeout(operation(), ms),
  );
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
