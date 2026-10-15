import { v } from "convex/values";
import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";

export const money = v.number();
export const nonNegativeInt = v.number();

export const TEXT_LIMITS = {
  name: 120,
  sku: 64,
  barcode: 80,
  unit: 32,
  phone: 40,
  email: 254,
  short: 200,
  note: 500,
  description: 2000,
  address: 300,
  code: 32,
} as const;

export const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ANGLE_BRACKETS = /[<>]/g;
const SCRIPTY = /(?:javascript:|data:text\/html|vbscript:)/i;

export function assertPositiveMoney(value: number, label = "amount") {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${label}`);
  }
}

export function assertPositiveQuantity(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Quantity must be a positive integer");
  }
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** Trim, strip control chars / angle brackets, enforce length. */
export function sanitizeText(
  value: string,
  label: string,
  maxLength: number,
  options?: { required?: boolean; allowEmpty?: boolean },
): string {
  const required = options?.required ?? true;
  const cleaned = value
    .normalize("NFKC")
    .replace(CONTROL_CHARS, "")
    .replace(ANGLE_BRACKETS, "")
    .trim()
    .replace(/\s+/g, " ");

  if (SCRIPTY.test(cleaned)) {
    throw new Error(`Invalid ${label}`);
  }
  if (!cleaned) {
    if (required && !options?.allowEmpty) throw new Error(`${label} is required`);
    return "";
  }
  if (cleaned.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters`);
  }
  return cleaned;
}

export function sanitizeOptionalText(
  value: string | undefined | null,
  label: string,
  maxLength: number,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  const cleaned = sanitizeText(value, label, maxLength, { required: false, allowEmpty: true });
  return cleaned || undefined;
}

export function sanitizeEmail(value: string | undefined | null): string | undefined {
  const email = sanitizeOptionalText(value, "Email", TEXT_LIMITS.email);
  if (!email) return undefined;
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!ok) throw new Error("Enter a valid email address");
  return email.toLowerCase();
}

export function sanitizePhone(value: string | undefined | null): string | undefined {
  const phone = sanitizeOptionalText(value, "Phone", TEXT_LIMITS.phone);
  if (!phone) return undefined;
  if (!/^[0-9+()\-\s.]{6,40}$/.test(phone)) {
    throw new Error("Enter a valid phone number");
  }
  return phone;
}

export function sanitizeSku(value: string): string {
  const sku = sanitizeText(value, "SKU", TEXT_LIMITS.sku).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(sku)) {
    throw new Error("SKU may only contain letters, numbers, dots, hyphens, and underscores");
  }
  return sku;
}

/** Empty barcode is allowed. Unique-per-org is enforced by the caller. */
export function sanitizeBarcode(value: string | undefined | null): string | undefined {
  if (value == null) return undefined;
  const barcode = sanitizeText(value, "Barcode", TEXT_LIMITS.barcode, {
    required: false,
    allowEmpty: true,
  });
  if (!barcode) return undefined;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(barcode)) {
    throw new Error("Barcode may only contain letters, numbers, dots, hyphens, and underscores");
  }
  return barcode;
}

export function productMatchesLookup(
  product: {
    name: string;
    sku: string;
    barcode?: string | null;
    variantLabel?: string | null;
  },
  search: string,
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  if (product.name.toLowerCase().includes(q)) return true;
  if ((product.variantLabel ?? "").toLowerCase().includes(q)) return true;
  if (product.sku.toLowerCase().includes(q)) return true;
  return (product.barcode ?? "").toLowerCase().includes(q);
}

type MutationLike = Pick<GenericMutationCtx<DataModel>, "db" | "storage">;

/** Reject non-image / oversized uploads and delete the blob when invalid. */
export async function assertStoredImage(ctx: MutationLike, storageId: Id<"_storage">) {
  const meta = await ctx.db.system.get("_storage", storageId);
  if (!meta) throw new Error("Uploaded file not found");

  const contentType = (meta.contentType ?? "").toLowerCase();
  const allowed = (ALLOWED_IMAGE_CONTENT_TYPES as readonly string[]).includes(contentType);
  const tooLarge = typeof meta.size === "number" && meta.size > MAX_IMAGE_BYTES;

  if (!allowed || tooLarge) {
    try {
      await ctx.storage.delete(storageId);
    } catch {
      /* best-effort cleanup */
    }
    if (tooLarge) throw new Error("Image must be 2 MB or smaller");
    throw new Error("Only JPG, PNG, or WebP images are allowed");
  }
}
