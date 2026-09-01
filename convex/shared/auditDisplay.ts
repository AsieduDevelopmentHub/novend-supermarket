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
    request_organization_closure: "Business closure scheduled",
    cancel_organization_closure: "Business closure cancelled",
    finalize_organization_closure: "Business closure finalized",
    delete_own_account: "Staff account deleted (self-service)",
    platform_archive_organization: "Organization archived (platform)",
    platform_set_org_status: "Organization status changed (platform)",
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

function closureReasonLabel(reason: unknown) {
  if (typeof reason !== "string" || !reason) return null;
  const labels: Record<string, string> = {
    break: "Taking a break",
    switching: "Switching systems",
    cost: "Cost concerns",
    features: "Missing features",
    support: "Support expectations",
    other: "Other",
  };
  return labels[reason] ?? humanizeToken(reason);
}

function formatTimestampLabel(value: unknown) {
  if (typeof value !== "number") return null;
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
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
    typeof args.metadata === "string" ? readMetadata(args.metadata) : (args.metadata ?? null);
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

  if (args.action === "request_organization_closure" && metadata) {
    const effectiveAt = formatTimestampLabel(metadata.effectiveAt);
    if (effectiveAt) parts.push(`Permanent closure ${effectiveAt} UTC`);
    const reason = closureReasonLabel(metadata.reason);
    if (reason) parts.push(`Reason: ${reason}`);
    parts.push("Organization is read-only until the grace period ends");
  }

  if (args.action === "cancel_organization_closure") {
    parts.push("Owner restored the business before the deadline");
  }

  if (args.action === "finalize_organization_closure") {
    parts.push("Grace period ended; organization fully disabled");
    const reason = closureReasonLabel(metadata?.reason);
    if (reason) parts.push(`Original reason: ${reason}`);
  }

  if (args.action === "delete_own_account") {
    parts.push("Staff removed their own login; sales history preserved");
  }

  if (args.action === "platform_archive_organization") {
    parts.push("Platform admin archived the organization immediately");
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
