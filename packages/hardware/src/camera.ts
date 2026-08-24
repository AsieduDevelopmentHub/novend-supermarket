import { getHardwareAdapters } from "./adapters/create";
import type { HardwareResult, PhotoCapture } from "./types";

export async function ensurePermission(
  kind: "camera" | "photos" = "camera",
): Promise<HardwareResult> {
  const adapters = await getHardwareAdapters();
  return adapters.camera.ensurePermission(kind);
}

export async function capturePhoto(): Promise<HardwareResult<PhotoCapture>> {
  const adapters = await getHardwareAdapters();
  return adapters.camera.capturePhoto();
}

export async function pickFromGallery(): Promise<HardwareResult<PhotoCapture>> {
  const adapters = await getHardwareAdapters();
  return adapters.camera.pickFromGallery();
}
