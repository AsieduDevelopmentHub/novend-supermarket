import { version as packageVersion } from "../package.json";

export const APP_NAME = "Novend POS";
export const APP_WEB_INSTALL_NAME = "Novend POS";
export const APP_BRAND = "Novend";
export const APP_TAGLINE = "Smart POS. Strong business.";
/** Hosted app version — always the root package.json so About cannot drift. */
export const APP_VERSION = packageVersion;
export const DEFAULT_BRANCH = "Main Branch";

/** Novend's Ghana phone/WhatsApp line, in local dialling format. */
export const NOVEND_LOCAL_CONTACT = "055 525 7482";
/**
 * Fixed vendor line under every receipt (not tenant-editable). ASCII only and at
 * most 32 characters so it stays one line on 58mm ESC/POS printers.
 */
export const RECEIPT_VENDOR_FOOTER = `Powered by ${APP_BRAND} - ${NOVEND_LOCAL_CONTACT}`;

export const ROLES = {
  administrator: "administrator",
  manager: "manager",
  cashier: "cashier",
} as const;
