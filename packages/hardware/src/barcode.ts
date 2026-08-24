import { getHardwareAdapters } from "./adapters/create";
import type { BarcodeScanResult, HardwareResult } from "./types";

export async function scan(): Promise<HardwareResult<BarcodeScanResult>> {
  const adapters = await getHardwareAdapters();
  return adapters.barcode.scan();
}

export async function startListening(): Promise<HardwareResult> {
  const adapters = await getHardwareAdapters();
  return adapters.barcode.startListening();
}

export async function stopListening(): Promise<HardwareResult> {
  const adapters = await getHardwareAdapters();
  return adapters.barcode.stopListening();
}

export async function discover(): Promise<HardwareResult<unknown>> {
  const adapters = await getHardwareAdapters();
  const adapter = adapters.barcode;
  if (!adapter.discover) {
    return { ok: false, message: "Scanner discovery is not available on this platform" };
  }
  return adapter.discover();
}
