import { BiometricAuth, BiometryType } from "@aparajita/capacitor-biometric-auth";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { App } from "@capacitor/app";
import { registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Preferences } from "@capacitor/preferences";
import type { HardwareResult } from "../types";
import type {
  AppInfo,
  AppServicesAdapter,
  BiometricAvailability,
  BiometricsAdapter,
  NotificationPermissionState,
  NotificationTopic,
  NotificationsAdapter,
  SecureStorageAdapter,
  UpdateInfo,
} from "../native-types";
import { friendlyHardwareMessage, permissionDeniedMessage } from "../permissions";
import {
  NATIVE_AVAILABILITY_TIMEOUT_MS,
  NATIVE_CALL_TIMEOUT_MS,
  NATIVE_SETTINGS_PROBE_MS,
  isNativeTimeoutError,
  withTimeout,
} from "../timeout";
import { compareAppVersions, normalizeAppVersion } from "../version";
import {
  mapNotificationDisplayState,
  resolveNotificationPermissionState,
} from "../notification-permission";

const TOPIC_KEY = "novend.notifications.topics";
const BIOMETRIC_ENABLED_KEY = "novend.biometric.enabled";
const BIOMETRIC_REQUIRE_LAUNCH_KEY = "novend.biometric.requireOnLaunch";
const BIOMETRIC_UNLOCK_TOKEN_KEY = "novend.biometric.unlockToken";
const NOTIFICATION_CHANNEL_ID = "novend_alerts";
const NOTIFICATION_PERMISSION_REQUESTED_KEY = "novend.notifications.permissionRequested";

type NovendPermissionsPlugin = {
  checkNotificationPermission: () => Promise<{
    state: "granted" | "denied" | "not-requested" | "permanently-denied";
  }>;
  markNotificationPermissionRequested: () => Promise<void>;
  requestNotificationPermission: () => Promise<{
    state: "granted" | "denied" | "not-requested" | "permanently-denied";
  }>;
};

const NovendPermissions = registerPlugin<NovendPermissionsPlugin>("NovendPermissions");

const DEFAULT_TOPICS: Record<NotificationTopic, boolean> = {
  stock_alerts: true,
  daily_summary: false,
  branch_transfers: true,
  subscription_alerts: true,
};

function mapBiometry(type: BiometryType): BiometricAvailability["biometryType"] {
  switch (type) {
    case BiometryType.touchId:
    case BiometryType.fingerprintAuthentication:
      return "fingerprint";
    case BiometryType.faceId:
    case BiometryType.faceAuthentication:
      return "face";
    case BiometryType.irisAuthentication:
      return "iris";
    case BiometryType.none:
      return "none";
    default:
      return "unknown";
  }
}

export function createCapacitorBiometricsAdapter(): BiometricsAdapter {
  return {
    async checkAvailability() {
      try {
        // Keep Settings probes short — a hung Cap call blocks the whole WebView bridge.
        const result = await withTimeout(BiometricAuth.checkBiometry(), NATIVE_SETTINGS_PROBE_MS);
        const biometryType = mapBiometry(result.biometryType);
        const biometryTypes = Array.isArray(result.biometryTypes) ? result.biometryTypes : [];
        const alternateType = biometryTypes
          .map((type) => mapBiometry(type))
          .find((type) => type !== "none");
        const resolvedBiometryType =
          biometryType !== "none" ? biometryType : (alternateType ?? "none");
        const supported = resolvedBiometryType !== "none";
        // The plugin documents isAvailable as the enrolled-and-usable signal.
        // strongBiometryIsAvailable is a safe fallback for older native builds.
        const available = Boolean(result.isAvailable || result.strongBiometryIsAvailable);
        const enrolled = available;

        return {
          ok: true,
          data: {
            available,
            supported,
            enrolled,
            biometryType: supported ? resolvedBiometryType : "none",
            reason: result.reason || undefined,
          } satisfies BiometricAvailability,
        };
      } catch (error) {
        if (isNativeTimeoutError(error)) {
          return {
            ok: false,
            message: "Biometrics took too long to respond. Try again.",
            data: {
              available: false,
              supported: false,
              enrolled: false,
              biometryType: "none",
            },
          };
        }
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return {
          ok: false,
          message: friendlyHardwareMessage(raw, "Could not check biometrics on this device."),
          data: {
            available: false,
            supported: false,
            enrolled: false,
            biometryType: "none",
            reason: raw || undefined,
          },
        };
      }
    },
    async authenticate(reason) {
      try {
        await withTimeout(
          BiometricAuth.authenticate({
            reason,
            cancelTitle: "Use password",
            allowDeviceCredential: true,
          }),
          30_000,
        );
        return { ok: true };
      } catch (error) {
        if (isNativeTimeoutError(error)) {
          return { ok: false, message: "Biometric unlock timed out. Try again." };
        }
        const raw = error instanceof Error ? error.message : String(error ?? "");
        if (/cancel|user.?cancel/i.test(raw)) {
          return { ok: false, message: "Cancelled" };
        }
        return {
          ok: false,
          message: friendlyHardwareMessage(
            raw,
            "Could not verify your identity. Try again or sign in with your password.",
          ),
        };
      }
    },
  };
}

