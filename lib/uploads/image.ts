/**
 * Client-side image upload checks before posting to Convex storage.
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
