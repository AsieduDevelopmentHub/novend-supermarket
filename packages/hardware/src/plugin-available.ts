import { Capacitor } from "@capacitor/core";

/** True when the native shell registered this Capacitor plugin. */
export function isNativePluginAvailable(name: string): boolean {
  try {
    return Capacitor.isPluginAvailable(name);
  } catch {
    return false;
  }
}

export function pluginUnavailableMessage(feature: string): string {
  return `${feature} is not available in this app build. Update or reinstall Novend, then try again.`;
}
