import type { NextConfig } from "next";

// Security headers (CSP, frame options, etc.) are applied in `proxy.ts`
// so CSP can use a per-request nonce. Keep image / HMR config here only.

const nextConfig: NextConfig = {
  // Allow LAN devices to use HMR when opening the app via local IP.
  allowedDevOrigins: ["192.168.1.202", "127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "*.convex.cloud" },
    ],
  },
};

export default nextConfig;
