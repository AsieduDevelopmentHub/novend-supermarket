import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
  assertOrgDoc,
  assertStaffProfileAccess,
  canManagePayroll,
  requireRole,
} from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import { rememberClientOp, replayClientOp } from "./shared/clientOps";
import { resolveLicense } from "./shared/entitlements";
import { planCapabilities, capabilityDeniedMessage } from "./shared/capabilities";
import { assertPositiveMoney, roundMoney, sanitizeText, TEXT_LIMITS } from "./shared/validation";
import { completedReturnsInRange } from "./shared/returns";
import {
  collectExpensesInOccurredAtRange,
  collectSalesInCompletedAtRange,
} from "./shared/salesRange";
import {
  assertPayPeriodKey,
  computeCommissionEarned,
  currentPayPeriodKey,
  isPayrollExpense,
  periodBounds,
  type CommissionBasis,
  type SalaryFrequency,
} from "./shared/payroll";
import { enrichAuditLogRow } from "./shared/auditEnrichment";
import { commissionBasisValidator, salaryFrequencyValidator } from "./schema";

async function requirePayrollAdmin(ctx: Parameters<typeof requireRole>[0]) {
  const session = await requireRole(ctx, ["administrator"]);
  if (!canManagePayroll(session.profile)) throw new Error("Forbidden");
  const license = await resolveLicense(ctx, session.organization);
  const caps = planCapabilities(license.planKey, license.limits);
  if (!caps.canManageStaffCompensation) {
    throw new Error(capabilityDeniedMessage("canManageStaffCompensation", license.plan.name));
  }
  return { ...session, license };
}

async function loadTargetProfile(
  ctx: Parameters<typeof requireRole>[0],
  actor: Doc<"profiles">,
  organizationId: Id<"organizations">,
  profileId: Id<"profiles">,
) {
  const target = await ctx.db.get(profileId);
  assertOrgDoc(target, organizationId);
  assertStaffProfileAccess(actor, target);
  return target;
}

async function compensationForProfile(
  ctx: Parameters<typeof requireRole>[0],
  organizationId: Id<"organizations">,
  profileId: Id<"profiles">,
) {
  return await ctx.db
    .query("staffCompensation")
    .withIndex("by_profile", (q) => q.eq("profileId", profileId))
    .first()
    .then(async (row) => {
      if (row && row.organizationId !== organizationId) return null;
      return row;
    });
}

function emptyCompensation() {
  return {
    salaryAmount: null as number | null,
    salaryFrequency: "monthly" as SalaryFrequency,
    commissionRate: null as number | null,
    commissionBasis: "net" as CommissionBasis,
  };
}

async function paidPayrollExpenses(
  ctx: Parameters<typeof requireRole>[0],
  organizationId: Id<"organizations">,
  profileId: Id<"profiles">,
  sourceKind: "salary" | "commission",
  payPeriodKey?: string,
) {
  const rows = await ctx.db
    .query("expenses")
    .withIndex("by_beneficiary", (q) =>
      q.eq("organizationId", organizationId).eq("beneficiaryProfileId", profileId),
    )
    .collect();
  return rows.filter(
    (row) =>
      row.sourceKind === sourceKind &&
      row.paymentStatus !== "void" &&
      (payPeriodKey === undefined || row.payPeriodKey === payPeriodKey),
  );
}

async function cashierPeriodTotals(
  ctx: Parameters<typeof requireRole>[0],
  args: {
    organizationId: Id<"organizations">;
    cashierUserId: Id<"users">;
    startDate: number;
    endDate: number;
  },
) {
  const sales = (
    await collectSalesInCompletedAtRange(ctx, args.organizationId, args.startDate, args.endDate)
  ).filter((sale) => sale.cashierId === args.cashierUserId);
  const saleIds = new Set(sales.map((sale) => sale._id));
  const returns = await completedReturnsInRange(ctx, {
    startDate: args.startDate,
    endDate: args.endDate,
    organizationId: args.organizationId,
    cashierSaleIds: saleIds,
  });
  const grossSales = roundMoney(sales.reduce((sum, sale) => sum + sale.total, 0));
  const refundTotal = roundMoney(returns.reduce((sum, row) => sum + row.refundAmount, 0));
  return {
    sales,
    returns,
    orderCount: sales.length,
    grossSales,
    refundTotal,
    netSales: roundMoney(Math.max(0, grossSales - refundTotal)),
    returnCount: returns.length,
  };
}

