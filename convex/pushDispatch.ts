"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { NotificationTopic } from "./shared/notificationTopics";

const topicValidator = v.union(
  v.literal("stock_alerts"),
  v.literal("daily_summary"),
  v.literal("branch_transfers"),
  v.literal("subscription_alerts"),
);

type WebPushModule = {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    options?: { TTL?: number },
  ) => Promise<unknown>;
};

function vapidConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT,
  );
}

async function sendWebPush(args: {
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<"ok" | "gone" | "error"> {
  if (!vapidConfigured()) return "error";
  const webpush = (await import("web-push")) as unknown as WebPushModule;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  try {
    await webpush.sendNotification(
      {
        endpoint: args.endpoint,
        keys: { p256dh: args.p256dh, auth: args.auth },
      },
      JSON.stringify({
        title: args.title,
        body: args.body,
        data: args.data ?? {},
      }),
      { TTL: 60 * 60 },
    );
    return "ok";
  } catch (error) {
    const status =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode: number }).statusCode)
        : 0;
    if (status === 404 || status === 410) return "gone";
    return "error";
  }
}

/**
 * FCM HTTP v1 via a service-account JSON in `FCM_SERVICE_ACCOUNT_JSON`.
 * When unset, Capacitor tokens are skipped (registration still succeeds).
 */
async function sendFcm(args: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<"ok" | "gone" | "error" | "skipped"> {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return "skipped";
  let serviceAccount: {
    client_email: string;
    private_key: string;
    project_id: string;
  };
  try {
    serviceAccount = JSON.parse(raw) as typeof serviceAccount;
  } catch {
    return "error";
  }

  try {
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    if (!accessToken.token) return "error";

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: args.token,
            notification: { title: args.title, body: args.body },
            data: args.data ?? {},
          },
        }),
      },
    );
    if (response.status === 404 || response.status === 410) return "gone";
    if (!response.ok) return "error";
    return "ok";
  } catch {
    return "error";
  }
}

/** Fan-out a topic notification to matching registered devices. */
export const dispatchPush = internalAction({
  args: {
    organizationId: v.optional(v.id("organizations")),
    userId: v.optional(v.id("users")),
    topic: topicValidator,
    title: v.string(),
    body: v.string(),
    data: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    if (!args.organizationId && !args.userId) {
      return { sent: 0, skipped: 0, failed: 0 };
    }

    try {
      await ctx.runMutation(internal.appNotifications.recordFromDispatch, {
        organizationId: args.organizationId,
        userId: args.userId,
        topic: args.topic,
        title: args.title,
        body: args.body,
        href: args.data?.href,
      });
    } catch (error) {
      console.warn("[notifications] Inbox write skipped.", error);
    }

    const devices = await ctx.runQuery(internal.pushNotifications.devicesForDispatch, {
      organizationId: args.organizationId,
      userId: args.userId,
      topic: args.topic,
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const device of devices) {
      if (device.platform === "web") {
        if (!device.p256dh || !device.auth) {
          failed += 1;
          continue;
        }
        const result = await sendWebPush({
          endpoint: device.endpoint,
          p256dh: device.p256dh,
          auth: device.auth,
          title: args.title,
          body: args.body,
          data: args.data,
        });
        if (result === "ok") sent += 1;
        else if (result === "gone") {
          await ctx.runMutation(internal.pushNotifications.removeDeviceByEndpoint, {
            endpoint: device.endpoint,
          });
          failed += 1;
        } else failed += 1;
        continue;
      }

      if (device.platform === "capacitor") {
        const result = await sendFcm({
          token: device.endpoint,
          title: args.title,
          body: args.body,
          data: args.data,
        });
        if (result === "ok") sent += 1;
        else if (result === "skipped") skipped += 1;
        else if (result === "gone") {
          await ctx.runMutation(internal.pushNotifications.removeDeviceByEndpoint, {
            endpoint: device.endpoint,
          });
          failed += 1;
        } else failed += 1;
        continue;
      }

      // Electron foreground — enqueue for the desktop shell.
      await ctx.runMutation(internal.pushNotifications.enqueueElectronOutbox, {
        organizationId: device.organizationId,
        userId: device.userId,
        topic: args.topic as NotificationTopic,
        title: args.title,
        body: args.body,
        dataJson: args.data ? JSON.stringify(args.data) : undefined,
      });
      sent += 1;
    }

    return { sent, skipped, failed };
  },
});

/**
 * Daily stock / expiry / subscription push digests.
 * Lives in this Node action module so it can call dispatchPush without a circular type cycle.
 */
export const runDailyAlertDigests = internalAction({
  args: {},
  handler: async (ctx): Promise<{ stockSent: number; subSent: number; orgs: number }> => {
    const orgs = await ctx.runQuery(internal.pushAlerts.listActiveOrganizations, {});
    let stockSent = 0;
    let subSent = 0;

    for (const org of orgs) {
      const stock = await ctx.runQuery(internal.pushAlerts.stockAlertSummary, {
        organizationId: org._id,
      });
      if (stock.lowCount > 0 || stock.expiringCount > 0) {
        const parts: string[] = [];
        if (stock.lowCount > 0) parts.push(`${stock.lowCount} low stock`);
        if (stock.expiringCount > 0) parts.push(`${stock.expiringCount} expiring soon`);
        const result = await ctx.runAction(internal.pushDispatch.dispatchPush, {
          organizationId: org._id,
          topic: "stock_alerts",
          title: "Stock alerts",
          body: `${org.name}: ${parts.join(", ")}.`,
          data: { href: "/inventory" },
        });
        stockSent += result.sent;
      }

      if (org.subscriptionAlert) {
        const result = await ctx.runAction(internal.pushDispatch.dispatchPush, {
          organizationId: org._id,
          topic: "subscription_alerts",
          title: "Subscription reminder",
          body: org.subscriptionAlert,
          data: { href: "/settings?section=billing" },
        });
        subSent += result.sent;
      }
    }

    await ctx.runMutation(internal.pushNotifications.purgeConsumedOutbox, {});
    return { stockSent, subSent, orgs: orgs.length };
  },
});
