import { getHardwareAdapters } from "./adapters/create";
import type { HardwareResult, PhotoCapture } from "./types";

export async function capturePhoto(): Promise<HardwareResult<PhotoCapture>> {
  return getHardwareAdapters().camera.capturePhoto();
}

export async function pickFromGallery(): Promise<HardwareResult<PhotoCapture>> {
  return getHardwareAdapters().camera.pickFromGallery();
}
