/**
 * Central business terminology — industry defaults + optional admin overrides.
 * UI should resolve labels via `resolveBusinessTerms` / `useBusinessTerms`, not hardcoded strings.
 */

import type { IndustryProfile } from "./businessCapabilities";

export const BUSINESS_TERM_KEYS = [
  "product",
  "product_plural",
  "customer",
  "customer_plural",
  "sale",
  "order",
  "branch",
  "branch_plural",
  "kitchen",
  "floor",
  "table",
  "table_plural",
  "check",
  "check_plural",
  "ticket",
  "ticket_plural",
  "room",
  "room_plural",
  "reservation",
  "reservation_plural",
  "folio",
  "folio_plural",
  "guest",
  "guest_plural",
] as const;

export type BusinessTermKey = (typeof BUSINESS_TERM_KEYS)[number];

export type BusinessTermsMap = Record<BusinessTermKey, string>;

/** Partial overrides stored under settings key `business.terminology`. */
export type BusinessTerminologyOverrides = Partial<BusinessTermsMap>;

const RETAIL_TERMS: BusinessTermsMap = {
  product: "Product",
  product_plural: "Products",
  customer: "Customer",
  customer_plural: "Customers",
  sale: "Sale",
  order: "Order",
  branch: "Branch",
  branch_plural: "Branches",
  kitchen: "Kitchen",
  floor: "Floor",
  table: "Table",
  table_plural: "Tables",
  check: "Check",
  check_plural: "Checks",
  ticket: "Ticket",
  ticket_plural: "Tickets",
  room: "Room",
  room_plural: "Rooms",
  reservation: "Reservation",
  reservation_plural: "Reservations",
  folio: "Folio",
  folio_plural: "Folios",
  guest: "Customer",
  guest_plural: "Customers",
};

const WHOLESALE_TERMS: BusinessTermsMap = {
  ...RETAIL_TERMS,
  sale: "Sale",
  order: "Order",
  customer: "Buyer",
  customer_plural: "Buyers",
  guest: "Buyer",
  guest_plural: "Buyers",
};

const SUPERMARKET_TERMS: BusinessTermsMap = {
  ...RETAIL_TERMS,
};

const PHARMACY_TERMS: BusinessTermsMap = {
  ...RETAIL_TERMS,
  product: "Medicine",
  product_plural: "Medicines",
  customer: "Patient",
  customer_plural: "Patients",
  guest: "Patient",
  guest_plural: "Patients",
};

const RESTAURANT_TERMS: BusinessTermsMap = {
  ...RETAIL_TERMS,
  product: "Menu item",
  product_plural: "Menu items",
  customer: "Guest",
  customer_plural: "Guests",
  guest: "Guest",
  guest_plural: "Guests",
  sale: "Sale",
  order: "Order",
  kitchen: "Kitchen",
  floor: "Floor",
  table: "Table",
  table_plural: "Tables",
  check: "Check",
  check_plural: "Checks",
  ticket: "Kitchen ticket",
  ticket_plural: "Kitchen tickets",
};

const BAR_TERMS: BusinessTermsMap = {
  ...RETAIL_TERMS,
  product: "Drink",
  product_plural: "Drinks",
  customer: "Patron",
  customer_plural: "Patrons",
  guest: "Patron",
  guest_plural: "Patrons",
  sale: "Sale",
  order: "Order",
  kitchen: "Bar queue",
  floor: "Floor",
  table: "Table",
  table_plural: "Tables",
  check: "Tab",
  check_plural: "Tabs",
  ticket: "Bar ticket",
  ticket_plural: "Bar tickets",
};

const HOTEL_TERMS: BusinessTermsMap = {
  ...RETAIL_TERMS,
  product: "Service",
  product_plural: "Services",
  customer: "Guest",
  customer_plural: "Guests",
  guest: "Guest",
  guest_plural: "Guests",
  sale: "Sale",
  order: "Order",
  branch: "Property",
  branch_plural: "Properties",
  kitchen: "Kitchen",
  floor: "Floor",
  table: "Table",
  table_plural: "Tables",
  check: "Folio",
  check_plural: "Folios",
  ticket: "Ticket",
  ticket_plural: "Tickets",
  room: "Room",
  room_plural: "Rooms",
  reservation: "Reservation",
  reservation_plural: "Reservations",
  folio: "Folio",
  folio_plural: "Folios",
};

/** Fallback for unknown / custom profiles. */
export const DEFAULT_BUSINESS_TERMS: BusinessTermsMap = { ...RETAIL_TERMS };

/**
 * Industry pack term defaults. Profiles without a dedicated pack fall back to retail.
 */
const FASHION_TERMS: BusinessTermsMap = {
  ...RETAIL_TERMS,
  product: "Style",
  product_plural: "Styles",
};

const COSMETICS_TERMS: BusinessTermsMap = {
  ...RETAIL_TERMS,
  product: "SKU",
  product_plural: "SKUs",
};

export const INDUSTRY_TERM_DEFAULTS: Record<IndustryProfile, BusinessTermsMap> = {
  retail: RETAIL_TERMS,
  wholesale: WHOLESALE_TERMS,
  supermarket: SUPERMARKET_TERMS,
  cold_store: RETAIL_TERMS,
  electronics: RETAIL_TERMS,
  pharmacy: PHARMACY_TERMS,
  restaurant: RESTAURANT_TERMS,
  bar: BAR_TERMS,
  hotel: HOTEL_TERMS,
  fashion: FASHION_TERMS,
  cosmetics: COSMETICS_TERMS,
  convenience: RETAIL_TERMS,
  hardware: RETAIL_TERMS,
  stationery: RETAIL_TERMS,
  custom: RETAIL_TERMS,
};

