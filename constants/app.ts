import { version as packageVersion } from "../package.json";

export const APP_NAME = "Millie's Supermarket";
export const APP_WEB_INSTALL_NAME = "Millie's Supermarket";
export const APP_BRAND = "Millie's Supermarket";
export const APP_TAGLINE = "Fresh finds. Friendly service.";
/** Hosted app version — always the root package.json so About cannot drift. */
export const APP_VERSION = packageVersion;
export const DEFAULT_BRANCH = "Main Branch";
/** Single supermarket till — no multi-branch UI. */
export const SINGLE_STORE = true;

/** Novend Ghana phone/WhatsApp — same line as Novend POS receipts. */
export const NOVEND_LOCAL_CONTACT = "055 525 7482";
/**
 * Fixed vendor line under every receipt (not tenant-editable).
 * Identical to Novend POS: ASCII, ≤32 chars for 58mm ESC/POS.
 */
export const RECEIPT_VENDOR_FOOTER = `Powered by Novend - ${NOVEND_LOCAL_CONTACT}`;
/**
 * Legacy alias kept so older imports (and hot-reload) do not break the build.
 * Phone lives on {@link RECEIPT_VENDOR_FOOTER}; do not print this as a second line.
 */
export const RECEIPT_VENDOR_CONTACT = NOVEND_LOCAL_CONTACT;
/** Support email shown on About / license UI. */
export const NOVEND_CONTACT_EMAIL = "support@novendpos.app";
export const NOVEND_CONTACT_SITE = "https://www.novendpos.app";

export const ROLES = {
  administrator: "administrator",
  manager: "manager",
  cashier: "cashier",
} as const;
