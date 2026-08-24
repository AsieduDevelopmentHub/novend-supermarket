import { getHardwareAdapters } from "./adapters/create";
import type { HardwareResult } from "./types";

export async function shareReceipt(text: string, title?: string): Promise<HardwareResult> {
  const adapters = await getHardwareAdapters();
  return adapters.share.shareReceipt(text, title);
}

export async function shareImage(uri: string, title?: string): Promise<HardwareResult> {
  const adapters = await getHardwareAdapters();
  return adapters.share.shareImage(uri, title);
}
