/**
 * Classifies published release assets (desktop + mobile) into platform-facing
 * groups for the Super Admin Downloads screen. Pure presentation logic — no
 * React, no Convex — so it can be unit-reasoned about and reused by both the
 * releases list and the release detail view.
 */

export type ReleaseAssetGroup =
  | "windows-installer"
  | "windows-portable"
  | "macos"
  | "linux"
  | "android-apk"
  | "android-aab"
  | "ios";

export type ReleaseAssetInput = {
  fileName: string;
  platform?: string;
  kind?: string;
};

export const RELEASE_GROUP_ORDER: ReleaseAssetGroup[] = [
  "windows-installer",
  "windows-portable",
  "macos",
  "linux",
  "android-apk",
  "android-aab",
  "ios",
];

export const RELEASE_GROUP_LABELS: Record<ReleaseAssetGroup, string> = {
  "windows-installer": "Windows Installer",
  "windows-portable": "Windows Portable",
  macos: "macOS",
  linux: "Linux",
  "android-apk": "Android APK",
  "android-aab": "Android App Bundle",
  ios: "iOS",
};

/** Best-effort classification from file extension / naming convention. */
export function classifyReleaseAsset(asset: ReleaseAssetInput): {
  group: ReleaseAssetGroup;
  label: string;
} {
  const name = asset.fileName.toLowerCase();

  if (asset.kind === "apk" || name.endsWith(".apk")) {
    return { group: "android-apk", label: RELEASE_GROUP_LABELS["android-apk"] };
  }
  if (asset.kind === "aab" || name.endsWith(".aab")) {
    return { group: "android-aab", label: RELEASE_GROUP_LABELS["android-aab"] };
  }
  if (asset.kind === "ipa" || name.endsWith(".ipa")) {
    return { group: "ios", label: RELEASE_GROUP_LABELS.ios };
  }
  if (name.endsWith(".dmg")) {
    return { group: "macos", label: "macOS Installer (.dmg)" };
  }
  if (asset.platform === "darwin" || name.includes("mac")) {
    return { group: "macos", label: "macOS (.zip)" };
  }
  if (name.endsWith(".appimage")) {
    return { group: "linux", label: "Linux AppImage" };
  }
  if (name.endsWith(".deb") || asset.platform === "linux") {
    return { group: "linux", label: "Linux (.deb)" };
  }
  if (name.includes("portable")) {
    return { group: "windows-portable", label: RELEASE_GROUP_LABELS["windows-portable"] };
  }
  return { group: "windows-installer", label: "Windows Installer (.exe)" };
}

export type GroupedReleaseAsset<T> = { group: ReleaseAssetGroup; label: string; asset: T };

/** Classifies and sorts a mixed list of desktop/mobile assets for display. */
export function groupReleaseAssets<T extends ReleaseAssetInput>(
  assets: T[],
): GroupedReleaseAsset<T>[] {
  return assets
    .map((asset) => ({ ...classifyReleaseAsset(asset), asset }))
    .sort((a, b) => RELEASE_GROUP_ORDER.indexOf(a.group) - RELEASE_GROUP_ORDER.indexOf(b.group));
}
