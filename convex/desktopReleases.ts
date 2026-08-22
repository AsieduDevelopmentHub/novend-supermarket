import { v } from "convex/values";
import { httpAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { requirePlatformAdmin } from "./shared/permissions";

const channelValidator = v.union(v.literal("stable"), v.literal("beta"));

const assetValidator = v.object({
  platform: v.union(v.literal("win32"), v.literal("darwin"), v.literal("linux")),
  arch: v.string(),
  fileName: v.string(),
  contentType: v.optional(v.string()),
  size: v.optional(v.number()),
  sha512: v.optional(v.string()),
  sha256: v.optional(v.string()),
  githubAssetId: v.number(),
});

const updaterManifestsValidator = v.object({
  latestYml: v.optional(v.string()),
  latestMacYml: v.optional(v.string()),
  latestLinuxYml: v.optional(v.string()),
});

type FeedFile = "latest.yml" | "latest-mac.yml" | "latest-linux.yml";
type Platform = "win32" | "darwin" | "linux";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function requirePublishSecret(request: Request) {
  const expected = process.env.DESKTOP_RELEASE_PUBLISH_SECRET;
  if (!expected) {
    throw new Error("DESKTOP_RELEASE_PUBLISH_SECRET is not configured");
  }
  const header = request.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : (request.headers.get("x-desktop-release-secret") || "").trim();
  if (!token || !timingSafeEqual(token, expected)) {
    throw new Error("Unauthorized");
  }
}

function githubReleasesToken(): string {
  const token = process.env.DESKTOP_RELEASE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
  if (!token) {
    throw new Error("DESKTOP_RELEASE_GITHUB_TOKEN is not configured");
  }
  return token;
}

function manifestForFile(release: Doc<"desktopReleases">, fileName: FeedFile): string | undefined {
  if (fileName === "latest.yml") return release.updaterManifests.latestYml;
  if (fileName === "latest-mac.yml") return release.updaterManifests.latestMacYml;
  return release.updaterManifests.latestLinuxYml;
}

function assetDownloadUrl(version: string, fileName: string): string | null {
  const site = (process.env.CONVEX_SITE_URL || "").replace(/\/$/, "");
  if (!site) return null;
  return `${site}/desktop-updates/assets/${encodeURIComponent(version)}/${encodeURIComponent(fileName)}`;
}

export const upsertRelease = internalMutation({
  args: {
    version: v.string(),
    tag: v.string(),
    channel: channelValidator,
    notes: v.string(),
    releasedAt: v.number(),
    mandatory: v.boolean(),
    githubReleaseId: v.number(),
    githubReleaseUrl: v.string(),
    githubOwner: v.string(),
    githubRepo: v.string(),
    assets: v.array(assetValidator),
    updaterManifests: updaterManifestsValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("desktopReleases")
      .withIndex("by_tag", (q) => q.eq("tag", args.tag))
      .unique();
    const publishedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, publishedAt });
      return existing._id;
    }
    return await ctx.db.insert("desktopReleases", { ...args, publishedAt });
  },
});

export const getLatest = internalQuery({
  args: { channel: channelValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("desktopReleases")
      .withIndex("by_channel_releasedAt", (q) => q.eq("channel", args.channel))
      .order("desc")
      .first();
  },
});

export const getByVersion = internalQuery({
  args: { version: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("desktopReleases")
      .withIndex("by_version", (q) => q.eq("version", args.version))
      .unique();
  },
});