export const getCompensation = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    const session = await requirePayrollAdmin(ctx);
    const target = await loadTargetProfile(
      ctx,
      session.profile,
      session.organizationId,
      args.profileId,
    );
    const row = await compensationForProfile(ctx, session.organizationId, target._id);
    const defaults = emptyCompensation();
    return {
      profileId: target._id,
      salaryAmount: row?.salaryAmount ?? defaults.salaryAmount,
      salaryFrequency: (row?.salaryFrequency ?? defaults.salaryFrequency) as SalaryFrequency,
      commissionRate: row?.commissionRate ?? defaults.commissionRate,
      commissionBasis: (row?.commissionBasis ?? defaults.commissionBasis) as CommissionBasis,
      currentPeriodKey: currentPayPeriodKey((row?.salaryFrequency ?? "monthly") as SalaryFrequency),
    };
  },
});

export const upsertCompensation = mutation({
  args: {
    profileId: v.id("profiles"),
    salaryAmount: v.optional(v.number()),
    salaryFrequency: salaryFrequencyValidator,
    commissionRate: v.optional(v.number()),
    commissionBasis: commissionBasisValidator,
  },
  handler: async (ctx, args) => {
    const session = await requirePayrollAdmin(ctx);
    const target = await loadTargetProfile(
      ctx,
      session.profile,
      session.organizationId,
      args.profileId,
    );
    if (args.salaryAmount !== undefined) {
      assertPositiveMoney(args.salaryAmount, "salary");
    }
    if (args.commissionRate !== undefined) {
      if (
        !Number.isFinite(args.commissionRate) ||
        args.commissionRate < 0 ||
        args.commissionRate > 100
      ) {
        throw new Error("Commission rate must be between 0 and 100 percent");
      }
    }
    const existing = await compensationForProfile(ctx, session.organizationId, target._id);
    const patch = {
      organizationId: session.organizationId,
      profileId: target._id,
      salaryAmount:
        args.salaryAmount === undefined ? existing?.salaryAmount : roundMoney(args.salaryAmount),
      salaryFrequency: args.salaryFrequency,
      commissionRate:
        args.commissionRate === undefined
          ? existing?.commissionRate
          : roundMoney(args.commissionRate),
      commissionBasis: args.commissionBasis,
      updatedBy: session.userId,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("staffCompensation", patch);
    }
    await writeAuditLog(ctx, {
      actorId: session.userId,
      action: existing ? "update_staff_compensation" : "create_staff_compensation",
      entityType: "staffCompensation",
      entityId: target._id,
      metadata: {
        salaryAmount: patch.salaryAmount ?? null,
        salaryFrequency: patch.salaryFrequency,
        commissionRate: patch.commissionRate ?? null,
        commissionBasis: patch.commissionBasis,
      },
    });
  },
});

