/** HTML-safe transactional copy. Keep interpolation escaped — never trust URLs from callers blindly. */

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
  logoUrl?: string;
};

export type PasswordChangedEmailInput = {
  signInUrl: string;
  resetUrl: string;
  logoUrl?: string;
};

export type RenderedEmail = {
  subject: string;
  preheader: string;
  text: string;
  html: string;
};

function wrapLayout(args: {
  title: string;
  preheader: string;
  bodyHtml: string;
  logoUrl?: string;
}): string {
  const logo = args.logoUrl
    ? `<img src="${escapeHtml(args.logoUrl)}" width="120" alt="${EMAIL_BRAND.product}" style="display:block;height:auto;border:0;max-width:120px;" />`
    : `<span style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#f8fafc;">${EMAIL_BRAND.product}</span>`;

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
          <td style="background-color:${EMAIL_BRAND.navy};border-radius:16px 16px 0 0;padding:28px 32px;">
            ${logo}
          </td>
        </tr>
        <tr>
          <td style="background-color:${EMAIL_BRAND.card};padding:32px;border:1px solid ${EMAIL_BRAND.border};border-top:0;border-radius:0 0 16px 16px;">
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
    logoUrl: input.logoUrl,
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
    logoUrl: input.logoUrl,
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
