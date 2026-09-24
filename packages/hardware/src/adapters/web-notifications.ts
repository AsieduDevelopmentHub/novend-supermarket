import type { HardwareResult } from "../types";
import type {
  NotificationPermissionState,
  NotificationsAdapter,
  PushRegistration,
} from "../native-types";
import {
  clearStoredPushEndpoint,
  readStoredPushEndpoint,
  readTopicPrefsFromStorage,
  urlBase64ToUint8Array,
  writeStoredPushEndpoint,
  writeTopicPrefsToStorage,
} from "./notification-prefs";

function resolveVapidPublicKey(explicit?: string): string | null {
  if (explicit && explicit.trim()) return explicit.trim();
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}

async function webPermissionState(): Promise<NotificationPermissionState> {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unavailable";
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unavailable";
  }
  const permission = Notification.permission;
  if (permission === "granted") return "granted";
  if (permission === "denied") return "denied";
  return "not-requested";
}

/** Browser / PWA Web Push adapter. */
export function createWebNotificationsAdapter(): NotificationsAdapter {
  return {
    async checkPermissions() {
      const state = await webPermissionState();
      return { ok: true, data: { granted: state === "granted", state } };
    },
    async requestPermissions() {
      if (typeof Notification === "undefined") {
        return {
          ok: false,
          message: "Notifications are unavailable in this browser.",
          data: { granted: false, state: "unavailable" as const },
        };
      }
      const permission = await Notification.requestPermission();
      const state: NotificationPermissionState =
        permission === "granted" ? "granted" : permission === "denied" ? "denied" : "not-requested";
      return { ok: true, data: { granted: state === "granted", state } };
    },
    async scheduleLocal({ title, body }) {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") {
        return { ok: false, message: "Notification permission is required." };
      }
      try {
        new Notification(title, { body });
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Could not show notification.",
        };
      }
    },
    async getTopicPrefs() {
      return { ok: true, data: readTopicPrefsFromStorage() };
    },
    async setTopicPrefs(prefs) {
      writeTopicPrefsToStorage(prefs);
      return { ok: true };
    },
    async registerRemote(args): Promise<HardwareResult<PushRegistration>> {
      const state = await webPermissionState();
      if (state === "unavailable") {
        return { ok: false, message: "Web Push is unavailable in this browser." };
      }
      if (state !== "granted") {
        const requested = await this.requestPermissions();
        if (!requested.data?.granted) {
          return {
            ok: false,
            message: "Allow notifications in the browser to enable alerts.",
          };
        }
      }

      const publicKey = resolveVapidPublicKey(args?.vapidPublicKey);
      if (!publicKey) {
        return {
          ok: false,
          message: "Push is not configured (missing VAPID public key).",
        };
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
          });
        }
        const json = subscription.toJSON();
        const endpoint = json.endpoint;
        if (!endpoint) {
          return { ok: false, message: "Browser did not return a push endpoint." };
        }
        writeStoredPushEndpoint(endpoint);
        return {
          ok: true,
          data: {
            platform: "web",
            endpoint,
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          },
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Could not subscribe to Web Push.",
        };
      }
    },
    async unregisterRemote() {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        const endpoint = subscription?.endpoint ?? readStoredPushEndpoint() ?? undefined;
        if (subscription) await subscription.unsubscribe();
        clearStoredPushEndpoint();
        return { ok: true, data: endpoint ? { endpoint } : undefined };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Could not unsubscribe.",
        };
      }
    },
  };
}

/** Electron foreground notifications — registration is a stable device key. */
export function createElectronNotificationsAdapter(
  showNotification: (title: string, body: string) => Promise<HardwareResult>,
): NotificationsAdapter {
  const web = createWebNotificationsAdapter();
  return {
    checkPermissions: async () => {
      if (typeof Notification === "undefined") {
        return { ok: true, data: { granted: true, state: "granted" as const } };
      }
      return web.checkPermissions();
    },
    requestPermissions: async () => {
      if (typeof Notification === "undefined") {
        return { ok: true, data: { granted: true, state: "granted" as const } };
      }
      return web.requestPermissions();
    },
    scheduleLocal: async ({ title, body }) => showNotification(title, body),
    getTopicPrefs: web.getTopicPrefs,
    setTopicPrefs: web.setTopicPrefs,
    registerRemote: async () => {
      const endpoint =
        readStoredPushEndpoint() ||
        `electron:${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())}`;
      writeStoredPushEndpoint(endpoint);
      return {
        ok: true,
        data: {
          platform: "electron",
          endpoint,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        },
      };
    },
    unregisterRemote: async () => {
      const endpoint = readStoredPushEndpoint() ?? undefined;
      clearStoredPushEndpoint();
      return { ok: true, data: endpoint ? { endpoint } : undefined };
    },
  };
}
