#!/usr/bin/env node
/**
 * Publishes GitHub Release mobile assets to Convex for the public download page
 * and in-app update checks.
 *
 * Required env:
 *   CONVEX_SITE_URL
 *   DESKTOP_RELEASE_PUBLISH_SECRET
 *   GH_TOKEN / GITHUB_TOKEN
 *
 * Optional:
 *   GITHUB_REPOSITORY, RELEASE_TAG, RELEASE_CHANNEL, RELEASE_MANDATORY,
 *   RELEASE_REPLACE_CHANNEL, MOBILE_ANDROID_STORE_URL, MOBILE_IOS_STORE_URL
 */
import { execFileSync } from "node:child_process";

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

function ghJson(args) {
  return JSON.parse(execFileSync("gh", args, { encoding: "utf8", env: process.env }));
}

function classifyAsset(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".apk")) {
    return { platform: "android", kind: "apk" };
  }
  if (lower.endsWith(".aab")) {
    return { platform: "android", kind: "aab" };
  }
  if (lower.endsWith(".ipa")) {
    return { platform: "ios", kind: "ipa" };
  }
  return null;
}

const siteUrl = required("CONVEX_SITE_URL").replace(/\/$/, "");
const secret = required("DESKTOP_RELEASE_PUBLISH_SECRET");
const repo = process.env.GITHUB_REPOSITORY || "AsieduDevelopmentHub/novend-pos";
const [owner, repoName] = repo.split("/");
const tag = process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || required("RELEASE_TAG");
const channel = process.env.RELEASE_CHANNEL === "beta" ? "beta" : "stable";
const mandatory = process.env.RELEASE_MANDATORY === "true";

if (!owner || !repoName) {
  console.error(`Invalid GITHUB_REPOSITORY: ${repo}`);
  process.exit(1);
}

console.log(`Publishing mobile ${tag} (${channel}) from ${repo} → ${siteUrl}`);

const release = ghJson([
  "api",
  `repos/${repo}/releases/tags/${tag}`,
  "--jq",
  "{id,html_url,body,published_at,assets: [.assets[] | {id,name,size,content_type,browser_download_url}]}",
]);

const assets = release.assets
  .map((asset) => {
    const classified = classifyAsset(asset.name);
    if (!classified) return null;
    return {
      platform: classified.platform,
      kind: classified.kind,
      fileName: asset.name,
      contentType: asset.content_type || undefined,
      size: asset.size || undefined,
      githubAssetId: asset.id,
    };
  })
  .filter(Boolean);

const storeUrls = {
  android: process.env.MOBILE_ANDROID_STORE_URL || undefined,
  ios: process.env.MOBILE_IOS_STORE_URL || undefined,
};

if (assets.length === 0 && !storeUrls.android && !storeUrls.ios) {
  console.warn("No mobile assets or store URLs found on the GitHub Release — skipping publish");
  process.exit(0);
}

const version = tag.replace(/^v/, "");
const payload = {
  version,
  tag,
  channel,
  notes: release.body || "",
  releasedAt: release.published_at ? Date.parse(release.published_at) : Date.now(),
  mandatory,
  replaceChannel: process.env.RELEASE_REPLACE_CHANNEL === "true",
  githubReleaseId: release.id,
  githubReleaseUrl: release.html_url,
  githubOwner: owner,
  githubRepo: repoName,
  storeUrls,
  assets,
};

const response = await fetch(`${siteUrl}/mobile-updates/publish`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${secret}`,
  },
  body: JSON.stringify(payload),
});

const text = await response.text();
if (!response.ok) {
  console.error(`Convex mobile publish failed (${response.status}): ${text}`);
  process.exit(1);
}

console.log("Convex mobile publish ok:", text);
