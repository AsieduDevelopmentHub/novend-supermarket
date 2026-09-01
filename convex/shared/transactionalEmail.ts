import {
  renderOrganizationClosureAlertEmail,
  renderPasswordChangedEmail,
  type RenderedEmail,
} from "./emailTemplates";
import { EMAIL_LOGO_CONTENT_ID, EMAIL_LOGO_PNG_BASE64 } from "./emailLogoBase64";

export function publicAppUrl(): string {
  return (process.env.SITE_URL || process.env.NOVEND_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function emailFromAddress(): string {
  return process.env.AUTH_EMAIL_FROM ?? "Novend <noreply@novend.app>";
}

export async function sendTransactionalEmail(
  to: string,
  rendered: RenderedEmail,
  tag: string,
): Promise<"sent" | "skipped"> {
  const apiKey = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] AUTH_RESEND_KEY is not set; email was not sent.");
    return "skipped";
  }

  const replyTo = process.env.AUTH_EMAIL_REPLY_TO?.trim();
  const body: Record<string, unknown> = {
    from: emailFromAddress(),
    to: [to],
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers: {
      "X-Entity-Ref-ID": tag,
    },
    tags: [{ name: "category", value: tag }],
    attachments: [
      {
        filename: "novend-logo.png",
        content: EMAIL_LOGO_PNG_BASE64,
        content_id: EMAIL_LOGO_CONTENT_ID,
        content_type: "image/png",
        content_disposition: "inline",
      },
    ],
  };
  if (replyTo) {
    body.reply_to = replyTo;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error("Could not send email right now. Try again in a few minutes.");
  }
  return "sent";
}

export async function sendTransactionalEmailBestEffort(
  to: string,
  rendered: RenderedEmail,
  tag: string,
): Promise<void> {
  try {
    await sendTransactionalEmail(to, rendered, tag);
  } catch (error) {
    console.warn("[email] Delivery failed after the account change succeeded.", error);
  }
}

export async function notifyPasswordChanged(email: string): Promise<void> {
  const origin = publicAppUrl();
  await sendTransactionalEmailBestEffort(
    email,
    renderPasswordChangedEmail({
      signInUrl: `${origin}/login`,
      resetUrl: `${origin}/forgot-password`,
    }),
    "password-changed",
  );
}

function formatAlertTimestamp(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

/** Notify every platform administrator about tenant-initiated organization closure. */
export async function notifyPlatformAdminsOrganizationClosure(args: {
  kind: "requested" | "finalized";
  organizationName: string;
  organizationId: string;
  effectiveAt?: number;
  reason?: string | null;
  recipientEmails: string[];
}): Promise<void> {
  const origin = publicAppUrl();
  const rendered = renderOrganizationClosureAlertEmail({
    kind: args.kind,
    organizationName: args.organizationName,
    organizationId: args.organizationId,
    effectiveAtLabel:
      args.effectiveAt !== undefined ? `${formatAlertTimestamp(args.effectiveAt)} UTC` : undefined,
    reason: args.reason,
    platformOrgUrl: `${origin}/platform/${args.organizationId}?tab=licence`,
    platformActivityUrl: `${origin}/platform/activity`,
  });
  const tag =
    args.kind === "requested" ? "platform-closure-requested" : "platform-closure-finalized";

  const recipients = new Set<string>();
  const configured = process.env.PLATFORM_ALERT_EMAIL?.trim();
  if (configured) recipients.add(configured);

  // Convex actions cannot query DB here — recipients are passed in by the caller.
  for (const email of args.recipientEmails) {
    if (email.trim()) recipients.add(email.trim().toLowerCase());
  }

  if (recipients.size === 0) {
    console.warn("[email] No platform admin recipients for closure alert; email skipped.");
    return;
  }

  await Promise.all(
    [...recipients].map((email) => sendTransactionalEmailBestEffort(email, rendered, tag)),
  );
}
