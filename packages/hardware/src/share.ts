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

export async function shareFile(uri: string, title?: string): Promise<HardwareResult> {
  const adapters = await getHardwareAdapters();
  if (adapters.share.shareFile) return adapters.share.shareFile(uri, title);
  return adapters.share.shareImage(uri, title);
}

export async function sharePdf(
  bytes: Uint8Array,
  title: string,
  fileName: string,
): Promise<HardwareResult> {
  const adapters = await getHardwareAdapters();
  if (adapters.share.sharePdf) return adapters.share.sharePdf(bytes, title, fileName);
  return { ok: false, message: "Share is not available on this device." };
}
