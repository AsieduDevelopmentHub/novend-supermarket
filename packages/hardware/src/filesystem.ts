import { getHardwareAdapters } from "./adapters/create";
import type { HardwareResult, SavedFile } from "./types";

export async function savePDF(
  bytes: Uint8Array,
  fileName: string,
): Promise<HardwareResult<SavedFile>> {
  return getHardwareAdapters().filesystem.savePDF(bytes, fileName);
}

export async function saveImage(
  bytes: Uint8Array,
  fileName: string,
): Promise<HardwareResult<SavedFile>> {
  return getHardwareAdapters().filesystem.saveImage(bytes, fileName);
}

export async function readFile(path: string): Promise<HardwareResult<Uint8Array>> {
  return getHardwareAdapters().filesystem.readFile(path);
}