export const paySalary = mutation({
  args: {
    profileId: v.id("profiles"),
    payPeriodKey: v.string(),
    clientOperationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requirePayrollAdmin(ctx);
    const replayed = await replayClientOp<Id<"expenses">>(
      ctx,
      session.organizationId,
      args.clientOperationId,
    );
    if (replayed) return replayed;
    const target = await loadTargetProfile(
      ctx,
      session.profile,
      session.organizationId,
      args.profileId,
    );
    const compensation = await compensationForProfile(ctx, session.organizationId, target._id);
    const amount = compensation?.salaryAmount ?? 0;
    if (!amount || amount <= 0) {
      throw new Error("Set a salary amount before recording a payment.");
    }
    const frequency = (compensation?.salaryFrequency ?? "monthly") as SalaryFrequency;
    const payPeriodKey = assertPayPeriodKey(args.payPeriodKey, frequency);
    const already = await paidPayrollExpenses(
      ctx,
      session.organizationId,
      target._id,
      "salary",
      payPeriodKey,
    );
    if (already.length > 0) {
      throw new Error(`Salary for ${payPeriodKey} is already recorded.`);
    }
    const { end } = periodBounds(payPeriodKey);
    if (!target.branchId) throw new Error("This user has no branch assignment");
    const id = await ctx.db.insert("expenses", {
      organizationId: session.organizationId,
      amount: roundMoney(amount),
      category: "salaries",
      occurredAt: Math.min(end, Date.now()),
      description: sanitizeText(
        `Salary ${payPeriodKey} — ${target.name}`,
        "Description",
        TEXT_LIMITS.note,
      ),
      recordedBy: session.userId,
      branchId: target.branchId,
      createdAt: Date.now(),
      beneficiaryProfileId: target._id,
      payPeriodKey,
      paymentStatus: "paid",
      sourceKind: "salary",
    });
    await writeAuditLog(ctx, {
      actorId: session.userId,
      action: "pay_salary",
      entityType: "expenses",
      entityId: id,
      metadata: {
        profileId: target._id,
        payPeriodKey,
        amount,
        previousState: "unpaid",
        newState: "paid",
      },
    });
    await rememberClientOp(ctx, {
      organizationId: session.organizationId,
      clientOperationId: args.clientOperationId,
      kind: "pay_salary",
      result: id,
    });
    return id;
  },
});

export const payCommission = mutation({
  args: {
    profileId: v.id("profiles"),
    payPeriodKey: v.string(),
    clientOperationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requirePayrollAdmin(ctx);
    const replayed = await replayClientOp<Id<"expenses">>(
      ctx,
      session.organizationId,
      args.clientOperationId,
    );
    if (replayed) return replayed;
    const target = await loadTargetProfile(
      ctx,
      session.profile,
      session.organizationId,
      args.profileId,
    );
    const compensation = await compensationForProfile(ctx, session.organizationId, target._id);
    const rate = compensation?.commissionRate ?? 0;
    if (!rate || rate <= 0) {
      throw new Error("Set a commission rate before recording a payment.");
    }
    const frequency = (compensation?.salaryFrequency ?? "monthly") as SalaryFrequency;
    const payPeriodKey = assertPayPeriodKey(args.payPeriodKey, frequency);
    const { start, end } = periodBounds(payPeriodKey);
    const totals = await cashierPeriodTotals(ctx, {
      organizationId: session.organizationId,
      cashierUserId: target.userId,
      startDate: start,
      endDate: end,
    });
    const earned = computeCommissionEarned({
      netSales: totals.netSales,
      grossSales: totals.grossSales,
      rate,
      basis: (compensation?.commissionBasis ?? "net") as CommissionBasis,
    });
    const paidRows = await paidPayrollExpenses(
      ctx,
      session.organizationId,
      target._id,
      "commission",
      payPeriodKey,
    );
    const alreadyPaid = roundMoney(paidRows.reduce((sum, row) => sum + row.amount, 0));
    const outstanding = roundMoney(Math.max(0, earned - alreadyPaid));
    if (outstanding <= 0) {
      throw new Error(`No outstanding commission for ${payPeriodKey}.`);
    }
    if (!target.branchId) throw new Error("This user has no branch assignment");
    const id = await ctx.db.insert("expenses", {
      organizationId: session.organizationId,
      amount: outstanding,
      category: "commissions",
      occurredAt: Math.min(end, Date.now()),
      description: sanitizeText(
        `Commission ${payPeriodKey} — ${target.name}`,
        "Description",
        TEXT_LIMITS.note,
      ),
      recordedBy: session.userId,
      branchId: target.branchId,
      createdAt: Date.now(),
      beneficiaryProfileId: target._id,
      payPeriodKey,
      paymentStatus: "paid",
      sourceKind: "commission",
    });
    await writeAuditLog(ctx, {
      actorId: session.userId,
      action: "pay_commission",
      entityType: "expenses",
      entityId: id,
      metadata: {
        profileId: target._id,
        payPeriodKey,
        earned,
        alreadyPaid,
        amount: outstanding,
        previousState: "unpaid",
        newState: "paid",
      },
    });
    await rememberClientOp(ctx, {
      organizationId: session.organizationId,
      clientOperationId: args.clientOperationId,
      kind: "pay_commission",
      result: id,
    });
    return id;
  },
});

