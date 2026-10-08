/**
 * Arkesel SMS (Ghana / Africa). Secrets stay on the Convex deployment:
 *   npx convex env set ARKESEL_API_KEY ...
 *   npx convex env set ARKESEL_SENDER_ID Novend
 *
 * Without the API key, sends are skipped (same pattern as Resend email).
 */

const ARKESEL_SEND_URL = "https://sms.arkesel.com/api/v2/sms/send";

export type ArkeselSendResult =
  | { status: "sent"; messageId?: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

/** Normalize Ghana / E.164 numbers for Arkesel. */
export function normalizeSmsRecipient(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "").trim();
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("233") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+233${digits.slice(1)}`;
  if (digits.length === 9) return `+233${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export function arkeselConfigured(): boolean {
  return Boolean(process.env.ARKESEL_API_KEY?.trim());
}

export async function sendArkeselSms(args: {
  to: string | string[];
  message: string;
  sender?: string;
}): Promise<ArkeselSendResult> {
  const apiKey = process.env.ARKESEL_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[sms] ARKESEL_API_KEY is not set; SMS was not sent.");
    return { status: "skipped", reason: "ARKESEL_API_KEY is not set" };
  }

  const sender =
    args.sender?.trim() || process.env.ARKESEL_SENDER_ID?.trim() || "Novend";
  const message = args.message.trim();
  if (!message) return { status: "failed", reason: "Message is empty" };
  if (message.length > 480) {
    return { status: "failed", reason: "Message is too long" };
  }

  const recipients = (Array.isArray(args.to) ? args.to : [args.to])
    .map(normalizeSmsRecipient)
    .filter((value): value is string => Boolean(value));
  if (recipients.length === 0) {
    return { status: "failed", reason: "No valid recipient" };
  }

  const response = await fetch(ARKESEL_SEND_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender,
      message,
      recipients,
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | { status?: string; data?: { id?: string }; message?: string }
    | null;

  if (!response.ok || (body?.status && body.status !== "success")) {
    const reason = body?.message || `Arkesel HTTP ${response.status}`;
    console.warn("[sms] Arkesel send failed:", reason);
    return { status: "failed", reason };
  }

  return { status: "sent", messageId: body?.data?.id };
}

export async function sendArkeselSmsBestEffort(args: {
  to: string | string[];
  message: string;
  sender?: string;
}): Promise<void> {
  try {
    await sendArkeselSms(args);
  } catch (error) {
    console.warn("[sms] Delivery failed.", error);
  }
}
