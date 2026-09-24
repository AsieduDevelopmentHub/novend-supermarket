import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const listActiveOrganizations = internalQuery({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").take(500);
    const now = Date.now();
    const out: Array<{
      _id: (typeof orgs)[number]["_id"];
      name: string;
      subscriptionAlert: string | null;
    }> = [];

    for (const org of orgs) {
      if (org.status === "disabled" || org.status === "inactive") continue;
      let subscriptionAlert: string | null = null;
      if (org.status === "trial" && org.trialEndsAt) {
        const days = Math.ceil((org.trialEndsAt - now) / (24 * 60 * 60 * 1000));
        if (days <= 3 && days >= 0) {
          subscriptionAlert =
            days === 0
              ? "Your trial ends today. Open Billing to continue."
              : `Your trial ends in ${days} day${days === 1 ? "" : "s"}.`;
        }
      } else if (org.status === "expired" || org.status === "suspended") {
        subscriptionAlert = "Your plan needs attention. Open Billing to renew.";
      }
      out.push({ _id: org._id, name: org.name, subscriptionAlert });
    }
    return out;
  },
});

export const stockAlertSummary = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .take(2000);
    const stocks = await ctx.db
      .query("branchStock")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .take(5000);
    const lots = await ctx.db
      .query("inventoryLots")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .take(5000);

    const qtyByProduct = new Map<string, number>();
    for (const row of stocks) {
      const key = String(row.productId);
      qtyByProduct.set(key, (qtyByProduct.get(key) ?? 0) + row.quantity);
    }

    let lowCount = 0;
    const productById = new Map(products.map((p) => [String(p._id), p]));
    for (const product of products) {
      if (product.status !== "active") continue;
      const qty = qtyByProduct.get(String(product._id)) ?? product.stockQuantity;
      if (product.lowStockThreshold > 0 && qty <= product.lowStockThreshold) {
        lowCount += 1;
      }
    }

    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const soon = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const expiringProducts = new Set<string>();
    for (const lot of lots) {
      if (lot.quantity <= 0) continue;
      if (lot.expiryDate < todayIso || lot.expiryDate > soon) continue;
      const product = productById.get(String(lot.productId));
      if (!product || product.status !== "active" || product.tracksExpiry !== true) continue;
      expiringProducts.add(String(lot.productId));
    }

    return { lowCount, expiringCount: expiringProducts.size };
  },
});
