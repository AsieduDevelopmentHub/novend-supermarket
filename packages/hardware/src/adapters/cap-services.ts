import { BiometricAuth, BiometryType } from "@aparajita/capacitor-biometric-auth";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { App } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Preferences } from "@capacitor/preferences";
import type { HardwareResult } from "../types";
import type {
  AppInfo,
  AppServicesAdapter,
  BiometricAvailability,
  BiometricsAdapter,
  NotificationTopic,
  NotificationsAdapter,
  SecureStorageAdapter,
  UpdateInfo,
} from "../native-types";
import { friendlyHardwareMessage, permissionDeniedMessage } from "../permissions";

const TOPIC_KEY = "novend.notifications.topics";
const BIOMETRIC_ENABLED_KEY = "novend.biometric.enabled";
const BIOMETRIC_REQUIRE_LAUNCH_KEY = "novend.biometric.requireOnLaunch";
const BIOMETRIC_UNLOCK_TOKEN_KEY = "novend.biometric.unlockToken";

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
        const result = await BiometricAuth.checkBiometry();
        return {
          ok: true,
          data: {
            available: result.isAvailable,
            biometryType: mapBiometry(result.biometryType),
          },
        };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return {
          ok: false,
          message: friendlyHardwareMessage(raw, "Biometrics are unavailable on this device."),
          data: { available: false, biometryType: "none" },
        };
      }
    },
    async authenticate(reason) {
      try {
        await BiometricAuth.authenticate({
          reason,
          cancelTitle: "Use password",
          allowDeviceCredential: true,
        });
        return { ok: true };
      } catch (error) {
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

export function createCapacitorNotificationsAdapter(): NotificationsAdapter {
  return {
    async checkPermissions() {
      try {
        const status = await LocalNotifications.checkPermissions();
        return { ok: true, data: { granted: status.display === "granted" } };
      } catch {
        return { ok: true, data: { granted: false } };
      }
    },
    async requestPermissions() {
      try {
        const status = await LocalNotifications.requestPermissions();
        if (status.display !== "granted") {
          return {
            ok: false,
            message: permissionDeniedMessage("notifications"),
            data: { granted: false },
          };
        }
        return { ok: true, data: { granted: true } };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return {
          ok: false,
          message: friendlyHardwareMessage(
            raw,
            "Novend needs notification permission to send stock and subscription alerts.",
          ),
          data: { granted: false },
        };
      }
    },
    async scheduleLocal({ title, body, id }) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: id ?? Math.floor(Date.now() % 100000),
              title,
              body,
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
      const stored = await Preferences.get({ key: TOPIC_KEY });
      if (!stored.value) return { ok: true, data: { ...DEFAULT_TOPICS } };
      try {
        return {
          ok: true,
          data: { ...DEFAULT_TOPICS, ...(JSON.parse(stored.value) as Record<NotificationTopic, boolean>) },
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
        // Capacitor App plugin does not open URLs; use window as shared fallback.
        window.open(url, "_blank", "noopener,noreferrer");
        return { ok: true };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return { ok: false, message: friendlyHardwareMessage(raw, "Could not open the link.") };
      }
    },
    async checkForUpdate() {
      // Hosted WebView apps update with the deployed web build.
      // Native shell version is compared against a lightweight public endpoint when present.
      try {
        const info = await App.getInfo();
        const endpoint =
          typeof process !== "undefined" && process.env?.NEXT_PUBLIC_MOBILE_UPDATE_JSON
            ? process.env.NEXT_PUBLIC_MOBILE_UPDATE_JSON
            : null;
        if (!endpoint) {
          return {
            ok: true,
            data: {
              available: false,
              version: info.version,
              notes: "You are on the latest prepared build for this device.",
            } satisfies UpdateInfo,
          };
        }
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) {
          return { ok: true, data: { available: false } };
        }
        const remote = (await response.json()) as {
          version?: string;
          notes?: string;
          storeUrl?: string;
        };
        const available = Boolean(remote.version && remote.version !== info.version);
        return {
          ok: true,
          data: {
            available,
            version: remote.version,
            notes: remote.notes,
            storeUrl: remote.storeUrl,
          },
        };
      } catch {
        return { ok: true, data: { available: false } };
      }
    },
    async openStoreListing() {
      const update = await this.checkForUpdate();
      const url =
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
  };
}

/** Biometric preference helpers (Preferences + Secure Storage unlock token). */
export async function getBiometricPrefs(): Promise<{
  enabled: boolean;
  requireOnLaunch: boolean;
}> {
  try {
    const [enabled, requireOnLaunch] = await Promise.all([
      Preferences.get({ key: BIOMETRIC_ENABLED_KEY }),
      Preferences.get({ key: BIOMETRIC_REQUIRE_LAUNCH_KEY }),
    ]);
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
