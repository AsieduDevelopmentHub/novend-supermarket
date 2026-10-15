import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Security headers (CSP, frame options, etc.) are applied in `proxy.ts`.
// App/auth use a per-request nonce CSP; public marketing uses a static CSP.
// Keep image / HMR config here only.

const nextConfig: NextConfig = {
  // Packaged Electron embeds this tree and serves it on 127.0.0.1 (no hosted URL).
  output: "standalone",
  // Allow LAN devices to use HMR when opening the app via local IP.
  allowedDevOrigins: ["192.168.1.202", "127.0.0.1", "localhost", "10.0.2.2"],
  images: {
    // Next 16 requires an explicit allowlist for <Image quality={…}>.
    qualities: [75, 90, 100],
    // Marketing assets are versioned via ?v= / hashed names — cache optimizer output longer.
    minimumCacheTTL: 86400,
    localPatterns: [
      // Allow ?v= cache-bust on marketing assets (Next 16 requires this).
      { pathname: "/marketing/**" },
      { pathname: "/branding/**" },
      // All other local public images — no query string.
      { pathname: "/**", search: "" },
    ],
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "*.convex.cloud" },
    ],
  },
};

const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent: true,
      widenClientFileUpload: false,
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
    })
  : nextConfig;
