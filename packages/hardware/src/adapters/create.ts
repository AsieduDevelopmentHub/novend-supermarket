import { getPlatform } from "../platform";
import type { HardwareAdapters } from "../types";

let cached: HardwareAdapters | null = null;
let cachedPlatform: string | null = null;
let loading: Promise<HardwareAdapters> | null = null;

/**
 * Resolve (and memoize) the adapter set for the current platform.
 * Platform adapters are loaded dynamically so opening Settings / Security does
 * not evaluate Camera, ML Kit, or BLE plugins until a feature needs them.
 */
export async function getHardwareAdapters(): Promise<HardwareAdapters> {
  const platform = getPlatform();
  if (cached && cachedPlatform === platform) return cached;
  if (loading) return loading;

  loading = (async () => {
    cachedPlatform = platform;
    if (platform === "electron") {
      const { createElectronAdapters } = await import("./electron");
      cached = createElectronAdapters();
    } else if (platform === "android" || platform === "ios") {
      const { createCapacitorAdapters } = await import("./capacitor");
      cached = createCapacitorAdapters();
    } else {
      const { createWebAdapters } = await import("./web");
      cached = createWebAdapters();
    }
    return cached!;
  })();

  try {
    return await loading;
  } finally {
    loading = null;
  }
}

/** Test helper — clear memoized adapters after platform mocks. */
export function resetHardwareAdapters() {
  cached = null;
  cachedPlatform = null;
  loading = null;
}