export const monthRecord = query({
  args: {
    profileId: v.id("profiles"),
    payPeriodKey: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requirePayrollAdmin(ctx);
    const target = await loadTargetProfile(
      ctx,
      session.profile,
      session.organizationId,
      args.profileId,
    );
    const compensation = await compensationForProfile(ctx, session.organizationId, target._id);
    const frequency = (compensation?.salaryFrequency ?? "monthly") as SalaryFrequency;
    const payPeriodKey = assertPayPeriodKey(args.payPeriodKey, frequency);
    const { start, end } = periodBounds(payPeriodKey);
    const totals = await cashierPeriodTotals(ctx, {
      organizationId: session.organizationId,
      cashierUserId: target.userId,
      startDate: start,
      endDate: end,
    });
    const salaryDue = compensation?.salaryAmount ?? 0;
    const salaryRows = await paidPayrollExpenses(
      ctx,
      session.organizationId,
      target._id,
      "salary",
      payPeriodKey,
    );
    const commissionRows = await paidPayrollExpenses(
      ctx,
      session.organizationId,
      target._id,
      "commission",
      payPeriodKey,
    );
    const allBeneficiary = await ctx.db
      .query("expenses")
      .withIndex("by_beneficiary", (q) =>
        q.eq("organizationId", session.organizationId).eq("beneficiaryProfileId", target._id),
      )
      .collect();
    const otherExpenses = roundMoney(
      allBeneficiary
        .filter(
          (row) =>
            row.paymentStatus !== "void" &&
            !isPayrollExpense(row) &&
            row.occurredAt >= start &&
            row.occurredAt <= end,
        )
        .reduce((sum, row) => sum + row.amount, 0),
    );
    const salaryPaid = roundMoney(salaryRows.reduce((sum, row) => sum + row.amount, 0));
    const commissionPaid = roundMoney(commissionRows.reduce((sum, row) => sum + row.amount, 0));
    const commissionEarned = computeCommissionEarned({
      netSales: totals.netSales,
      grossSales: totals.grossSales,
      rate: compensation?.commissionRate ?? 0,
      basis: (compensation?.commissionBasis ?? "net") as CommissionBasis,
    });
    return {
      profileId: target._id,
      name: target.name,
      payPeriodKey,
      salaryDue,
      salaryPaid,
      salaryStatus: salaryDue > 0 && salaryPaid >= salaryDue ? "paid" : "unpaid",
      commissionEarned,
      commissionPaid,
      commissionOutstanding: roundMoney(Math.max(0, commissionEarned - commissionPaid)),
      otherExpenses,
      totalStaffCost: roundMoney(salaryPaid + commissionPaid + otherExpenses),
      orderCount: totals.orderCount,
      netSales: totals.netSales,
      expenses: [...salaryRows, ...commissionRows].map((row) => ({
        id: row._id,
        amount: row.amount,
        category: row.category,
        sourceKind: row.sourceKind ?? null,
        occurredAt: row.occurredAt,
        description: row.description ?? null,
        payPeriodKey: row.payPeriodKey ?? null,
      })),
    };
  },
});

