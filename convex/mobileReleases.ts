import { v } from "convex/values";
import { httpAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { requirePlatformAdmin } from "./shared/permissions";

const channelValidator = v.union(v.literal("stable"), v.literal("beta"));

const storeUrlsValidator = v.object({
  android: v.optional(v.string()),
  ios: v.optional(v.string()),
});

const assetValidator = v.object({
  platform: v.union(v.literal("android"), v.literal("ios")),
  kind: v.union(v.literal("apk"), v.literal("aab"), v.literal("ipa")),
  fileName: v.string(),
  contentType: v.optional(v.string()),
  size: v.optional(v.number()),
  sha256: v.optional(v.string()),
  githubAssetId: v.number(),
});

type MobilePlatform = "android" | "ios";
type AssetKind = "apk" | "aab" | "ipa";

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
    : (request.headers.get("x-mobile-release-secret") || "").trim();
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

function assetDownloadUrl(version: string, fileName: string): string | null {
  const site = (process.env.CONVEX_SITE_URL || "").replace(/\/$/, "");
  if (!site) return null;
  return `${site}/mobile-updates/assets/${encodeURIComponent(version)}/${encodeURIComponent(fileName)}`;
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
    storeUrls: storeUrlsValidator,
    assets: v.array(assetValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mobileReleases")
      .withIndex("by_tag", (q) => q.eq("tag", args.tag))
      .unique();
    const publishedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, publishedAt });
      return existing._id;
    }
    return await ctx.db.insert("mobileReleases", { ...args, publishedAt });
  },
});

export const getLatest = internalQuery({
  args: { channel: channelValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mobileReleases")
      .withIndex("by_channel_releasedAt", (q) => q.eq("channel", args.channel))
      .order("desc")
      .first();
  },
});

