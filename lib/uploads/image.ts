/**
 * Client-side image upload checks and compression before posting to Convex storage.
 * Server `assertStoredImage` remains the source of truth for stored blobs.
 */

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

/** Max edge length for product photos before upload (keeps offline sync light). */
export const PRODUCT_IMAGE_MAX_EDGE = 1280;

export const IMAGE_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) return "";
  return fileName.slice(idx).toLowerCase();
}

async function readMagicBytes(file: File): Promise<Uint8Array> {
  const buffer = await file.slice(0, 12).arrayBuffer();
  return new Uint8Array(buffer);
}

function matchesImageMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 3) return false;
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  // PNG
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return true;
  }
  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return true;
  }
  return false;
}

/**
 * Validate a user-selected image file. Throws an Error with a user-facing message.
 */
export async function assertValidImageFile(file: File): Promise<void> {
  if (file.size <= 0) throw new Error("Selected file is empty");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be 2 MB or smaller");

  const mime = (file.type || "").toLowerCase();
  if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime)) {
    throw new Error("Only JPG, PNG, or WebP images are allowed");
  }

  const ext = extensionOf(file.name);
  if (!(ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error("File extension must be .jpg, .jpeg, .png, or .webp");
  }

  const magic = await readMagicBytes(file);
  if (!matchesImageMagic(magic)) {
    throw new Error("File content is not a valid JPG, PNG, or WebP image");
  }
}

/**
 * Compress / downscale a product image for upload and offline-friendly sync.
 * Returns a JPEG File under MAX_IMAGE_BYTES when possible.
 */
export async function compressProductImage(
  file: File,
  options?: { maxEdge?: number; quality?: number },
): Promise<File> {
  const maxEdge = options?.maxEdge ?? PRODUCT_IMAGE_MAX_EDGE;
  const quality = options?.quality ?? 0.82;

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image");
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((next) => resolve(next), "image/jpeg", quality),
    );
    if (!blob) throw new Error("Could not compress image");

    let out = blob;
    if (out.size > MAX_IMAGE_BYTES) {
      const tighter = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((next) => resolve(next), "image/jpeg", 0.65),
      );
      if (tighter) out = tighter;
    }
    if (out.size > MAX_IMAGE_BYTES) {
      throw new Error("Image must be 2 MB or smaller after compression");
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "product";
    return new File([out], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

/**
 * Center-crop a video frame or canvas to 1:1 so capture matches product /
 * profile `aspect-square` frames.
 */
export function cropCanvasToSquare(
  source: HTMLCanvasElement | HTMLVideoElement,
): HTMLCanvasElement {
  const width =
    source instanceof HTMLVideoElement ? source.videoWidth || source.clientWidth : source.width;
  const height =
    source instanceof HTMLVideoElement ? source.videoHeight || source.clientHeight : source.height;
  const size = Math.max(1, Math.min(width, height));
  const sx = Math.floor((width - size) / 2);
  const sy = Math.floor((height - size) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not crop image");
  ctx.drawImage(source, sx, sy, size, size, 0, 0, size, size);
  return canvas;
}

/** Center-crop an image file to 1:1 (native Cap stills, gallery picks). */
export async function cropFileToSquare(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not crop image");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvasToProductImageFile(cropCanvasToSquare(canvas), file.name || undefined);
}

/** Build a JPEG File from a webcam capture canvas. */
export async function canvasToProductImageFile(
  canvas: HTMLCanvasElement,
  fileName = `product-photo-${Date.now()}.jpg`,
): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((next) => resolve(next), "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("Could not capture photo");
  const file = new File([blob], fileName, { type: "image/jpeg", lastModified: Date.now() });
  return compressProductImage(file);
}
