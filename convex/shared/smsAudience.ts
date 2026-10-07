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
export const SMS_BROADCAST_MAX_RECIPIENTS = 200;

export function isSmsAudience(value: string): value is SmsAudience {
  return (SMS_AUDIENCES as readonly string[]).includes(value);
}

type AudienceProfile = {
  userId: string;
  role: string;
  status: string;
  phone?: string | null;
};

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
  const wanted = new Set(args.audiences);
  const owners = new Set(args.ownerUserIds);
  const phones: string[] = [];
  const seen = new Set<string>();
  for (const profile of args.profiles) {
    if (profile.status !== "active") continue;
    const isOwner = owners.has(profile.userId);
    const match =
      (wanted.has("owners") && isOwner) ||
      (wanted.has("administrators") && profile.role === "administrator") ||
      (wanted.has("managers") && profile.role === "manager");
    if (!match) continue;
    pushPhone(phones, seen, profile.phone);
  }
  return phones;
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
