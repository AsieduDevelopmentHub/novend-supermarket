import { v } from "convex/values";
import { normalizeSmsRecipient } from "./arkeselSms";

/** Who a platform broadcast may reach. Cashiers are never included. */
export const SMS_AUDIENCES = ["owners", "administrators", "managers"] as const;
export type SmsAudience = (typeof SMS_AUDIENCES)[number];

export const smsAudienceValidator = v.union(
  v.literal("owners"),
  v.literal("administrators"),
  v.literal("managers"),
);

export const SMS_MESSAGE_MAX = 320;

/** Keep the link at the end so a long message is shortened before the URL. */
export function appendSmsLink(message: string, url?: string | null) {
  const link = url?.trim() ?? "";
  const body = message.replace(/\s+/g, " ").trim();
  if (!link) return body.slice(0, SMS_MESSAGE_MAX);
  const suffix = ` ${link}`;
  const room = SMS_MESSAGE_MAX - suffix.length;
  if (room <= 0) return link.slice(0, SMS_MESSAGE_MAX);
  return `${body.slice(0, room).trimEnd()}${suffix}`;
}
export const SMS_BROADCAST_MAX_RECIPIENTS = 200;

export function isSmsAudience(value: string): value is SmsAudience {
  return (SMS_AUDIENCES as readonly string[]).includes(value);
}

export const NOTICE_TITLE_MAX = 80;
export const NOTICE_BODY_MAX = 280;
export const NOTICE_BROADCAST_MAX_RECIPIENTS = 200;

type AudienceProfile = {
  userId: string;
  organizationId?: string;
  role: string;
  status: string;
  phone?: string | null;
  muted?: boolean;
};

export function matchesBroadcastAudience(
  profile: AudienceProfile,
  audiences: readonly SmsAudience[],
  ownerUserIds: readonly string[],
): boolean {
  if (profile.status !== "active") return false;
  const wanted = new Set(audiences);
  const isOwner = ownerUserIds.includes(profile.userId);
  return (
    (wanted.has("owners") && isOwner) ||
    (wanted.has("administrators") && profile.role === "administrator") ||
    (wanted.has("managers") && profile.role === "manager")
  );
}

function pushPhone(phones: string[], seen: Set<string>, raw: string | null | undefined) {
  const phone = raw ? normalizeSmsRecipient(raw) : null;
  if (!phone || seen.has(phone)) return;
  seen.add(phone);
  phones.push(phone);
}

/**
 * Phones for a platform broadcast. Owners come from the organization owner,
 * even when their staff role is administrator.
 */
export function phonesForBroadcast(args: {
  audiences: readonly SmsAudience[];
  profiles: AudienceProfile[];
  ownerUserIds: readonly string[];
}): string[] {
  const phones: string[] = [];
  const seen = new Set<string>();
  for (const profile of args.profiles) {
    if (!matchesBroadcastAudience(profile, args.audiences, args.ownerUserIds)) continue;
    pushPhone(phones, seen, profile.phone);
  }
  return phones;
}

export type NoticeRecipient = { userId: string; organizationId: string };

/** People who will see a platform notice. Muted staff and cashiers are left out. */
export function recipientsForNotice(args: {
  audiences: readonly SmsAudience[];
  profiles: AudienceProfile[];
  ownerUserIds: readonly string[];
}): NoticeRecipient[] {
  const recipients: NoticeRecipient[] = [];
  const seen = new Set<string>();
  for (const profile of args.profiles) {
    if (profile.muted) continue;
    if (!profile.organizationId) continue;
    if (!matchesBroadcastAudience(profile, args.audiences, args.ownerUserIds)) continue;
    if (seen.has(profile.userId)) continue;
    seen.add(profile.userId);
    recipients.push({ userId: profile.userId, organizationId: profile.organizationId });
  }
  return recipients;
}

/** Administrator and owner phones for one cashier's first clock-in of the day. */
export function phonesForClockInAlert(args: {
  cashierUserId: string;
  ownerUserId: string;
  profiles: AudienceProfile[];
}): string[] {
  const phones: string[] = [];
  const seen = new Set<string>();
  for (const profile of args.profiles) {
    if (profile.status !== "active") continue;
    if (profile.userId === args.cashierUserId) continue;
    const isOwner = profile.userId === args.ownerUserId;
    if (profile.role !== "administrator" && !isOwner) continue;
    pushPhone(phones, seen, profile.phone);
  }
  return phones;
}
