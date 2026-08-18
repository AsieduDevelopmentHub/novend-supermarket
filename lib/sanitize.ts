/**
 * Client-side text sanitization (mirrors Convex server rules for early UX feedback).
 * Server validation in `convex/shared/validation.ts` remains authoritative.
 */

export const TEXT_LIMITS = {
  name: 120,
  sku: 64,
  unit: 32,
  phone: 40,
  email: 254,
  short: 200,
  note: 500,
  description: 2000,
  address: 300,
  code: 32,
} as const;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ANGLE_BRACKETS = /[<>]/g;

export function sanitizeClientText(value: string, maxLength: number): string {
  return value
    .normalize("NFKC")
    .replace(CONTROL_CHARS, "")
    .replace(ANGLE_BRACKETS, "")
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}
