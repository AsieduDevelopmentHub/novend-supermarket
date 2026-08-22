import type { NextConfig } from "next";

// Security headers (CSP, frame options, etc.) are applied in `proxy.ts`
// so CSP can use a per-request nonce. Keep image / HMR config here only.

const nextConfig: NextConfig = {
  // Allow LAN devices to use HMR when opening the app via local IP.
  allowedDevOrigins: ["192.168.1.202", "127.0.0.1", "localhost"],
  images: {
    // Marketing PNGs change often during design iteration — don't hold them long.
    minimumCacheTTL: 60,
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

export default nextConfig;
