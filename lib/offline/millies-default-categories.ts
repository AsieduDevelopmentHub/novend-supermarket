/**
 * Common supermarket categories seeded on first setup (and once for empty tills).
 * Local-only ids — never synced to Convex on Millie's.
 */

import { getOfflineDb } from "./db";
import type { MirroredCategory } from "./types";

export const DEFAULT_SUPERMARKET_CATEGORIES = [
  "Fresh produce",
  "Meat & poultry",
  "Fish & seafood",
  "Dairy & eggs",
  "Bakery & bread",
  "Beverages",
  "Water & soft drinks",
  "Snacks & confectionery",
  "Cereals & grains",
  "Rice & pasta",
  "Canned & packaged foods",
  "Cooking oils & spices",
  "Sauces & condiments",
  "Frozen foods",
  "Household & cleaning",
  "Personal care",
  "Baby care",
  "Pet care",
  "Stationery & miscellaneous",
] as const;

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Insert default supermarket categories when the till catalog has none. */
export async function ensureDefaultSupermarketCategories(): Promise<number> {
  const db = await getOfflineDb();
  if (!db) return 0;

  const existing = await db.categories.count();
  if (existing > 0) return 0;

  const rows: MirroredCategory[] = DEFAULT_SUPERMARKET_CATEGORIES.map((name) => {
    const slug = slugify(name);
    return {
      id: `millies-cat-${slug}`,
      name,
      slug,
      isActive: true,
    };
  });

  await db.categories.bulkPut(rows);
  return rows.length;
}
