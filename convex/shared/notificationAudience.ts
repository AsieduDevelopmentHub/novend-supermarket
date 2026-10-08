import type { NotificationTopic } from "./notificationTopics";

export type InboxRole = "administrator" | "manager" | "cashier";

/**
 * Who should see an operational alert in the inbox.
 * Completed sales are not a topic — they must never land here.
 */
export function roleReceivesTopic(role: string, topic: NotificationTopic): boolean {
  if (role !== "administrator" && role !== "manager" && role !== "cashier") return false;
  if (topic === "subscription_alerts") return role === "administrator";
  if (topic === "daily_summary") return role === "administrator" || role === "manager";
  return true;
}

/** Clock-in alerts are for people who supervise the till, not the cashier who signed in. */
export function roleReceivesClockIn(role: string): boolean {
  return role === "administrator" || role === "manager";
}
