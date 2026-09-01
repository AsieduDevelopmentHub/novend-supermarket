/**
 * Human-readable audit / activity labels. Pure data — safe for Convex and the app.
 */

export type AuditMetadata = Record<string, unknown>;

function humanizeToken(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function humanizeAuditAction(action: string) {
  const labels: Record<string, string> = {
    update_user_profile: "Updated user profile",
    deactivate_user: "Deactivated user",
    reactivate_user: "Reactivated user",
    create_user_account: "Created user account",
    update_own_profile: "Updated own profile",
    change_password: "Changed password",
    create_staff_compensation: "Set staff compensation",
    update_staff_compensation: "Updated staff compensation",
    pay_salary: "Recorded salary payment",
    pay_commission: "Recorded commission payment",
    create_expense: "Recorded expense",
    update_expense: "Updated expense",
    remove_expense: "Removed expense",
    complete_sale: "Completed sale",
    process_return: "Processed return",
  };
  return labels[action] ?? humanizeToken(action);
}

function readMetadata(raw: string | null | undefined): AuditMetadata | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as AuditMetadata;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function roleLabel(role: unknown) {
  return typeof role === "string" && role ? humanizeToken(role) : null;
}

function statusLabel(status: unknown) {
  if (status === "active") return "Active";
  if (status === "inactive") return "Deactivated";
  return typeof status === "string" && status ? humanizeToken(status) : null;
}

export function formatAuditDetail(args: {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: string | AuditMetadata | null;
  entityLabel?: string | null;
  organizationName?: string | null;
}) {
  const metadata =
    typeof args.metadata === "string"
      ? readMetadata(args.metadata)
      : (args.metadata ?? null);
  const parts: string[] = [];

  if (args.action === "update_user_profile" && metadata) {
    const previousStatus = statusLabel(metadata.previousStatus);
    const newStatus = statusLabel(metadata.newStatus);
    const role = roleLabel(metadata.role);
    if (previousStatus && newStatus && previousStatus !== newStatus) {
      parts.push(`Status ${previousStatus} → ${newStatus}`);
    } else if (role) {
      parts.push(`Role set to ${role}`);
    }
  }

  if (args.action === "deactivate_user") {
    parts.push("Account deactivated; sales and payroll history preserved");
  }
  if (args.action === "reactivate_user") {
    parts.push("Account reactivated");
  }

  if (args.action === "pay_salary" || args.action === "pay_commission") {
    if (typeof metadata?.payPeriodKey === "string") {
      parts.push(`Period ${metadata.payPeriodKey}`);
    }
    if (typeof metadata?.amount === "number") {
      parts.push(`Amount ${metadata.amount}`);
    }
  }

  if (args.action === "create_staff_compensation" || args.action === "update_staff_compensation") {
    if (typeof metadata?.salaryAmount === "number") {
      parts.push(`Salary ${metadata.salaryAmount}`);
    }
    if (typeof metadata?.commissionRate === "number") {
      parts.push(`Commission ${metadata.commissionRate}%`);
    }
  }

  if (parts.length === 0 && args.entityLabel) {
    parts.push(args.entityLabel);
  } else if (parts.length === 0 && args.entityType && args.entityId) {
    const type = humanizeToken(args.entityType.replace(/s$/, ""));
    parts.push(args.entityLabel ? `${type}: ${args.entityLabel}` : type);
  }

  if (args.organizationName) {
    parts.push(args.organizationName);
  }

  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function formatActivityRow(args: {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: string | null;
  entityLabel?: string | null;
  organizationName?: string | null;
}) {
  return {
    actionLabel: humanizeAuditAction(args.action),
    areaLabel: humanizeToken(args.entityType),
    detail: formatAuditDetail(args),
  };
}
