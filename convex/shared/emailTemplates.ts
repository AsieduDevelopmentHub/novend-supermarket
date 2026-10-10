/** HTML-safe transactional copy. Keep interpolation escaped — never trust URLs from callers blindly. */

import { EMAIL_LOGO_CONTENT_ID } from "./emailLogoBase64";
import { appendSmsLink } from "./smsAudience";

export const EMAIL_BRAND = {
  product: "Novend",
  productFull: "Novend POS",
  company: "Asiedu Development Hub",
  primary: "#38bdf8",
  onPrimary: "#111827",
  navy: "#111827",
  muted: "#64748b",
  border: "#e2e8f0",
  background: "#f8fafc",
  card: "#ffffff",
} as const;

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type PasswordResetEmailInput = {
  resetUrl: string;
  expiresInHours: number;
};

export type PasswordChangedEmailInput = {
  signInUrl: string;
  resetUrl: string;
};

export type EmailOtpMessageInput = {
  code: string;
  expiresInMinutes: number;
};

export type WelcomeEmailInput = {
  name: string;
  organizationName: string;
  signInUrl: string;
};

export type OrganizationClosureAlertInput = {
  kind: "requested" | "finalized";
  organizationName: string;
  organizationId: string;
  effectiveAtLabel?: string;
  reason?: string | null;
  platformOrgUrl: string;
  platformActivityUrl: string;
};

export type RenderedEmail = {
  subject: string;
  preheader: string;
  text: string;
  html: string;
};

function logoBlock(): string {
  return `<img src="cid:${EMAIL_LOGO_CONTENT_ID}" width="140" height="36" alt="${EMAIL_BRAND.product}" style="display:block;border:0;outline:none;text-decoration:none;height:36px;width:auto;max-width:140px;" />`;
}

