import { resolveHostingOrigins } from "@/lib/hosting/hosts";

const FALLBACK_ORIGIN = "https://novend-pos.vercel.app";

/**
 * Canonical public origin for sitemap, robots, Open Graph, and JSON-LD.
 * Prefer the marketing host when the deploy is split.
 */
export function getSiteOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const { appOrigin, marketingOrigin } = resolveHostingOrigins(env);
  const raw = (marketingOrigin || appOrigin || FALLBACK_ORIGIN).trim().replace(/\/+$/, "");
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProtocol).origin;
  } catch {
    return FALLBACK_ORIGIN;
  }
}

export function absoluteUrl(path: string, env: NodeJS.ProcessEnv = process.env): string {
  const origin = getSiteOrigin(env);
  if (!path || path === "/") return `${origin}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}
