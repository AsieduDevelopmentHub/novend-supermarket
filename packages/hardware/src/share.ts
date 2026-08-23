import { getHardwareAdapters } from "./adapters/create";
import type { HardwareResult } from "./types";

export async function shareReceipt(text: string, title?: string): Promise<HardwareResult> {
  return getHardwareAdapters().share.shareReceipt(text, title);
}

export async function shareImage(uri: string, title?: string): Promise<HardwareResult> {
  return getHardwareAdapters().share.shareImage(uri, title);
}
