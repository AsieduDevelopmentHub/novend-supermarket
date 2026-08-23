import { getPlatform } from "../platform";
import type { HardwareAdapters } from "../types";
import { createCapacitorAdapters } from "./capacitor";
import { createElectronAdapters } from "./electron";
import { createWebAdapters } from "./web";

let cached: HardwareAdapters | null = null;
let cachedPlatform: string | null = null;

/** Resolve (and memoize) the adapter set for the current platform. */
export function getHardwareAdapters(): HardwareAdapters {
  const platform = getPlatform();
  if (cached && cachedPlatform === platform) return cached;

  cachedPlatform = platform;
  if (platform === "electron") {
    cached = createElectronAdapters();
  } else if (platform === "android" || platform === "ios") {
    cached = createCapacitorAdapters();
  } else {
    cached = createWebAdapters();
  }
  return cached;
}

/** Test helper — clear memoized adapters after platform mocks. */
export function resetHardwareAdapters() {
  cached = null;
  cachedPlatform = null;
}