export const monthRoster = query({
  args: { payPeriodKey: v.string() },
  handler: async (ctx, args) => {
    const session = await requirePayrollAdmin(ctx);
    const payPeriodKey = assertPayPeriodKey(args.payPeriodKey, "monthly");
    const { start, end } = periodBounds(payPeriodKey);
    const [profiles, compensations, salaryExpenses, commissionExpenses, sales, returns] =
      await Promise.all([
        ctx.db
          .query("profiles")
          .withIndex("by_organization", (q) => q.eq("organizationId", session.organizationId))
          .collect(),
        ctx.db
          .query("staffCompensation")
          .withIndex("by_organization", (q) => q.eq("organizationId", session.organizationId))
          .collect(),
        ctx.db
          .query("expenses")
          .withIndex("by_org_period_source", (q) =>
            q
              .eq("organizationId", session.organizationId)
              .eq("payPeriodKey", payPeriodKey)
              .eq("sourceKind", "salary"),
          )
          .collect(),
        ctx.db
          .query("expenses")
          .withIndex("by_org_period_source", (q) =>
            q
              .eq("organizationId", session.organizationId)
              .eq("payPeriodKey", payPeriodKey)
              .eq("sourceKind", "commission"),
          )
          .collect(),
        collectSalesInCompletedAtRange(ctx, session.organizationId, start, end),
        completedReturnsInRange(ctx, {
          startDate: start,
          endDate: end,
          organizationId: session.organizationId,
        }),
      ]);

    const compensationByProfile = new Map(
      compensations
        .filter((row) => row.organizationId === session.organizationId)
        .map((row) => [row.profileId, row]),
    );
    const grossByCashier = new Map<string, number>();
    for (const sale of sales) {
      grossByCashier.set(sale.cashierId, (grossByCashier.get(sale.cashierId) ?? 0) + sale.total);
    }
    const saleCashier = new Map(sales.map((sale) => [sale._id, sale.cashierId]));
    const refundByCashier = new Map<string, number>();
    for (const row of returns) {
      const cashierId = saleCashier.get(row.saleId);
      if (!cashierId) continue;
      refundByCashier.set(cashierId, (refundByCashier.get(cashierId) ?? 0) + row.refundAmount);
    }

    const salaryPaidByProfile = new Map<string, number>();
    for (const row of salaryExpenses) {
      if (row.paymentStatus === "void" || !row.beneficiaryProfileId) continue;
      salaryPaidByProfile.set(
        row.beneficiaryProfileId,
        (salaryPaidByProfile.get(row.beneficiaryProfileId) ?? 0) + row.amount,
      );
    }
    const commissionPaidByProfile = new Map<string, number>();
    for (const row of commissionExpenses) {
      if (row.paymentStatus === "void" || !row.beneficiaryProfileId) continue;
      commissionPaidByProfile.set(
        row.beneficiaryProfileId,
        (commissionPaidByProfile.get(row.beneficiaryProfileId) ?? 0) + row.amount,
      );
    }

    const rows = [];
    for (const profile of profiles) {
      const compensation = compensationByProfile.get(profile._id);
      const salaryDue = compensation?.salaryAmount ?? 0;
      const salaryPaid = roundMoney(salaryPaidByProfile.get(profile._id) ?? 0);
      const grossSales = roundMoney(grossByCashier.get(profile.userId) ?? 0);
      const refundTotal = roundMoney(refundByCashier.get(profile.userId) ?? 0);
      const netSales = roundMoney(Math.max(0, grossSales - refundTotal));
      const commissionEarned = computeCommissionEarned({
        netSales,
        grossSales,
        rate: compensation?.commissionRate ?? 0,
        basis: (compensation?.commissionBasis ?? "net") as CommissionBasis,
      });
      const commissionPaid = roundMoney(commissionPaidByProfile.get(profile._id) ?? 0);
      if (salaryDue <= 0 && commissionEarned <= 0 && salaryPaid <= 0 && commissionPaid <= 0) {
        continue;
      }
      rows.push({
        profileId: profile._id,
        name: profile.name,
        role: profile.role,
        salaryDue,
        salaryPaid,
        salaryStatus: salaryDue > 0 && salaryPaid >= salaryDue ? "paid" : "unpaid",
        commissionEarned,
        commissionPaid,
        totalStaffCost: roundMoney(salaryPaid + commissionPaid),
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const performance = query({
  args: {
    profileId: v.id("profiles"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireRole(ctx, ["administrator", "manager"]);
    const target = await loadTargetProfile(
      ctx,
      session.profile,
      session.organizationId,
      args.profileId,
    );
    if (args.endDate < args.startDate) {
      throw new Error("End date must be on or after the start date");
    }
    const license = await resolveLicense(ctx, session.organization);
    const caps = planCapabilities(license.planKey, license.limits);
    const totals = await cashierPeriodTotals(ctx, {
      organizationId: session.organizationId,
      cashierUserId: target.userId,
      startDate: args.startDate,
      endDate: args.endDate,
    });
    const expenses = await collectExpensesInOccurredAtRange(
      ctx,
      session.organizationId,
      args.startDate,
      args.endDate,
    );
    const recordedBy = expenses.filter((row) => row.recordedBy === target.userId);
    const forStaff = expenses.filter(
      (row) => row.beneficiaryProfileId === target._id && row.paymentStatus !== "void",
    );
    const compensation = caps.canManageStaffCompensation
      ? await compensationForProfile(ctx, session.organizationId, target._id)
      : null;
    const commissionEarned =
      caps.canManageStaffCompensation && compensation
        ? computeCommissionEarned({
            netSales: totals.netSales,
            grossSales: totals.grossSales,
            rate: compensation.commissionRate ?? 0,
            basis: (compensation.commissionBasis ?? "net") as CommissionBasis,
          })
        : 0;
    const salaryPaid = roundMoney(
      forStaff
        .filter((row) => row.sourceKind === "salary")
        .reduce((sum, row) => sum + row.amount, 0),
    );
    const commissionPaid = roundMoney(
      forStaff
        .filter((row) => row.sourceKind === "commission")
        .reduce((sum, row) => sum + row.amount, 0),
    );
    return {
      profileId: target._id,
      userId: target.userId,
      startDate: args.startDate,
      endDate: args.endDate,
      orderCount: totals.orderCount,
      grossSales: totals.grossSales,
      netSales: totals.netSales,
      refundTotal: totals.refundTotal,
      returnCount: totals.returnCount,
      expensesRecordedCount: recordedBy.length,
      expensesRecordedTotal: roundMoney(recordedBy.reduce((sum, row) => sum + row.amount, 0)),
      staffExpenseTotal: roundMoney(forStaff.reduce((sum, row) => sum + row.amount, 0)),
      salaryPaid,
      commissionPaid,
      commissionEarned,
      commissionOutstanding: roundMoney(Math.max(0, commissionEarned - commissionPaid)),
      canViewCompensation: caps.canManageStaffCompensation && canManagePayroll(session.profile),
      orders: totals.sales.slice(0, 25).map((sale) => ({
        id: sale._id,
        invoiceNumber: sale.invoiceNumber,
        completedAt: sale.completedAt,
        customerName: sale.customerName,
        total: sale.total,
      })),
      returns: totals.returns.slice(0, 25).map((row) => ({
        id: row._id,
        returnNumber: row.returnNumber,
        completedAt: row.completedAt,
        refundAmount: row.refundAmount,
        saleId: row.saleId,
      })),
      expenses: forStaff.slice(0, 25).map((row) => ({
        id: row._id,
        amount: row.amount,
        category: row.category,
        occurredAt: row.occurredAt,
        description: row.description ?? null,
        sourceKind: row.sourceKind ?? null,
        payPeriodKey: row.payPeriodKey ?? null,
      })),
    };
  },
});

export const activity = query({
  args: {
    profileId: v.id("profiles"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const session = await requireRole(ctx, ["administrator", "manager"]);
    const target = await loadTargetProfile(
      ctx,
      session.profile,
      session.organizationId,
      args.profileId,
    );
    const raw = await ctx.db
      .query("auditLogs")
      .withIndex("by_actor", (q) => q.eq("actorId", target.userId))
      .order("desc")
      .paginate(args.paginationOpts);
    const filtered = raw.page.filter((row) => row.organizationId === session.organizationId);
    const page = await Promise.all(
      filtered.map(async (row) => {
        const enriched = await enrichAuditLogRow(ctx, {
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId ?? null,
          metadata: row.metadata ?? null,
          organizationId: row.organizationId,
        });
        return {
          id: row._id,
          action: row.action,
          actionLabel: enriched.actionLabel,
          entityType: row.entityType,
          areaLabel: enriched.areaLabel,
          entityId: row.entityId ?? null,
          entityLabel: enriched.entityLabel,
          detail: enriched.detail,
          createdAt: row.createdAt,
          metadata: row.metadata ?? null,
        };
      }),
    );
    return { ...raw, page };
  },
});