export function createCapacitorSecureStorageAdapter(): SecureStorageAdapter {
  return {
    async get(key) {
      try {
        const value = await SecureStorage.getItem(key);
        return { ok: true, data: value };
      } catch {
        return { ok: true, data: null };
      }
    },
    async set(key, value) {
      try {
        await SecureStorage.setItem(key, value);
        return { ok: true };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return {
          ok: false,
          message: friendlyHardwareMessage(raw, "Could not save securely on this device."),
        };
      }
    },
    async remove(key) {
      try {
        await SecureStorage.removeItem(key);
        return { ok: true };
      } catch {
        return { ok: true };
      }
    },
  };
}

async function ensureNotificationChannel(): Promise<void> {
  try {
    await withTimeout(
      LocalNotifications.createChannel({
        id: NOTIFICATION_CHANNEL_ID,
        name: "Novend alerts",
        description: "Stock, transfers, and subscription alerts",
        importance: 4,
        visibility: 1,
      }),
      NATIVE_CALL_TIMEOUT_MS,
    );
  } catch {
    /* Channels are Android-only; ignore on iOS / older APIs. */
  }
}

async function nativeNotificationState(): Promise<NotificationPermissionState | null> {
  try {
    const result = await withTimeout(
      NovendPermissions.checkNotificationPermission(),
      NATIVE_CALL_TIMEOUT_MS,
    );
    return result.state;
  } catch {
    // Older shells do not include the optional probe. LocalNotifications is
    // still the source of truth in those builds.
    return null;
  }
}

export function createCapacitorNotificationsAdapter(): NotificationsAdapter {
  return {
    async checkPermissions() {
      try {
        // Do not createChannel on status checks — that Cap call can stall the bridge
        // on Security open and freeze camera/gallery afterward.
        const requestedValue = await withTimeout(
          Preferences.get({ key: NOTIFICATION_PERMISSION_REQUESTED_KEY }),
          NATIVE_CALL_TIMEOUT_MS,
        );
        const requested = requestedValue.value === "true";
        const nativeState = await nativeNotificationState();
        const status = await withTimeout(
          LocalNotifications.checkPermissions(),
          NATIVE_SETTINGS_PROBE_MS,
        );
        const state = resolveNotificationPermissionState(status.display, requested, nativeState);
        return { ok: true, data: { granted: state === "granted", state } };
      } catch (error) {
        if (isNativeTimeoutError(error)) {
          return {
            ok: false,
            message: "Notification permission check timed out. Try again.",
            data: { granted: false, state: "error" as const },
          };
        }
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return {
          ok: false,
          message: friendlyHardwareMessage(raw, "Could not check notification permission."),
          data: { granted: false, state: "error" as const },
        };
      }
    },
    async requestPermissions() {
      try {
        await ensureNotificationChannel();
        let state: NotificationPermissionState | null = null;
        try {
          const native = await withTimeout(
            NovendPermissions.requestNotificationPermission(),
            NATIVE_AVAILABILITY_TIMEOUT_MS,
          );
          state = native.state;
        } catch {
          const status = await withTimeout(
            LocalNotifications.requestPermissions(),
            NATIVE_AVAILABILITY_TIMEOUT_MS,
          );
          await NovendPermissions.markNotificationPermissionRequested().catch(() => undefined);
          state = mapNotificationDisplayState(status.display, true);
        }
        await Preferences.set({ key: NOTIFICATION_PERMISSION_REQUESTED_KEY, value: "true" });
        state = (await nativeNotificationState()) ?? state ?? "error";
        if (state !== "granted") {
          return {
            ok: false,
            message:
              state === "permanently-denied"
                ? "Notifications are blocked. Enable them in device settings."
                : permissionDeniedMessage("notifications"),
            data: { granted: false, state },
          };
        }
        return { ok: true, data: { granted: true, state } };
      } catch (error) {
        if (isNativeTimeoutError(error)) {
          return {
            ok: false,
            message: "Notification permission timed out. Try again from device settings.",
            data: { granted: false, state: "error" as const },
          };
        }
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return {
          ok: false,
          message: friendlyHardwareMessage(
            raw,
            "Novend needs notification permission to send stock and subscription alerts.",
          ),
          data: { granted: false, state: "error" as const },
        };
      }
    },
    async scheduleLocal({ title, body, id }) {
      try {
        await ensureNotificationChannel();
        await LocalNotifications.schedule({
          notifications: [
            {
              id: id ?? Math.floor(Date.now() % 100000),
              title,
              body,
              channelId: NOTIFICATION_CHANNEL_ID,
              schedule: { at: new Date(Date.now() + 1000) },
            },
          ],
        });
        return { ok: true };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return {
          ok: false,
          message: friendlyHardwareMessage(raw, "Could not schedule the notification."),
        };
      }
    },
    async getTopicPrefs() {
      try {
        const stored = await withTimeout(
          Preferences.get({ key: TOPIC_KEY }),
          NATIVE_CALL_TIMEOUT_MS,
        );
        if (!stored.value) return { ok: true, data: { ...DEFAULT_TOPICS } };
        return {
          ok: true,
          data: {
            ...DEFAULT_TOPICS,
            ...(JSON.parse(stored.value) as Record<NotificationTopic, boolean>),
          },
        };
      } catch {
        return { ok: true, data: { ...DEFAULT_TOPICS } };
      }
    },
    async setTopicPrefs(prefs) {
      const current = await this.getTopicPrefs();
      const next = { ...(current.data ?? DEFAULT_TOPICS), ...prefs };
      await Preferences.set({ key: TOPIC_KEY, value: JSON.stringify(next) });
      return { ok: true };
    },
  };
}

