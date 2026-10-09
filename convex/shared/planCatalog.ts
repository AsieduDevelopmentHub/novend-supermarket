/**
 * Load plan definitions from the `plans` table with seed fallback.
 */

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  DEFAULT_LIST_PRICE_MARKUP_PERCENT,
  listPriceFromReal,
  planDefinitionFromRow,
  resolvePlan,
  type PlanDefinition,
  type PlanKey,
} from "./plans";

type Ctx = QueryCtx | MutationCtx;

export async function loadPlanDefinition(
  ctx: Ctx,
  planKey: PlanKey | null | undefined,
): Promise<PlanDefinition> {
  if (!planKey) return resolvePlan(undefined);
  const row = await ctx.db
    .query("plans")
    .withIndex("by_key", (q) => q.eq("key", planKey))
    .unique();
  if (!row) return resolvePlan(planKey);
  return planDefinitionFromRow(row);
}

export async function loadAllPlanDefinitions(ctx: Ctx): Promise<PlanDefinition[]> {
  const rows = await ctx.db.query("plans").collect();
  if (rows.length === 0) {
    const { PLAN_LIST } = await import("./plans");
    return [...PLAN_LIST];
  }
  return rows
    .map((row) => planDefinitionFromRow(row))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function loadSellablePlanDefinitions(ctx: Ctx): Promise<PlanDefinition[]> {
  const all = await loadAllPlanDefinitions(ctx);
  return all.filter(
    (plan) =>
      !plan.archived &&
      !plan.legacy &&
      !plan.isLifetime &&
      plan.selfServe !== false,
  );
}

export async function loadMarketingPlanDefinitions(ctx: Ctx): Promise<PlanDefinition[]> {
  const all = await loadAllPlanDefinitions(ctx);
  return all.filter(
    (plan) => !plan.archived && !plan.legacy && plan.marketingVisible && !plan.isLifetime,
  );
}

export async function loadListPriceMarkupPercent(ctx: Ctx): Promise<number> {
  const row = await ctx.db
    .query("billingSettings")
    .withIndex("by_singleton", (q) => q.eq("singleton", true))
    .unique();
  return row?.listPriceMarkupPercent ?? DEFAULT_LIST_PRICE_MARKUP_PERCENT;
}

export type PublicPlanCard = {
  key: string;
  name: string;
  tagline: string;
  audience: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  listMonthlyPrice: number | null;
  listYearlyPrice: number | null;
  priceFrom: boolean;
  featured: boolean;
  homepageHighlight: boolean;
  sortOrder: number;
  limits: PlanDefinition["limits"];
  features: string[];
  variableBackup: boolean;
  selfServe: boolean;
};

export function toPublicPlanCard(
  plan: PlanDefinition,
  markupPercent: number,
): PublicPlanCard {
  return {
    key: plan.key,
    name: plan.name,
    tagline: plan.tagline,
    audience: plan.audience,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    listMonthlyPrice:
      plan.monthlyPrice != null ? listPriceFromReal(plan.monthlyPrice, markupPercent) : null,
    listYearlyPrice:
      plan.yearlyPrice != null ? listPriceFromReal(plan.yearlyPrice, markupPercent) : null,
    priceFrom: plan.priceFrom,
    featured: plan.featured,
    homepageHighlight: plan.homepageHighlight,
    sortOrder: plan.sortOrder,
    limits: plan.limits,
    features: plan.features,
    variableBackup: plan.variableBackup,
    selfServe: plan.selfServe,
  };
}

export function planRowDocsByKey(rows: Doc<"plans">[]): Map<string, Doc<"plans">> {
  return new Map(rows.map((row) => [row.key, row]));
}
