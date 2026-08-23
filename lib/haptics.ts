/**
 * Subtle haptic feedback for native tab changes and primary actions.
 * Falls back to Vibration API or no-op on web / Electron.
 */

export async function triggerLightHaptic(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
    return;
  } catch {
    /* plugin missing or web */
  }
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(10);
    }
  } catch {
    /* ignore */
  }
}