export function createCapacitorAppServicesAdapter(): AppServicesAdapter {
  return {
    async getInfo() {
      try {
        const info = await App.getInfo();
        return {
          ok: true,
          data: {
            name: info.name,
            id: info.id,
            build: info.build,
            version: info.version,
          } satisfies AppInfo,
        };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return {
          ok: false,
          message: friendlyHardwareMessage(raw, "Could not read app version."),
        };
      }
    },
    async getLaunchUrl() {
      try {
        const result = await App.getLaunchUrl();
        return { ok: true, data: result?.url ?? null };
      } catch {
        return { ok: true, data: null };
      }
    },
    async openExternalUrl(url) {
      try {
        window.open(url, "_blank", "noopener,noreferrer");
        return { ok: true };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return { ok: false, message: friendlyHardwareMessage(raw, "Could not open the link.") };
      }
    },
    async checkForUpdate() {
      try {
        const info = await App.getInfo();
        const fromPublic =
          typeof process !== "undefined" && process.env?.NEXT_PUBLIC_MOBILE_UPDATE_JSON
            ? process.env.NEXT_PUBLIC_MOBILE_UPDATE_JSON
            : null;
        const fromSite =
          typeof process !== "undefined" && process.env?.NEXT_PUBLIC_CONVEX_SITE_URL
            ? `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL.replace(/\/$/, "")}/mobile-updates/latest`
            : null;
        const fromCloud =
          typeof process !== "undefined" && process.env?.NEXT_PUBLIC_CONVEX_URL
            ? `${process.env.NEXT_PUBLIC_CONVEX_URL.replace(/\.cloud\/?$/, ".site").replace(/\/$/, "")}/mobile-updates/latest`
            : null;
        const endpoint = fromPublic || fromSite || fromCloud;
        if (!endpoint) {
          return {
            ok: true,
            data: {
              available: false,
              status: "unknown",
              version: info.version,
              notes: "Update endpoint is not configured for this build.",
            } satisfies UpdateInfo,
          };
        }
        const separator = endpoint.includes("?") ? "&" : "?";
        const response = await withTimeout(
          fetch(`${endpoint}${separator}t=${Date.now()}`, {
            cache: "no-store",
            headers: { "cache-control": "no-cache", pragma: "no-cache" },
          }),
          NATIVE_AVAILABILITY_TIMEOUT_MS,
        );
        if (response.status === 404) {
          // No published mobile release yet — treat installed shell as current.
          return {
            ok: true,
            data: {
              available: false,
              status: "latest",
              version: info.version,
              notes: "No newer mobile release is published for this channel.",
            },
          };
        }
        if (!response.ok) {
          return {
            ok: false,
            message: "Could not reach the update server.",
            data: { available: false, status: "unknown" },
          };
        }
        const remote = (await response.json()) as {
          version?: string;
          notes?: string;
          storeUrl?: string;
          downloadUrl?: string;
          mandatory?: boolean;
        };
        const installedVersion = normalizeAppVersion(info.version);
        const remoteVersion = normalizeAppVersion(remote.version);
        if (!installedVersion || !remoteVersion) {
          return {
            ok: true,
            data: {
              available: false,
              status: "unknown",
              version: info.version,
              notes: "Could not compare shell versions.",
            },
          };
        }
        const available = compareAppVersions(remoteVersion, installedVersion) > 0;
        return {
          ok: true,
          data: {
            available,
            status: available ? "available" : "latest",
            mandatory: remote.mandatory === true,
            version: remote.version,
            notes: remote.notes,
            storeUrl: remote.storeUrl,
            downloadUrl: remote.downloadUrl,
          },
        };
      } catch {
        return {
          ok: false,
          message: "Could not reach the update server.",
          data: { available: false, status: "unknown" },
        };
      }
    },
    async openStoreListing() {
      const update = await this.checkForUpdate();
      const url =
        update.data?.downloadUrl ||
        update.data?.storeUrl ||
        "https://play.google.com/store/apps/details?id=com.novend.pos";
      return this.openExternalUrl(url);
    },
    async addUrlOpenListener(callback) {
      const handle = await App.addListener("appUrlOpen", (event) => {
        if (event.url) callback(event.url);
      });
      return {
        remove: async () => {
          await handle.remove();
        },
      };
    },
    async addBackButtonListener(callback) {
      const handle = await App.addListener("backButton", (event) => {
        callback({ canGoBack: Boolean(event.canGoBack) });
      });
      return {
        remove: async () => {
          await handle.remove();
        },
      };
    },
    async exitApp() {
      try {
        await App.exitApp();
        return { ok: true as const };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return {
          ok: false as const,
          message: friendlyHardwareMessage(raw, "Could not close the app."),
        };
      }
    },
    async openAppSettings() {
      try {
        const info = await App.getInfo();
        const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
        const settingsUrl = isAndroid
          ? `intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;data=package:${info.id};end`
          : "app-settings:";
        window.open(settingsUrl, "_system");
        return { ok: true as const };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return {
          ok: false as const,
          message: friendlyHardwareMessage(
            raw,
            "Open Android Settings → Apps → Novend → Permissions.",
          ),
        };
      }
    },
    async addAppStateListener(callback) {
      const handle = await App.addListener("appStateChange", (state) => {
        callback(Boolean(state.isActive));
      });
      return {
        remove: async () => {
          await handle.remove();
        },
      };
    },
  };
}