export const getByVersion = internalQuery({
  args: { version: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mobileReleases")
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
      .query("mobileReleases")
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
      .query("mobileReleases")
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

export const listPublicRecent = query({
  args: { channel: v.optional(channelValidator), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const channel = args.channel ?? "stable";
    const limit = Math.min(Math.max(args.limit ?? 5, 1), 20);
    const rows = await ctx.db
      .query("mobileReleases")
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

type InstallKind = "android-apk" | "android-aab" | "ios-ipa";

const INSTALL_KIND_META: Record<
  InstallKind,
  {
    platform: MobilePlatform;
    label: string;
    description: string;
    match: (fileName: string, kind: AssetKind) => boolean;
  }
> = {
  "android-apk": {
    platform: "android",
    label: "Android (APK)",
    description: "Direct install for phones and tablets (enable unknown sources)",
    match: (_fileName, kind) => kind === "apk",
  },
  "android-aab": {
    platform: "android",
    label: "Android (AAB)",
    description: "Play Store bundle for sideload tools or internal distribution",
    match: (_fileName, kind) => kind === "aab",
  },
  "ios-ipa": {
    platform: "ios",
    label: "iOS",
    description: "Enterprise or TestFlight distribution",
    match: (_fileName, kind) => kind === "ipa",
  },
};

function pickAsset(
  assets: Doc<"mobileReleases">["assets"],
  platform: MobilePlatform,
  preferredKind: AssetKind,
) {
  const byKind = assets.filter((asset) => asset.platform === platform && asset.kind === preferredKind);
  if (byKind.length > 0) return byKind[0]!;
  return assets.find((asset) => asset.platform === platform) ?? null;
}

export const getInstallOffer = query({
  args: { channel: v.optional(channelValidator) },
  handler: async (ctx, args) => {
    const channel = args.channel ?? "stable";
    const release = await ctx.db
      .query("mobileReleases")
      .withIndex("by_channel_releasedAt", (q) => q.eq("channel", channel))
      .order("desc")
      .first();
    if (!release) return null;

    const downloads: Partial<
      Record<
        MobilePlatform,
        { platform: MobilePlatform; kind: AssetKind; fileName: string; size?: number; url: string }
      >
    > = {};

    const androidApk = pickAsset(release.assets, "android", "apk");
    if (androidApk) {
      const url = assetDownloadUrl(release.version, androidApk.fileName);
      if (url) {
        downloads.android = {
          platform: "android",
          kind: androidApk.kind,
          fileName: androidApk.fileName,
          size: androidApk.size,
          url,
        };
      }
    }

    const iosAsset = pickAsset(release.assets, "ios", "ipa");
    if (iosAsset) {
      const url = assetDownloadUrl(release.version, iosAsset.fileName);
      if (url) {
        downloads.ios = {
          platform: "ios",
          kind: iosAsset.kind,
          fileName: iosAsset.fileName,
          size: iosAsset.size,
          url,
        };
      }
    }

    const installerKinds: InstallKind[] = ["android-apk", "android-aab", "ios-ipa"];
    const installers: Array<{
      kind: InstallKind;
      platform: MobilePlatform;
      label: string;
      description: string;
      fileName: string;
      size?: number;
      url: string;
    }> = [];

    for (const kind of installerKinds) {
      const meta = INSTALL_KIND_META[kind];
      const asset = release.assets.find(
        (entry) => entry.platform === meta.platform && meta.match(entry.fileName, entry.kind),
      );
      if (!asset) continue;
      const url = assetDownloadUrl(release.version, asset.fileName);
      if (!url) continue;
      installers.push({
        kind,
        platform: meta.platform,
        label: meta.label,
        description: meta.description,
        fileName: asset.fileName,
        size: asset.size,
        url,
      });
    }

    if (
      Object.keys(downloads).length === 0 &&
      installers.length === 0 &&
      !release.storeUrls.android &&
      !release.storeUrls.ios
    ) {
      return null;
    }

    return {
      version: release.version,
      tag: release.tag,
      channel: release.channel,
      notes: release.notes,
      releasedAt: release.releasedAt,
      mandatory: release.mandatory,
      storeUrls: release.storeUrls,
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
  const storeUrlsRaw = (payload.storeUrls || {}) as Record<string, unknown>;
  const channel = payload.channel === "beta" ? "beta" : "stable";
  const replaceChannel = payload.replaceChannel === true;

  try {
    const id = await ctx.runMutation(internal.mobileReleases.upsertRelease, {
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
      storeUrls: {
        android: storeUrlsRaw.android ? String(storeUrlsRaw.android) : undefined,
        ios: storeUrlsRaw.ios ? String(storeUrlsRaw.ios) : undefined,
      },
      assets: assets.map((raw) => {
        const a = raw as Record<string, unknown>;
        let platform: MobilePlatform = "android";
        if (a.platform === "ios") platform = "ios";
        let kind: AssetKind = "apk";
        if (a.kind === "aab") kind = "aab";
        else if (a.kind === "ipa") kind = "ipa";
        else if (a.kind === "apk") kind = "apk";
        else {
          const lower = String(a.fileName || "").toLowerCase();
          if (lower.endsWith(".aab")) kind = "aab";
          else if (lower.endsWith(".ipa")) kind = "ipa";
        }
        return {
          platform,
          kind,
          fileName: String(a.fileName || ""),
          contentType: a.contentType ? String(a.contentType) : undefined,
          size: typeof a.size === "number" ? a.size : undefined,
          sha256: a.sha256 ? String(a.sha256) : undefined,
          githubAssetId: Number(a.githubAssetId) || 0,
        };
      }),
    });

    let purged: { deleted: number; kept: string | null } | null = null;
    if (replaceChannel) {
      purged = await ctx.runMutation(internal.mobileReleases.purgeChannel, {
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
    const result = await ctx.runMutation(internal.mobileReleases.purgeChannel, { channel });
    purged.push({ channel, ...result });
  }

  return new Response(JSON.stringify({ ok: true, purged }), {
    status: 200,
    headers: { "content-type": "application/json" },
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

  const release = await ctx.runQuery(internal.mobileReleases.getByVersion, { version });
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
  const release = await ctx.runQuery(internal.mobileReleases.getLatest, { channel });
  if (!release) {
    return new Response(JSON.stringify({ ok: false, error: "No releases" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const androidApk = pickAsset(release.assets, "android", "apk");

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
      storeUrl: release.storeUrls.android || release.storeUrls.ios,
      storeUrls: release.storeUrls,
      downloadUrl: androidApk
        ? assetDownloadUrl(release.version, androidApk.fileName)
        : undefined,
      assets: release.assets.map((entry) => ({
        platform: entry.platform,
        kind: entry.kind,
        fileName: entry.fileName,
        size: entry.size,
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

async function redirectGithubAsset(release: Doc<"mobileReleases">, fileName: string) {
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
        "User-Agent": "NovendPOS-MobileUpdater",
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
      "GitHub returned asset bytes instead of a redirect; configure DESKTOP_RELEASE_GITHUB_TOKEN and retry",
    );
  }

  const detail = await githubResponse.text().catch(() => "");
  const summary =
    githubResponse.status === 401 || githubResponse.status === 403
      ? "GitHub rejected DESKTOP_RELEASE_GITHUB_TOKEN (needs read access to private release assets)"
      : `GitHub asset fetch failed (${githubResponse.status})`;
  return upstreamError(503, detail ? `${summary}: ${detail}` : summary);
}
