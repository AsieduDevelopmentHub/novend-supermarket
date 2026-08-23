import { getHardwareAdapters } from "./adapters/create";
import type { BarcodeScanResult, HardwareResult } from "./types";

export async function scan(): Promise<HardwareResult<BarcodeScanResult>> {
  return getHardwareAdapters().barcode.scan();
}

export async function startListening(): Promise<HardwareResult> {
  return getHardwareAdapters().barcode.startListening();
}

export async function stopListening(): Promise<HardwareResult> {
  return getHardwareAdapters().barcode.stopListening();
}

export async function discover(): Promise<HardwareResult<unknown>> {
  const adapter = getHardwareAdapters().barcode;
  if (!adapter.discover) {
    return { ok: false, message: "Scanner discovery is not available on this platform" };
  }
  return adapter.discover();
}
