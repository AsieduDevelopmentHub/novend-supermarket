import { version as packageVersion } from "../package.json";

export const APP_NAME = "Novend POS";
export const APP_WEB_INSTALL_NAME = "Novend POS";
export const APP_BRAND = "Novend";
export const APP_TAGLINE = "Smart POS. Strong business.";
/** Hosted app version — always the root package.json so About cannot drift. */
export const APP_VERSION = packageVersion;
export const DEFAULT_BRANCH = "Main Branch";

export const ROLES = {
  administrator: "administrator",
  manager: "manager",
  cashier: "cashier",
} as const;
