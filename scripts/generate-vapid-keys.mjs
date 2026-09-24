#!/usr/bin/env node
/**
 * Generate VAPID keys for Web Push.
 *
 * Usage:
 *   node scripts/generate-vapid-keys.mjs
 *
 * Then set on Convex (private) and Next (public):
 *   npx convex env set VAPID_PUBLIC_KEY "<public>"
 *   npx convex env set VAPID_PRIVATE_KEY "<private>"
 *   npx convex env set VAPID_SUBJECT "mailto:support@yourdomain.com"
 *   # and in .env.local / Vercel:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public>
 */

import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("VAPID_PUBLIC_KEY=" + keys.publicKey);
console.log("VAPID_PRIVATE_KEY=" + keys.privateKey);
console.log("VAPID_SUBJECT=mailto:support@yourdomain.com");
console.log("");
console.log("Client (Next / Vercel):");
console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + keys.publicKey);
console.log("");
console.log("Never commit the private key.");
