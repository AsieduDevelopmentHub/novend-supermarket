import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("held sales UI contract", () => {
  const salesView = readFileSync(
    resolve(process.cwd(), "features/sales/components/sales-view.tsx"),
    "utf8",
  );
  const heldPanel = readFileSync(
    resolve(process.cwd(), "features/sales/components/held-sales-panel.tsx"),
    "utf8",
  );

  it("keeps Held Sales near Current Sale, not under the product catalogue", () => {
    expect(salesView).toContain("HeldSalesPanel");
    expect(salesView).toContain("Current Sale");
    expect(heldPanel).toContain("held-sales-trigger");
    expect(heldPanel).toContain("held-sales-badge");

    const catalogIdx = salesView.indexOf("<SalesProductCatalog");
    const heldBelowCatalogCard = salesView.indexOf(
      '<CardTitle className="text-base">Held sales</CardTitle>',
    );
    expect(catalogIdx).toBeGreaterThan(-1);
    expect(heldBelowCatalogCard).toBe(-1);

    const currentSaleIdx = salesView.indexOf("Current Sale");
    const heldPanelNearSale = salesView.indexOf("<HeldSalesPanel", currentSaleIdx);
    expect(heldPanelNearSale).toBeGreaterThan(currentSaleIdx);
  });

  it("exposes a badge-capable Held Sales control with a11y labels", () => {
    expect(heldPanel).toContain("held-sales-badge");
    expect(heldPanel).toContain("Held sales,");
    expect(heldPanel).toContain('aria-label={');
    expect(heldPanel).toContain("Replace");
    expect(heldPanel).toContain("Merge");
  });
});

describe("tracksInventory list visibility", () => {
  const lists = readFileSync(resolve(process.cwd(), "hooks/use-offline-lists.ts"), "utf8");
  const productsView = readFileSync(
    resolve(process.cwd(), "features/products/components/products-view.tsx"),
    "utf8",
  );
  const productForm = readFileSync(
    resolve(process.cwd(), "features/products/components/product-form-dialog.tsx"),
    "utf8",
  );
  const productDetail = readFileSync(
    resolve(process.cwd(), "features/products/components/product-detail-view.tsx"),
    "utf8",
  );

  it("passes tracksInventory through ProductListRow mapping", () => {
    expect(lists).toContain("tracksInventory?: boolean");
    expect(lists).toContain("tracksInventory: row.tracksInventory !== false");
  });

  it("hides stock qty and In Stock badges for non-stock catalogue rows", () => {
    expect(productsView).toContain("tracksInventory === false");
    expect(productsView).toContain("Non-stock");
    expect(productsView).toContain("Catalogue");
    expect(productsView).toContain("Availability");
    expect(productsView).not.toMatch(/SelectItem value="active">In stock</);
  });

  it("renames catalogue status Active and scopes expiry UI to tracksExpiry", () => {
    expect(productForm).toContain('<SelectItem value="active">Active</SelectItem>');
    expect(productForm).not.toContain('<SelectItem value="active">In stock</SelectItem>');
    expect(productDetail).toContain("tracksInventory");
    expect(productDetail).toContain("Non-stock");
    expect(productDetail).toMatch(/tracksInventory && tracksExpiry/);
  });
});

describe("searchable select migration (hospitality)", () => {
  it("uses SearchableSelect for dining product and branch pickers", () => {
    const dining = readFileSync(
      resolve(process.cwd(), "features/dining/components/dining-floor-view.tsx"),
      "utf8",
    );
    expect(dining).toContain("SearchableSelect");
    expect(dining).toContain("Search products");
    expect(dining).toContain("Search branches");
  });

  it("uses SearchableSelect for hotel guest, product, customer, and room pickers", () => {
    const rooms = readFileSync(
      resolve(process.cwd(), "features/hotel/components/rooms-board-view.tsx"),
      "utf8",
    );
    const reservations = readFileSync(
      resolve(process.cwd(), "features/hotel/components/reservations-view.tsx"),
      "utf8",
    );
    expect(rooms).toContain("SearchableSelect");
    expect(rooms).toContain("Search guests");
    expect(rooms).toContain("Search products");
    expect(reservations).toContain("SearchableSelect");
    expect(reservations).toContain("Search guests");
    expect(reservations).toContain("Search rooms");
  });
});

describe("hospitality checkout appears in orders", () => {
  it("writes the Convex sale into the Dexie orders mirror", () => {
    const rooms = readFileSync(
      resolve(process.cwd(), "features/hotel/components/rooms-board-view.tsx"),
      "utf8",
    );
    const dining = readFileSync(
      resolve(process.cwd(), "features/dining/components/dining-floor-view.tsx"),
      "utf8",
    );
    const sync = readFileSync(resolve(process.cwd(), "lib/offline/sync-engine.ts"), "utf8");
    expect(rooms).toContain("mirrorServerSaleReceipt(result)");
    expect(dining).toContain("mirrorServerSaleReceipt(result)");
    expect(sync).toContain("mirrorServerSaleReceipt(paid)");
    expect(sync).toContain("mirrorServerSaleReceipt(checkedOut)");
  });
});