/** Biometric preference helpers (Preferences + Secure Storage unlock token). */
export async function getBiometricPrefs(): Promise<{
  enabled: boolean;
  requireOnLaunch: boolean;
}> {
  try {
    const [enabled, requireOnLaunch] = await withTimeout(
      Promise.all([
        Preferences.get({ key: BIOMETRIC_ENABLED_KEY }),
        Preferences.get({ key: BIOMETRIC_REQUIRE_LAUNCH_KEY }),
      ]),
      NATIVE_CALL_TIMEOUT_MS,
    );
    return {
      enabled: enabled.value === "true",
      requireOnLaunch: requireOnLaunch.value === "true",
    };
  } catch {
    return { enabled: false, requireOnLaunch: false };
  }
}

export async function setBiometricEnabled(enabled: boolean): Promise<HardwareResult> {
  await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: enabled ? "true" : "false" });
  if (!enabled) {
    await Preferences.set({ key: BIOMETRIC_REQUIRE_LAUNCH_KEY, value: "false" });
    try {
      await SecureStorage.removeItem(BIOMETRIC_UNLOCK_TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }
  return { ok: true };
}

export async function setBiometricRequireOnLaunch(require: boolean): Promise<HardwareResult> {
  await Preferences.set({
    key: BIOMETRIC_REQUIRE_LAUNCH_KEY,
    value: require ? "true" : "false",
  });
  return { ok: true };
}

export async function storeBiometricUnlockToken(token: string): Promise<HardwareResult> {
  try {
    await SecureStorage.setItem(BIOMETRIC_UNLOCK_TOKEN_KEY, token);
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error ?? "");
    return {
      ok: false,
      message: friendlyHardwareMessage(raw, "Could not save biometric unlock securely."),
    };
  }
}

export async function readBiometricUnlockToken(): Promise<HardwareResult<string | null>> {
  try {
    const value = await SecureStorage.getItem(BIOMETRIC_UNLOCK_TOKEN_KEY);
    return { ok: true, data: value };
  } catch {
    return { ok: true, data: null };
  }
}

export { BIOMETRIC_UNLOCK_TOKEN_KEY };