function wrapLayout(args: { title: string; preheader: string; bodyHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(args.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_BRAND.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${EMAIL_BRAND.onPrimary};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(args.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_BRAND.background};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr>
          <td style="background-color:${EMAIL_BRAND.card};border:1px solid ${EMAIL_BRAND.border};border-bottom:0;border-radius:16px 16px 0 0;padding:24px 32px;">
            ${logoBlock()}
          </td>
        </tr>
        <tr>
          <td style="background-color:${EMAIL_BRAND.card};padding:8px 32px 32px;border:1px solid ${EMAIL_BRAND.border};border-top:0;border-radius:0 0 16px 16px;">
            ${args.bodyHtml}
            <p style="margin:32px 0 0;font-size:12px;line-height:1.6;color:${EMAIL_BRAND.muted};">
              ${EMAIL_BRAND.productFull} is a product of ${EMAIL_BRAND.company}. This is a transactional message about your account. If you did not expect it, you can ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
  <tr>
    <td style="border-radius:10px;background-color:${EMAIL_BRAND.primary};">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:${EMAIL_BRAND.onPrimary};text-decoration:none;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

export function renderPasswordResetEmail(input: PasswordResetEmailInput): RenderedEmail {
  const subject = `Reset your ${EMAIL_BRAND.product} password`;
  const preheader = `This link expires in ${input.expiresInHours} hour${input.expiresInHours === 1 ? "" : "s"} and can be used once.`;
  const text = [
    `We received a request to reset the password for your ${EMAIL_BRAND.productFull} account.`,
    "",
    "Reset your password:",
    input.resetUrl,
    "",
    `This link expires in ${input.expiresInHours} hour${input.expiresInHours === 1 ? "" : "s"} and can be used only once.`,
    "If you did not request this, you can ignore this email. Your password will stay the same.",
    "",
    `— ${EMAIL_BRAND.product}`,
  ].join("\n");

  const html = wrapLayout({
    title: subject,
    preheader,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;letter-spacing:-0.02em;">Reset your password</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;">
        We received a request to reset the password for your ${EMAIL_BRAND.productFull} account.
      </p>
      ${ctaButton(input.resetUrl, "Choose a new password")}
      <p style="margin:0;font-size:13px;line-height:1.6;color:${EMAIL_BRAND.muted};">
        This link expires in ${input.expiresInHours} hour${input.expiresInHours === 1 ? "" : "s"} and can be used only once. If the button does not work, paste this URL into your browser:
      </p>
      <p style="margin:12px 0 0;font-size:12px;line-height:1.6;word-break:break-all;color:${EMAIL_BRAND.muted};">
        ${escapeHtml(input.resetUrl)}
      </p>
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${EMAIL_BRAND.muted};">
        If you did not request a reset, ignore this email. Your password will not change.
      </p>
    `,
  });

  return { subject, preheader, text, html };
}

export function renderPasswordChangedEmail(input: PasswordChangedEmailInput): RenderedEmail {
  const subject = `Your ${EMAIL_BRAND.product} password was changed`;
  const preheader = "If this was not you, reset your password immediately.";
  const text = [
    `The password for your ${EMAIL_BRAND.productFull} account was just changed.`,
    "",
    `Sign in: ${input.signInUrl}`,
    "",
    "If you did not make this change, reset your password immediately:",
    input.resetUrl,
    "",
    "Other signed-in devices were signed out.",
    "",
    `— ${EMAIL_BRAND.product}`,
  ].join("\n");

  const html = wrapLayout({
    title: subject,
    preheader,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;letter-spacing:-0.02em;">Your password was changed</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;">
        The password for your ${EMAIL_BRAND.productFull} account was just updated. Other signed-in devices were signed out.
      </p>
      ${ctaButton(input.signInUrl, "Sign in")}
      <p style="margin:0;font-size:13px;line-height:1.6;color:${EMAIL_BRAND.muted};">
        If you did not make this change, reset your password immediately. Do not ignore this email.
      </p>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;">
        <a href="${escapeHtml(input.resetUrl)}" style="color:#0369a1;font-weight:600;">Reset password</a>
      </p>
    `,
  });

  return { subject, preheader, text, html };
}

export function renderEmailOtpEmail(input: EmailOtpMessageInput): RenderedEmail {
  const subject = `Your ${EMAIL_BRAND.product} verification code`;
  const preheader = `${input.code} expires in ${input.expiresInMinutes} minutes.`;
  const text = [
    `Your ${EMAIL_BRAND.productFull} verification code is ${input.code}.`,
    "",
    `This code expires in ${input.expiresInMinutes} minutes and can be used once.`,
    "If you did not request this, you can ignore this email.",
    "",
    `— ${EMAIL_BRAND.product}`,
  ].join("\n");

  const html = wrapLayout({
    title: subject,
    preheader,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;letter-spacing:-0.02em;">Verify your email</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
        Use this code in Novend to confirm your email address.
      </p>
      <p style="margin:0 0 16px;font-size:32px;letter-spacing:0.28em;font-weight:700;color:${EMAIL_BRAND.navy};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">
        ${escapeHtml(input.code)}
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:${EMAIL_BRAND.muted};">
        This code expires in ${input.expiresInMinutes} minutes and can be used only once. Never share it with anyone.
      </p>
    `,
  });

  return { subject, preheader, text, html };
}

export function renderWelcomeEmail(input: WelcomeEmailInput): RenderedEmail {
  const name = input.name.trim() || "there";
  const organization = input.organizationName.trim() || "your business";
  const subject = `Welcome to ${EMAIL_BRAND.product}`;
  const preheader = `${organization} is ready on ${EMAIL_BRAND.productFull}.`;
  const text = [
    `Hi ${name},`,
    "",
    `Welcome to ${EMAIL_BRAND.productFull}. ${organization} is set up and ready.`,
    "You can sell from the till, and work continues if the connection drops.",
    "",
    "Sign in:",
    input.signInUrl,
    "",
    `— ${EMAIL_BRAND.product}`,
  ].join("\n");

  const html = wrapLayout({
    title: subject,
    preheader,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;letter-spacing:-0.02em;">Welcome to ${EMAIL_BRAND.product}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
        Hi ${escapeHtml(name)}, <strong>${escapeHtml(organization)}</strong> is ready.
        You can sell from the till, and work continues if the connection drops.
      </p>
      ${ctaButton(input.signInUrl, "Open Novend")}
    `,
  });

  return { subject, preheader, text, html };
}

export function welcomeSms(name: string, organizationName: string, signInUrl?: string): string {
  const who = name.trim() || "there";
  const organization = organizationName.trim() || "Your business";
  return appendSmsLink(
    `Novend: Welcome, ${who}. ${organization} is ready. Sign in to start selling.`,
    signInUrl,
  );
}

export function clockInSms(input: {
  cashierName: string;
  time: string;
  branchName: string;
  staffUrl?: string;
}): string {
  const name = input.cashierName.trim() || "A cashier";
  const branch = input.branchName.trim();
  const place = branch ? `, ${branch}` : "";
  return appendSmsLink(`Novend: ${name} clocked in at ${input.time}${place}.`, input.staffUrl);
}

/** Salary or commission payment recorded for a staff member (not order checkout). */
export function payrollPaymentSms(input: {
  kind: "salary" | "commission";
  staffName: string;
  amountLabel: string;
  payPeriodKey: string;
  organizationName?: string;
  staffUrl?: string;
}): string {
  const who = input.staffName.trim() || "Staff";
  const kind = input.kind === "commission" ? "commission" : "salary";
  const org = input.organizationName?.trim();
  const prefix = org ? `Novend (${org})` : "Novend";
  return appendSmsLink(
    `${prefix}: ${who}, your ${kind} of ${input.amountLabel} for ${input.payPeriodKey} is recorded.`,
    input.staffUrl,
  );
}

const CLOSURE_REASON_LABELS: Record<string, string> = {
  break: "Taking a break from the business",
  switching: "Switching to another system",
  cost: "Cost or billing concerns",
  features: "Missing features",
  support: "Support expectations",
  other: "Other",
};

function closureReasonLabel(reason: string | null | undefined) {
  if (!reason) return null;
  return CLOSURE_REASON_LABELS[reason] ?? reason;
}

export function renderOrganizationClosureAlertEmail(
  input: OrganizationClosureAlertInput,
): RenderedEmail {
  const org = escapeHtml(input.organizationName);
  const isRequested = input.kind === "requested";
  const subject = isRequested
    ? `[Novend] ${input.organizationName} scheduled closure`
    : `[Novend] ${input.organizationName} closed permanently`;
  const preheader = isRequested
    ? `Owner requested closure. Permanent block on ${input.effectiveAtLabel ?? "the scheduled date"}.`
    : "Grace period ended — organization is now disabled.";

  const reasonLine = closureReasonLabel(input.reason);
  const detailLines = [
    isRequested
      ? `The owner scheduled closure of ${input.organizationName}. The business is read-only until the grace period ends.`
      : `The grace period for ${input.organizationName} has ended. The organization is now fully disabled.`,
    input.effectiveAtLabel && isRequested ? `Permanent closure: ${input.effectiveAtLabel}` : null,
    reasonLine ? `Reason given: ${reasonLine}` : null,
    `Organization ID: ${input.organizationId}`,
  ].filter(Boolean);

  const text = [
    subject,
    "",
    ...detailLines,
    "",
    "Review in platform:",
    input.platformOrgUrl,
    "",
    "Activity log:",
    input.platformActivityUrl,
    "",
    `— ${EMAIL_BRAND.product} platform alerts`,
  ].join("\n");

  const html = wrapLayout({
    title: subject,
    preheader,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;letter-spacing:-0.02em;">
        ${isRequested ? "Business closure scheduled" : "Business closure finalized"}
      </h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;">
        <strong>${org}</strong> ${
          isRequested
            ? "entered a self-service closure window. Staff can still sign in read-only until the deadline."
            : "is now fully disabled after the owner-requested grace period."
        }
      </p>
      ${
        input.effectiveAtLabel && isRequested
          ? `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#334155;"><strong>Permanent closure:</strong> ${escapeHtml(input.effectiveAtLabel)}</p>`
          : ""
      }
      ${
        reasonLine
          ? `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#334155;"><strong>Reason:</strong> ${escapeHtml(reasonLine)}</p>`
          : ""
      }
      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${EMAIL_BRAND.muted};">
        Organization ID: <code style="font-size:12px;">${escapeHtml(input.organizationId)}</code>
      </p>
      ${ctaButton(input.platformOrgUrl, "Open organization")}
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;">
        <a href="${escapeHtml(input.platformActivityUrl)}" style="color:#0369a1;font-weight:600;">View platform activity</a>
      </p>
    `,
  });

  return { subject, preheader, text, html };
}
