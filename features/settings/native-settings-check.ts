let queue: Promise<void> = Promise.resolve();

/** Serialize native status probes so app resume cannot stack bridge calls. */
export function runNativeSettingsCheck<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation, operation);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
