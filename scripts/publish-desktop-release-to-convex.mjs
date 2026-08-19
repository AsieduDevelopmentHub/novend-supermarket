#!/usr/bin/env node
/**
 * Publishes GitHub Release metadata to Convex so packaged apps and the web
 * download UI never call the private GitHub Releases API.
 *
 * Required env:
 *   CONVEX_SITE_URL
 *   DESKTOP_RELEASE_PUBLISH_SECRET
 *   GH_TOKEN / GITHUB_TOKEN
 *
 * Optional:
 *   GITHUB_REPOSITORY, RELEASE_TAG, RELEASE_CHANNEL, RELEASE_MANDATORY,
 *   RELEASE_REPLACE_CHANNEL
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

function ghText(args) {
  return execFileSync("gh", args, { encoding: "utf8", env: process.env });
}

function classifyAsset(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return null;

  const classifiedLower = lower.endsWith(".blockmap")
    ? lower.slice(0, -".blockmap".length)
    : lower;

  let platform = "win32";
  if (
    classifiedLower.includes("mac") ||
    classifiedLower.endsWith(".dmg") ||
    classifiedLower.includes("-darwin")
  ) {
    platform = "darwin";
  } else if (
    classifiedLower.endsWith(".appimage") ||
    classifiedLower.endsWith(".deb") ||
    classifiedLower.includes("linux")
  ) {
    platform = "linux";
  } else if (classifiedLower.endsWith(".exe") || classifiedLower.includes("setup")) {
    platform = "win32";
  }

  let arch = "x64";
  if (classifiedLower.includes("arm64") || classifiedLower.includes("aarch64")) arch = "arm64";
  else if (
    classifiedLower.includes("x86_64") ||
    classifiedLower.includes("amd64") ||
    classifiedLower.includes("x64")
  ) {
    arch = "x64";
  }

  return { platform, arch };
}

function parseSha512FromYml(yml, fileName) {
  if (!yml || !fileName) return undefined;
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(`url:\\s*['"]?${escaped}['"]?[\\s\\S]*?sha512:\\s*(\\S+)`, "i");
  return yml.match(block)?.[1];
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

console.log(`Publishing ${tag} (${channel}) from ${repo} → ${siteUrl}`);

const release = ghJson([
  "api",
  `repos/${repo}/releases/tags/${tag}`,
  "--jq",
  "{id,html_url,body,published_at,assets: [.assets[] | {id,name,size,content_type,browser_download_url}]}",
]);

const manifests = {
  latestYml: undefined,
  latestMacYml: undefined,
  latestLinuxYml: undefined,
};

for (const { key, name } of [
  { key: "latestYml", name: "latest.yml" },
  { key: "latestMacYml", name: "latest-mac.yml" },
  { key: "latestLinuxYml", name: "latest-linux.yml" },
]) {
  const asset = release.assets.find((a) => a.name === name);
  if (!asset) continue;
  try {
    manifests[key] = ghText([
      "api",
      `repos/${repo}/releases/assets/${asset.id}`,
      "-H",
      "Accept: application/octet-stream",
    ]);
    console.log(`Fetched updater manifest ${name}`);
  } catch (error) {
    console.warn(`Could not fetch ${name}:`, error instanceof Error ? error.message : error);
  }
}

const ymlBlob = Object.values(manifests).filter(Boolean).join("\n");
const assets = release.assets
  .map((asset) => {
    const classified = classifyAsset(asset.name);
    if (!classified) return null;
    return {
      platform: classified.platform,
      arch: classified.arch,
      fileName: asset.name,
      contentType: asset.content_type || undefined,
      size: asset.size || undefined,
      sha512: parseSha512FromYml(ymlBlob, asset.name),
      githubAssetId: asset.id,
    };
  })
  .filter(Boolean);

if (assets.length === 0) {
  console.error("No installer assets found on the GitHub Release");
  process.exit(1);
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
  assets,
  updaterManifests: manifests,
};

const response = await fetch(`${siteUrl}/desktop-updates/publish`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${secret}`,
  },
  body: JSON.stringify(payload),
});

const text = await response.text();
if (!response.ok) {
  console.error(`Convex publish failed (${response.status}): ${text}`);
  process.exit(1);
}

console.log("Convex publish ok:", text);