export const purgeChannel = internalMutation({
  args: {
    channel: channelValidator,
    keepTag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("desktopReleases")
      .withIndex("by_channel_releasedAt", (q) => q.eq("channel", args.channel))
      .collect();
    let deleted = 0;
    for (const row of rows) {
      if (args.keepTag && row.tag === args.keepTag) continue;
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    return { deleted, kept: args.keepTag ?? null };
  },
});

export const listRecent = query({
  args: { channel: v.optional(channelValidator), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const channel = args.channel ?? "stable";
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    const rows = await ctx.db
      .query("desktopReleases")
      .withIndex("by_channel_releasedAt", (q) => q.eq("channel", channel))
      .order("desc")
      .take(limit);
    return rows.map((row) => ({
      ...row,
      assets: row.assets.map((asset) => ({
        ...asset,
        downloadUrl: assetDownloadUrl(row.version, asset.fileName),
      })),
    }));
  },
});

/** Public changelog strip for the download page — no installer URLs. */
export const listPublicRecent = query({
  args: { channel: v.optional(channelValidator), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const channel = args.channel ?? "stable";
    const limit = Math.min(Math.max(args.limit ?? 5, 1), 20);
    const rows = await ctx.db
      .query("desktopReleases")
      .withIndex("by_channel_releasedAt", (q) => q.eq("channel", channel))
      .order("desc")
      .take(limit);
    return rows.map((row) => ({
      version: row.version,
      tag: row.tag,
      channel: row.channel,
      notes: row.notes,
      releasedAt: row.releasedAt,
      mandatory: row.mandatory,
    }));
  },
});

function assetScore(fileName: string, platform: Platform, preferredArch: string): number {
  const lower = fileName.toLowerCase();
  let score = 0;
  if (platform === "win32") {
    if (lower.endsWith(".exe")) score += 50;
    if (lower.includes("setup") || lower.includes("nsis")) score += 20;
  } else if (platform === "darwin") {
    if (lower.endsWith(".dmg")) score += 50;
    if (lower.endsWith(".zip")) score += 20;
  } else {
    if (lower.endsWith(".appimage")) score += 50;
    if (lower.endsWith(".deb")) score += 35;
  }
  if (lower.includes(preferredArch)) score += 15;
  if (preferredArch === "x64" && (lower.includes("x64") || lower.includes("amd64"))) score += 15;
  if (lower.includes("arm64") && preferredArch !== "arm64") score -= 10;
  if (lower.endsWith(".blockmap") || lower.endsWith(".yml") || lower.endsWith(".yaml")) score -= 100;
  return score;
}

function pickInstaller(
  assets: Doc<"desktopReleases">["assets"],
  platform: Platform,
  preferredArch: string,
) {
  const candidates = assets
    .filter((asset) => asset.platform === platform)
    .map((asset) => ({ asset, score: assetScore(asset.fileName, platform, preferredArch) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.asset ?? null;
}

type InstallerKind = "windows" | "macos" | "linux-deb" | "linux-appimage";

const INSTALLER_KIND_META: Record<
  InstallerKind,
  { platform: Platform; label: string; description: string; match: (fileName: string) => boolean }
> = {
  windows: {
    platform: "win32",
    label: "Windows",
    description: "NSIS installer (.exe) for Windows 10/11",
    match: (fileName) => fileName.toLowerCase().endsWith(".exe"),
  },
  macos: {
    platform: "darwin",
    label: "macOS",
    description: "Disk image (.dmg) for macOS",
    match: (fileName) => fileName.toLowerCase().endsWith(".dmg"),
  },
  "linux-deb": {
    platform: "linux",
    label: "Linux (Debian)",
    description: "Debian / Ubuntu package (.deb)",
    match: (fileName) => fileName.toLowerCase().endsWith(".deb"),
  },
  "linux-appimage": {
    platform: "linux",
    label: "Linux (AppImage)",
    description: "Portable bundle (.AppImage) for most distros",
    match: (fileName) => fileName.toLowerCase().endsWith(".appimage"),
  },
};

function pickInstallerKind(
  assets: Doc<"desktopReleases">["assets"],
  kind: InstallerKind,
  preferredArch: string,
) {
  const meta = INSTALLER_KIND_META[kind];
  const candidates = assets
    .filter((asset) => asset.platform === meta.platform && meta.match(asset.fileName))
    .map((asset) => ({
      asset,
      score: assetScore(asset.fileName, meta.platform, preferredArch),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.asset ?? null;
}

export const getInstallOffer = query({
  args: {
    channel: v.optional(channelValidator),
    preferredArch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const channel = args.channel ?? "stable";
    const preferredArch = args.preferredArch === "arm64" ? "arm64" : "x64";
    const release = await ctx.db
      .query("desktopReleases")
      .withIndex("by_channel_releasedAt", (q) => q.eq("channel", channel))
      .order("desc")
      .first();
    if (!release) return null;

    const platforms: Platform[] = ["win32", "darwin", "linux"];
    const downloads: Partial<
      Record<
        Platform,
        { platform: Platform; fileName: string; arch: string; size?: number; url: string }
      >
    > = {};

    for (const platform of platforms) {
      const asset = pickInstaller(release.assets, platform, preferredArch);
      if (!asset) continue;
      const url = assetDownloadUrl(release.version, asset.fileName);
      if (!url) continue;
      downloads[platform] = {
        platform,
        fileName: asset.fileName,
        arch: asset.arch,
        size: asset.size,
        url,
      };
    }

    const installerKinds: InstallerKind[] = ["windows", "macos", "linux-deb", "linux-appimage"];
    const installers: Array<{
      kind: InstallerKind;
      platform: Platform;
      label: string;
      description: string;
      fileName: string;
      arch: string;
      size?: number;
      url: string;
    }> = [];

    for (const kind of installerKinds) {
      const asset = pickInstallerKind(release.assets, kind, preferredArch);
      if (!asset) continue;
      const url = assetDownloadUrl(release.version, asset.fileName);
      if (!url) continue;
      const meta = INSTALLER_KIND_META[kind];
      installers.push({
        kind,
        platform: meta.platform,
        label: meta.label,
        description: meta.description,
        fileName: asset.fileName,
        arch: asset.arch,
        size: asset.size,
        url,
      });
    }

    if (Object.keys(downloads).length === 0 && installers.length === 0) return null;

    return {
      version: release.version,
      tag: release.tag,
      channel: release.channel,
      notes: release.notes,
      releasedAt: release.releasedAt,
      downloads,
      installers,
    };
  },
});

export const publishHttp = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    requirePublishSecret(request);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const payload = body as Record<string, unknown>;
  const version = String(payload.version || "");
  const tag = String(payload.tag || `v${version}`);
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid version" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const assets = Array.isArray(payload.assets) ? payload.assets : [];
  if (assets.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: "No assets" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const updaterManifests = (payload.updaterManifests || {}) as Record<string, string>;
  const channel = payload.channel === "beta" ? "beta" : "stable";
  const replaceChannel = payload.replaceChannel === true;

  try {
    const id = await ctx.runMutation(internal.desktopReleases.upsertRelease, {
      version,
      tag,
      channel,
      notes: String(payload.notes || ""),
      releasedAt: Number(payload.releasedAt) || Date.now(),
      mandatory: payload.mandatory === true,
      githubReleaseId: Number(payload.githubReleaseId) || 0,
      githubReleaseUrl: String(payload.githubReleaseUrl || ""),
      githubOwner: String(payload.githubOwner || "AsieduDevelopmentHub"),
      githubRepo: String(payload.githubRepo || "novend-pos"),
      assets: assets.map((raw) => {
        const a = raw as Record<string, unknown>;
        let platform: Platform = "win32";
        if (a.platform === "darwin") platform = "darwin";
        else if (a.platform === "linux") platform = "linux";
        return {
          platform,
          arch: String(a.arch || "x64"),
          fileName: String(a.fileName || ""),
          contentType: a.contentType ? String(a.contentType) : undefined,
          size: typeof a.size === "number" ? a.size : undefined,
          sha512: a.sha512 ? String(a.sha512) : undefined,
          sha256: a.sha256 ? String(a.sha256) : undefined,
          githubAssetId: Number(a.githubAssetId) || 0,
        };
      }),
      updaterManifests: {
        latestYml: updaterManifests.latestYml || updaterManifests["latest.yml"],
        latestMacYml: updaterManifests.latestMacYml || updaterManifests["latest-mac.yml"],
        latestLinuxYml: updaterManifests.latestLinuxYml || updaterManifests["latest-linux.yml"],
      },
    });

    let purged: { deleted: number; kept: string | null } | null = null;
    if (replaceChannel) {
      purged = await ctx.runMutation(internal.desktopReleases.purgeChannel, {
        channel,
        keepTag: tag,
      });
    }

    return new Response(JSON.stringify({ ok: true, id, purged }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Publish failed",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
});

export const purgeHttp = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    requirePublishSecret(request);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let channelArg = "all";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.channel === "string") channelArg = body.channel;
  } catch {
    /* empty body → purge every channel */
  }

  const channels =
    channelArg === "beta"
      ? (["beta"] as const)
      : channelArg === "stable"
        ? (["stable"] as const)
        : (["stable", "beta"] as const);

  const purged: { channel: "stable" | "beta"; deleted: number; kept: string | null }[] = [];
  for (const channel of channels) {
    const result = await ctx.runMutation(internal.desktopReleases.purgeChannel, { channel });
    purged.push({ channel, ...result });
  }

  return new Response(JSON.stringify({ ok: true, purged }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});

export const feedHttp = httpAction(async (ctx, request) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const fileName = decodeURIComponent(parts[parts.length - 1] || "");
  const channelPart = parts[parts.length - 2];
  const channel =
    channelPart === "beta" || url.searchParams.get("channel") === "beta" ? "beta" : "stable";
  const allowed = new Set<FeedFile>(["latest.yml", "latest-mac.yml", "latest-linux.yml"]);

  const release = await ctx.runQuery(internal.desktopReleases.getLatest, { channel });
  if (!release) {
    return new Response("No releases published", { status: 404 });
  }

  if (!allowed.has(fileName as FeedFile)) {
    return await redirectGithubAsset(release, fileName);
  }

  const raw = manifestForFile(release, fileName as FeedFile);
  if (!raw) {
    return new Response(`Manifest ${fileName} not available for ${release.version}`, {
      status: 404,
    });
  }

  const siteOrigin = `${url.protocol}//${url.host}`;
  const rewritten = rewriteUpdaterManifest(raw, siteOrigin, release.version);

  return new Response(rewritten, {
    status: 200,
    headers: {
      "content-type": "text/yaml; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
});

export const assetHttp = httpAction(async (ctx, request) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const assetsIdx = parts.indexOf("assets");
  const version = parts[assetsIdx + 1];
  const fileName = parts
    .slice(assetsIdx + 2)
    .map((part) => decodeURIComponent(part))
    .join("/");
  if (!version || !fileName) {
    return new Response("Not found", { status: 404 });
  }

  const release = await ctx.runQuery(internal.desktopReleases.getByVersion, { version });
  if (!release) {
    return new Response("Release not found", { status: 404 });
  }

  return await redirectGithubAsset(release, fileName);
});

export const latestMetaHttp = httpAction(async (ctx, request) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }
  const url = new URL(request.url);
  const channel = url.searchParams.get("channel") === "beta" ? "beta" : "stable";
  const release = await ctx.runQuery(internal.desktopReleases.getLatest, { channel });
  if (!release) {
    return new Response(JSON.stringify({ ok: false, error: "No releases" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      version: release.version,
      tag: release.tag,
      channel: release.channel,
      notes: release.notes,
      releasedAt: release.releasedAt,
      mandatory: release.mandatory,
      githubReleaseUrl: release.githubReleaseUrl,
      assets: release.assets.map((entry) => ({
        platform: entry.platform,
        arch: entry.arch,
        fileName: entry.fileName,
        size: entry.size,
        sha512: entry.sha512,
        sha256: entry.sha256,
        downloadUrl: assetDownloadUrl(release.version, entry.fileName),
      })),
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-cache",
      },
    },
  );
});

function githubAssetRedirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "cache-control": "private, max-age=60",
    },
  });
}

function upstreamError(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function redirectGithubAsset(release: Doc<"desktopReleases">, fileName: string) {
  const asset = release.assets.find((entry) => entry.fileName === fileName);
  if (!asset || !asset.githubAssetId) {
    return new Response("Asset not found", { status: 404 });
  }

  let token: string;
  try {
    token = githubReleasesToken();
  } catch (error) {
    return upstreamError(500, error instanceof Error ? error.message : "Token missing");
  }

  const apiUrl = `https://api.github.com/repos/${release.githubOwner}/${release.githubRepo}/releases/assets/${asset.githubAssetId}`;

  let githubResponse: Response;
  try {
    githubResponse = await fetch(apiUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "application/octet-stream",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "NovendPOS-DesktopUpdater",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Network error";
    return upstreamError(503, `GitHub asset fetch failed: ${detail}`);
  }

  if (githubResponse.status >= 300 && githubResponse.status < 400) {
    const location = githubResponse.headers.get("location");
    if (!location) {
      return upstreamError(503, "GitHub redirect missing Location header");
    }
    return githubAssetRedirect(location);
  }

  if (githubResponse.ok) {
    const location = githubResponse.headers.get("location");
    if (location) {
      return githubAssetRedirect(location);
    }
    return upstreamError(
      503,
      "GitHub returned installer bytes instead of a redirect; configure DESKTOP_RELEASE_GITHUB_TOKEN and retry",
    );
  }

  const detail = await githubResponse.text().catch(() => "");
  const summary =
    githubResponse.status === 401 || githubResponse.status === 403
      ? "GitHub rejected DESKTOP_RELEASE_GITHUB_TOKEN (needs read access to private release assets)"
      : `GitHub asset fetch failed (${githubResponse.status})`;
  return upstreamError(503, detail ? `${summary}: ${detail}` : summary);
}

function rewriteUpdaterManifest(raw: string, siteOrigin: string, version: string): string {
  const base = `${siteOrigin}/desktop-updates/assets/${encodeURIComponent(version)}/`;
  return raw
    .split("\n")
    .map((line) => {
      const urlMatch = line.match(/^(\s*(?:-\s+)?(?:url|path):\s*)(.+?)\s*$/);
      if (!urlMatch) return line;
      const prefix = urlMatch[1]!;
      let value = urlMatch[2]!.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!value) return line;
      if (/^https?:\/\//i.test(value)) {
        try {
          const parsed = new URL(value);
          if (parsed.pathname.includes("/desktop-updates/feed/")) {
            const name = parsed.pathname.split("/").filter(Boolean).pop();
            if (name) {
              return `${prefix}${base}${encodeURIComponent(decodeURIComponent(name))}`;
            }
          }
        } catch {
          /* keep original */
        }
        return line;
      }
      return `${prefix}${base}${encodeURIComponent(value)}`;
    })
    .join("\n");
}