export function isBusinessTermKey(value: string): value is BusinessTermKey {
  return (BUSINESS_TERM_KEYS as readonly string[]).includes(value);
}

export function termsForIndustry(profile: IndustryProfile | string | null | undefined): BusinessTermsMap {
  if (profile && profile in INDUSTRY_TERM_DEFAULTS) {
    return { ...INDUSTRY_TERM_DEFAULTS[profile as IndustryProfile] };
  }
  return { ...DEFAULT_BUSINESS_TERMS };
}

/** Merge industry defaults with admin overrides (empty/whitespace values ignored). */
export function resolveBusinessTerms(
  profile: IndustryProfile | string | null | undefined,
  overrides?: BusinessTerminologyOverrides | null,
): BusinessTermsMap {
  const base = termsForIndustry(profile);
  if (!overrides) return base;
  const next = { ...base };
  for (const key of BUSINESS_TERM_KEYS) {
    const value = overrides[key];
    if (typeof value === "string" && value.trim()) {
      next[key] = value.trim();
    }
  }
  return next;
}

export function parseBusinessTerminologyOverrides(
  raw: string | undefined | null,
): BusinessTerminologyOverrides {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: BusinessTerminologyOverrides = {};
    for (const key of BUSINESS_TERM_KEYS) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) {
        out[key] = value.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function sanitizeBusinessTerminologyOverrides(
  input: BusinessTerminologyOverrides | null | undefined,
): BusinessTerminologyOverrides {
  if (!input) return {};
  const out: BusinessTerminologyOverrides = {};
  for (const key of BUSINESS_TERM_KEYS) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      out[key] = value.trim().slice(0, 64);
    }
  }
  return out;
}

/** Nav href → term key for industry-sensitive titles. */
const NAV_TERM_BY_HREF: Record<string, BusinessTermKey> = {
  "/floor": "floor",
  "/kitchen": "kitchen",
  "/rooms": "room_plural",
  "/reservations": "reservation_plural",
  "/products": "product_plural",
  "/customers": "customer_plural",
  "/branches": "branch_plural",
};

export function resolveNavTitleFromTerms(
  href: string,
  terms: BusinessTermsMap,
  fallbackTitle: string,
): string {
  const key = NAV_TERM_BY_HREF[href];
  if (!key) return fallbackTitle;
  return terms[key] || fallbackTitle;
}

/** POS header copy — hospitality-aware; retail/wholesale keep classic wording. */
export function salesViewDescription(
  profile: IndustryProfile | string | null | undefined,
  terms: BusinessTermsMap,
): string {
  switch (profile) {
    case "restaurant":
      return `Create a new ${terms.sale.toLowerCase()} or open a ${terms.check.toLowerCase()} from the ${terms.floor.toLowerCase()}.`;
    case "bar":
      return `Create a new ${terms.sale.toLowerCase()} or open a ${terms.check.toLowerCase()} from the ${terms.floor.toLowerCase()}.`;
    case "hotel":
      return `Create a new ${terms.sale.toLowerCase()} or post charges to a ${terms.folio.toLowerCase()}.`;
    case "wholesale":
      return "Create a new wholesale or retail sale.";
    default:
      return "Create a new wholesale or retail sale.";
  }
}

/** Dashboard subtitle — hospitality-aware when stock ops are hidden. */
export function dashboardViewDescription(input: {
  profile: IndustryProfile | string | null | undefined;
  showOps: boolean;
  showStockOps: boolean;
  opsWindowDays: number;
  opsPeriodLabel?: string;
  terms: BusinessTermsMap;
}): string {
  const { profile, showOps, showStockOps, opsWindowDays, opsPeriodLabel, terms } = input;
  if (!showOps) return "Your sales activity today";
  const period = opsPeriodLabel ?? `Last ${opsWindowDays} days`;
  if (showStockOps) {
    return `${period} of sales, plus stock alerts`;
  }
  switch (profile) {
    case "restaurant":
      return `${period} of sales — open ${terms.check_plural.toLowerCase()} live on the ${terms.floor.toLowerCase()}`;
    case "bar":
      return `${period} of sales — open ${terms.check_plural.toLowerCase()} live on the ${terms.floor.toLowerCase()}`;
    case "hotel":
      return `${period} of sales — ${terms.room_plural.toLowerCase()}, ${terms.reservation_plural.toLowerCase()}, and ${terms.folio_plural.toLowerCase()}`;
    default:
      return `${period} of sales`;
  }
}

/** Floor page header / description. */
export function floorViewCopy(terms: BusinessTermsMap): { title: string; description: string } {
  return {
    title: terms.floor,
    description: `Open ${terms.check_plural.toLowerCase()} by ${terms.table.toLowerCase()}, send to ${terms.kitchen.toLowerCase()}, then pay.`,
  };
}

/** Kitchen / bar queue page header / description. */
export function kitchenViewCopy(terms: BusinessTermsMap): { title: string; description: string } {
  return {
    title: terms.kitchen,
    description: `Open ${terms.ticket_plural.toLowerCase()} from the ${terms.floor.toLowerCase()}.`,
  };
}

/** Ops capabilities that warn when turned off while previously enabled. */
export const OPS_CAPABILITY_DISABLE_WARNING_KEYS = [
  "tables_orders",
  "kitchen_tickets",
  "rooms_folio",
  "reservations",
] as const;

export function opsDisableWarningCopy(
  disabling: readonly string[],
): string | null {
  if (disabling.length === 0) return null;
  return (
    "Turning off Floor, Kitchen, Rooms, or Reservations hides those screens. " +
    "Existing open checks, tickets, rooms, and reservations are kept but may be harder to manage until the capability is re-enabled."
  );
}
