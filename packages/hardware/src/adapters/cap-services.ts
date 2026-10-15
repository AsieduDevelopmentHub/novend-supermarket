import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { App } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { HardwareResult } from "../types";
import type {
  AppInfo,
  AppServicesAdapter,
  BiometricsAdapter,
  NotificationPermissionState,
  NotificationsAdapter,
  SecureStorageAdapter,
  UpdateInfo,
} from "../native-types";
import {
  authenticateNativeBiometric,
  openNativeNotificationSettings,
  readNativeBiometricStatus,
  readNativeNotificationState,
} from "./novend-native-security";
import { readNativeAppInfo } from "./novend-native-app";
import { readLocalPref, removeLocalPref, writeLocalPref } from "./local-prefs";
import {
  clearStoredPushEndpoint,
  readStoredPushEndpoint,
  readTopicPrefsFromStorage,
  writeStoredPushEndpoint,
  writeTopicPrefsToStorage,
} from "./notification-prefs";
import { friendlyHardwareMessage } from "../permissions";
import { isNativePluginAvailable } from "../plugin-available";
import { NATIVE_AVAILABILITY_TIMEOUT_MS, NATIVE_CALL_TIMEOUT_MS, withTimeout } from "../timeout";
import { compareAppVersions, normalizeAppVersion } from "../version";
import { shouldSkipMobileUpdateCheck } from "../update-origin";

const BIOMETRIC_ENABLED_KEY = "novend.biometric.enabled";
const BIOMETRIC_REQUIRE_LAUNCH_KEY = "novend.biometric.requireOnLaunch";
const BIOMETRIC_UNLOCK_TOKEN_KEY = "novend.biometric.unlockToken";
const NOTIFICATION_CHANNEL_ID = "novend_alerts";

const NATIVE_SECURITY_UPDATE_MESSAGE =
  "This Novend build cannot use device security. Install the latest app.";

export function createCapacitorBiometricsAdapter(): BiometricsAdapter {
  return {
    async checkAvailability() {
      const native = readNativeBiometricStatus();
      if (native) return { ok: true, data: native };
      return {
        ok: false,
        message: NATIVE_SECURITY_UPDATE_MESSAGE,
        data: {
          available: false,
          supported: false,
          enrolled: false,
          biometryType: "none" as const,
        },
      };
    },
    async authenticate(reason) {
      const native = authenticateNativeBiometric(reason);
      if (native) return native;
      return { ok: false, message: NATIVE_SECURITY_UPDATE_MESSAGE };
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

export function createCapacitorNotificationsAdapter(): NotificationsAdapter {
  return {
    async checkPermissions(): Promise<
      HardwareResult<{ granted: boolean; state: NotificationPermissionState }>
    > {
      const native = readNativeNotificationState();
      if (native) {
        return { ok: true, data: { granted: native === "granted", state: native } };
      }
      return {
        ok: false,
        message: NATIVE_SECURITY_UPDATE_MESSAGE,
        data: { granted: false, state: "error" },
      };
    },
    async requestPermissions() {
      if (openNativeNotificationSettings()) {
        const native = readNativeNotificationState();
        return {
          ok: true,
          data: {
            granted: native === "granted",
            state: native === "granted" ? "granted" : "denied",
          },
        };
      }
      return {
        ok: false,
        message: "Could not open Android notification settings. Install the latest Novend app.",
        data: { granted: false, state: "error" as const },
      };
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
      return { ok: true, data: readTopicPrefsFromStorage() };
    },
    async setTopicPrefs(prefs) {
      writeTopicPrefsToStorage(prefs);
      return { ok: true };
    },
    async registerRemote() {
      if (!isNativePluginAvailable("PushNotifications")) {
        return {
          ok: false,
          message: "Remote alerts need a newer Novend app. Notices in the bell still work.",
        };
      }
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        let tokenValue: string | null = null;
        const permission = await PushNotifications.checkPermissions();
        if (permission.receive !== "granted") {
          const requested = await PushNotifications.requestPermissions();
          if (requested.receive !== "granted") {
            return {
              ok: false,
              message: "Allow notifications in system settings to enable push alerts.",
            };
          }
        }

        await PushNotifications.removeAllListeners().catch(() => undefined);

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Push token registration timed out."));
          }, 15000);
          void PushNotifications.addListener("registration", (token) => {
            clearTimeout(timeout);
            tokenValue = token.value;
            resolve();
          });
          void PushNotifications.addListener("registrationError", (error) => {
            clearTimeout(timeout);
            reject(new Error(error.error || "Push registration failed."));
          });
          void PushNotifications.register().catch((error) => {
            clearTimeout(timeout);
            reject(error instanceof Error ? error : new Error(String(error)));
          });
        });

        if (!tokenValue) {
          return { ok: false, message: "No push token was returned." };
        }
        writeStoredPushEndpoint(tokenValue);
        return {
          ok: true,
          data: {
            platform: "capacitor" as const,
            endpoint: tokenValue,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          },
        };
      } catch (error) {
        return {
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : "Push notifications are not available in this build.",
        };
      }
    },
    async unregisterRemote() {
      const endpoint = readStoredPushEndpoint() ?? undefined;
      clearStoredPushEndpoint();
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        await PushNotifications.removeAllListeners();
      } catch {
        /* plugin may be absent in older APKs */
      }
      return { ok: true, data: endpoint ? { endpoint } : undefined };
    },
  };
}

