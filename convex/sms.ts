"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { arkeselConfigured, sendArkeselSms } from "./shared/arkeselSms";
import { formatBusinessTime } from "./shared/businessDate";
import { SMS_MESSAGE_MAX, smsAudienceValidator } from "./shared/smsAudience";

/**
 * Platform broadcast. Owners and operators only, and only to owners,
 * administrators, or managers — never cashiers, and never an arbitrary number.
 */
export const broadcast = action({
  args: {
    organizationId: v.optional(v.id("organizations")),
    audiences: v.array(smsAudienceValidator),
    message: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    status: "sent" | "skipped" | "failed";
    recipientCount: number;
    detail: string;
  }> => {
    const message = args.message.trim();
    if (!message) throw new Error("Write a message first");
    if (message.length > SMS_MESSAGE_MAX) {
      throw new Error(`Message must be ${SMS_MESSAGE_MAX} characters or fewer`);
    }
    if (args.audiences.length === 0) {
      throw new Error("Choose who should receive this message");
    }

    const phones: string[] = await ctx.runQuery(internal.platformSms.broadcastPhones, {
      organizationId: args.organizationId,
      audiences: args.audiences,
    });
    if (phones.length === 0) {
      throw new Error("No phone numbers on file for that audience");
    }

    let status: "sent" | "skipped" | "failed" = "skipped";
    let detail = "Arkesel is not configured";
    if (arkeselConfigured()) {
      const result = await sendArkeselSms({ to: phones, message });
      status = result.status === "sent" ? "sent" : "failed";
      detail = result.status === "sent" ? "Delivered to Arkesel" : result.reason;
    }

    await ctx.runMutation(internal.platformSms.recordBroadcast, {
      organizationId: args.organizationId,
      audiences: args.audiences,
      message,
      recipientCount: phones.length,
      status,
      detail,
    });

    if (status === "failed") throw new Error(detail);
    return { status, recipientCount: phones.length, detail };
  },
});

/** One SMS to org admins the first time a cashier clocks in that business day. */
export const notifyCashierClockIn = internalAction({
  args: {
    organizationId: v.id("organizations"),
    cashierUserId: v.id("users"),
    cashierName: v.string(),
    branchName: v.string(),
    clockedInAt: v.number(),
  },
  handler: async (ctx, args): Promise<{ status: "sent" | "skipped" | "failed"; reason?: string }> => {
    const target: { phones: string[]; timeZone: string | null } = await ctx.runQuery(
      internal.platformSms.clockInAlert,
      {
      organizationId: args.organizationId,
      cashierUserId: args.cashierUserId,
    });
    if (target.phones.length === 0) {
      return { status: "skipped" as const, reason: "No administrator phones" };
    }
    const time = formatBusinessTime(args.clockedInAt, target.timeZone);
    const branch = args.branchName.trim();
    const message = `${args.cashierName.trim()} clocked in at ${time}${branch ? ` (${branch})` : ""}.`;
    try {
      return await sendArkeselSms({
        to: target.phones,
        message: message.slice(0, SMS_MESSAGE_MAX),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "SMS failed";
      console.warn("[sms] Clock-in alert failed.", reason);
      return { status: "failed" as const, reason };
    }
  },
});

/** Internal helper for digests / alerts. Never throws into callers. */
export const sendBestEffort = internalAction({
  args: {
    to: v.string(),
    message: v.string(),
    sender: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    if (!arkeselConfigured()) {
      return { status: "skipped" as const, reason: "not configured" };
    }
    try {
      return await sendArkeselSms(args);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "SMS failed";
      return { status: "failed" as const, reason };
    }
  },
});
