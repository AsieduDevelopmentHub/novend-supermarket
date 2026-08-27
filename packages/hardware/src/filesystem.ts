import { getHardwareAdapters } from "./adapters/create";
import type { HardwareResult, SavedFile } from "./types";

export async function savePDF(
  bytes: Uint8Array,
  fileName: string,
): Promise<HardwareResult<SavedFile>> {
  const adapters = await getHardwareAdapters();
  return adapters.filesystem.savePDF(bytes, fileName);
}

export async function saveImage(
  bytes: Uint8Array,
  fileName: string,
): Promise<HardwareResult<SavedFile>> {
  const adapters = await getHardwareAdapters();
  return adapters.filesystem.saveImage(bytes, fileName);
}

export async function readFile(path: string): Promise<HardwareResult<Uint8Array>> {
  const adapters = await getHardwareAdapters();
  return adapters.filesystem.readFile(path);
}

export async function printPDF(bytes: Uint8Array, title: string): Promise<HardwareResult> {
  const adapters = await getHardwareAdapters();
  if (!adapters.filesystem.printPDF) {
    return { ok: false, message: "Printing is not available on this device." };
  }
  return adapters.filesystem.printPDF(bytes, title);
}