export function createCapacitorAppServicesAdapter(): AppServicesAdapter {
  return {
    async getInfo() {
      const native = readNativeAppInfo();
      if (native) return { ok: true, data: native };
      if (!isNativePluginAvailable("App")) {
        return { ok: false, message: "Could not read app version." };
      }
      try {
        const info = await withTimeout(App.getInfo(), NATIVE_CALL_TIMEOUT_MS);
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
      if (!isNativePluginAvailable("App")) return { ok: true, data: null };
      try {
        const result = await withTimeout(App.getLaunchUrl(), NATIVE_CALL_TIMEOUT_MS);
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
        const native = readNativeAppInfo();
        let infoVersion = native?.version;
        if (!infoVersion) {
          try {
            const info = await withTimeout(App.getInfo(), NATIVE_CALL_TIMEOUT_MS);
            infoVersion = info.version;
          } catch {
            return {
              ok: false,
              message: "Could not read the installed app version. Reinstall the latest Novend APK.",
              data: {
                available: false,
                status: "unknown",
                notes: "Could not read the installed app version.",
              },
            };
          }
        }
        if (
          typeof window !== "undefined" &&
          shouldSkipMobileUpdateCheck(window.location.protocol, window.location.hostname)
        ) {
          return {
            ok: true,
            data: {
              available: false,
              status: "dev",
              version: infoVersion,
              notes: "Development session — update checks run on signed release APKs.",
            } satisfies UpdateInfo,
          };
        }
        const sameOrigin =
          typeof window !== "undefined"
            ? `${window.location.origin}/api/mobile-updates/latest`
            : null;
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
        // Prefer same-origin proxy — env inlining in @novend/hardware is unreliable,
        // and Cap WebViews sometimes fail cross-origin Convex.site fetches.
        const candidates = [sameOrigin, fromPublic, fromSite, fromCloud].filter(
          (value): value is string => Boolean(value),
        );
        if (candidates.length === 0) {
          return {
            ok: true,
            data: {
              available: false,
              status: "unconfigured",
              version: infoVersion,
              notes: "Update endpoint is not configured for this build.",
            } satisfies UpdateInfo,
          };
        }

        let response: Response | null = null;
        let lastFetchError: unknown = null;
        for (const endpoint of candidates) {
          try {
            const separator = endpoint.includes("?") ? "&" : "?";
            response = await withTimeout(
              fetch(`${endpoint}${separator}t=${Date.now()}`, {
                cache: "no-store",
                headers: { "cache-control": "no-cache", pragma: "no-cache" },
              }),
              NATIVE_AVAILABILITY_TIMEOUT_MS,
            );
            if (response.ok || response.status === 404) break;
            response = null;
          } catch (error) {
            lastFetchError = error;
            response = null;
          }
        }
        if (!response) {
          if (lastFetchError) throw lastFetchError;
          return {
            ok: false,
            message: "Could not reach the update server.",
            data: {
              available: false,
              status: "unreachable",
              notes: "Could not reach the update server.",
            },
          };
        }
        if (response.status === 404) {
          return {
            ok: true,
            data: {
              available: false,
              status: "latest",
              version: infoVersion,
              notes: "No newer mobile release is published for this channel.",
            },
          };
        }
        if (!response.ok) {
          return {
            ok: false,
            message: "Could not reach the update server.",
            data: {
              available: false,
              status: "unreachable",
              notes: "Could not reach the update server.",
            },
          };
        }
        const remote = (await response.json()) as {
          version?: string;
          notes?: string;
          storeUrl?: string;
          downloadUrl?: string;
          mandatory?: boolean;
        };
        const installedVersion = normalizeAppVersion(infoVersion);
        const remoteVersion = normalizeAppVersion(remote.version);
        if (!installedVersion || !remoteVersion) {
          return {
            ok: true,
            data: {
              available: false,
              status: "unknown",
              version: infoVersion,
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
        const offline = typeof navigator !== "undefined" && navigator.onLine === false;
        return {
          ok: false,
          message: offline
            ? "Offline — check when connected"
            : "Could not reach the update server.",
          data: {
            available: false,
            status: offline ? "offline" : "unreachable",
            notes: offline
              ? "Offline — check when connected"
              : "Could not reach the update server.",
          },
        };
      }
    },
    async openStoreListing() {
      const update = await this.checkForUpdate();
      const url =
        update.data?.downloadUrl ||
        update.data?.storeUrl ||
        "https://play.google.com/store/apps/details?id=com.novend.millies";
      return this.openExternalUrl(url);
    },
    async addUrlOpenListener(callback) {
      if (!isNativePluginAvailable("App")) {
        return { remove: async () => undefined };
      }
      try {
        const handle = await App.addListener("appUrlOpen", (event) => {
          if (event.url) callback(event.url);
        });
        return {
          remove: async () => {
            await handle.remove();
          },
        };
      } catch {
        return { remove: async () => undefined };
      }
    },
    async addBackButtonListener(callback) {
      if (!isNativePluginAvailable("App")) {
        return { remove: async () => undefined };
      }
      try {
        const handle = await App.addListener("backButton", (event) => {
          callback({ canGoBack: Boolean(event.canGoBack) });
        });
        return {
          remove: async () => {
            await handle.remove();
          },
        };
      } catch {
        return { remove: async () => undefined };
      }
    },
    async exitApp() {
      if (!isNativePluginAvailable("App")) {
        return { ok: false as const, message: "Close Novend from the app switcher." };
      }
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
        const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
        const settingsUrl = isAndroid
          ? "intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;data=package:com.novend.millies;end"
          : "app-settings:";
        window.open(settingsUrl, "_system");
        return { ok: true as const };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return {
          ok: false as const,
          message: friendlyHardwareMessage(
            raw,
            "Open Android Settings → Apps → Millie's Supermarket → Permissions.",
          ),
        };
      }
    },
    async openDateTimeSettings() {
      try {
        const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
        if (isAndroid) {
          window.open("intent:#Intent;action=android.settings.DATE_SETTINGS;end", "_system");
          return { ok: true as const };
        }
        // iOS has no public Date & Time deep link — app settings is the best we can do.
        window.open("app-settings:", "_system");
        return {
          ok: true as const,
          message: "In Settings, open General → Date & Time.",
        };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return {
          ok: false as const,
          message: friendlyHardwareMessage(
            raw,
            "Open device Settings → Date & Time and turn on automatic date.",
          ),
        };
      }
    },
    async addAppStateListener(callback) {
      if (!isNativePluginAvailable("App")) {
        return { remove: async () => undefined };
      }
      try {
        const handle = await App.addListener("appStateChange", (state) => {
          callback(Boolean(state.isActive));
        });
        return {
          remove: async () => {
            await handle.remove();
          },
        };
      } catch {
        return { remove: async () => undefined };
      }
    },
  };
}

/** Biometric preference helpers (localStorage — Cap Preferences hangs on hosted origin). */
export async function getBiometricPrefs(): Promise<{
  enabled: boolean;
  requireOnLaunch: boolean;
}> {
  return {
    enabled: readLocalPref(BIOMETRIC_ENABLED_KEY) === "true",
    requireOnLaunch: readLocalPref(BIOMETRIC_REQUIRE_LAUNCH_KEY) === "true",
  };
}

export async function setBiometricEnabled(enabled: boolean): Promise<HardwareResult> {
  writeLocalPref(BIOMETRIC_ENABLED_KEY, enabled ? "true" : "false");
  if (!enabled) {
    writeLocalPref(BIOMETRIC_REQUIRE_LAUNCH_KEY, "false");
    removeLocalPref(BIOMETRIC_UNLOCK_TOKEN_KEY);
  }
  return { ok: true };
}

export async function setBiometricRequireOnLaunch(require: boolean): Promise<HardwareResult> {
  writeLocalPref(BIOMETRIC_REQUIRE_LAUNCH_KEY, require ? "true" : "false");
  return { ok: true };
}

/**
 * Unlock token proves a local biometric challenge completed. localStorage only —
 * Cap SecureStorage often hangs the WebView bridge right after BiometricPrompt
 * (Security tab freeze / blank UI after verification).
 */
export async function storeBiometricUnlockToken(token: string): Promise<HardwareResult> {
  try {
    writeLocalPref(BIOMETRIC_UNLOCK_TOKEN_KEY, token);
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error ?? "");
    return {
      ok: false,
      message: friendlyHardwareMessage(raw, "Could not save biometric unlock on this device."),
    };
  }
}

export async function readBiometricUnlockToken(): Promise<HardwareResult<string | null>> {
  return { ok: true, data: readLocalPref(BIOMETRIC_UNLOCK_TOKEN_KEY) };
}

export { BIOMETRIC_UNLOCK_TOKEN_KEY };
