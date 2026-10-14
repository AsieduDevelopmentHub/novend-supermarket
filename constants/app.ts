import { version as packageVersion } from "../package.json";

export const APP_NAME = "Milliesmart";
export const APP_WEB_INSTALL_NAME = "Milliesmart";
export const APP_BRAND = "Milliesmart";
export const APP_TAGLINE = "Smart POS. Strong business.";
/** Hosted app version — always the root package.json so About cannot drift. */
export const APP_VERSION = packageVersion;
export const DEFAULT_BRANCH = "Main Branch";
/** Single supermarket till — no multi-branch UI. */
export const SINGLE_STORE = true;

/**
 * Fixed vendor line under every receipt (not tenant-editable). ASCII only and at
 * most 32 characters so it stays one line on 58mm ESC/POS printers.
 */
export const RECEIPT_VENDOR_FOOTER = "Powered by Novend POS";

export const ROLES = {
  administrator: "administrator",
  manager: "manager",
  cashier: "cashier",
} as const;
