#!/usr/bin/env node
/**
 * Verify DESKTOP_RELEASE_GITHUB_TOKEN can read private GitHub Release assets.
 *
 * Usage:
 *   DESKTOP_RELEASE_GITHUB_TOKEN=... node scripts/verify-desktop-github-token.mjs
 *   DESKTOP_RELEASE_GITHUB_TOKEN=... node scripts/verify-desktop-github-token.mjs --tag v0.1.3
 *
 * Exits 0 when the token can resolve a release asset redirect; exits 1 otherwise.
 * Never prints the token value.
 */
const repo = process.env.GITHUB_REPOSITORY || "AsieduDevelopmentHub/novend-pos";
const tag = process.argv.includes("--tag")
  ? process.argv[process.argv.indexOf("--tag") + 1]
  : process.env.RELEASE_TAG || "v0.1.3";
const token = process.env.DESKTOP_RELEASE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";

if (!token) {
  console.error("Missing DESKTOP_RELEASE_GITHUB_TOKEN (or GITHUB_TOKEN)");
  process.exit(1);
}

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "NovendPOS-DesktopTokenCheck",
};

const releaseResponse = await fetch(
  `https://api.github.com/repos/${repo}/releases/tags/${tag}`,
  { headers },
);
const releaseBody = await releaseResponse.text();

if (!releaseResponse.ok) {
  console.error(`Release lookup failed (${releaseResponse.status}) for ${repo} ${tag}`);
  console.error(releaseBody.slice(0, 300));
  if (releaseResponse.status === 401 || releaseResponse.status === 403) {
    console.error(
      "\nFix: create a classic PAT with repo scope, or a fine-grained PAT with read access to",
    );
    console.error(`${repo} (Contents: Read), then run:`);
    console.error("  pnpm exec convex env set DESKTOP_RELEASE_GITHUB_TOKEN <token>");
  }
  process.exit(1);
}

const release = JSON.parse(releaseBody);
const asset =
  release.assets?.find((entry) => entry.name.endsWith(".exe")) ||
  release.assets?.find((entry) => !entry.name.endsWith(".yml"));
if (!asset) {
  console.error(`No installer assets on ${tag}`);
  process.exit(1);
}

const assetResponse = await fetch(
  `https://api.github.com/repos/${repo}/releases/assets/${asset.id}`,
  {
    redirect: "manual",
    headers: {
      ...headers,
      Accept: "application/octet-stream",
    },
  },
);

if (assetResponse.status >= 300 && assetResponse.status < 400) {
  const location = assetResponse.headers.get("location");
  console.log(`OK: ${tag} asset "${asset.name}" redirects (${assetResponse.status})`);
  console.log(location ? `Redirect host: ${new URL(location).host}` : "Redirect location present");
  process.exit(0);
}

const assetDetail = await assetResponse.text().catch(() => "");
console.error(`Asset fetch failed (${assetResponse.status}) for ${asset.name}`);
console.error(assetDetail.slice(0, 300));
process.exit(1);
