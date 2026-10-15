#!/usr/bin/env node
/**
 * Issue an offline Millie's Supermarket license key.
 *
 * Usage:
 *   pnpm run license:issue -- --customer "Millie's Main Store"
 *   pnpm run license:issue -- --customer "Millie's" --days 365
 *   pnpm run license:issue -- --customer "Millie's" --machine <machineId>
 *   pnpm run license:issue -- --customer "Millie's" --perpetual
 *
 * Secret: NEXT_PUBLIC_MILLIES_LICENSE_SECRET or MILLIES_LICENSE_SECRET
 * (must match the app build). Default matches lib/millies-license/constants.ts.
 */
import { createHmac } from "node:crypto";

const DEFAULT_SECRET = "milliesmart-asiedu-default-v1";
const PREFIX = "NMIL";

function usage() {
  console.log(`Usage:
  pnpm run license:issue -- --customer "Store Name" [--days 365] [--machine <id>] [--perpetual]

Options:
  --customer   Required. Label stored in the key (shown on activation).
  --days       License validity from now (default: perpetual).
  --perpetual  Explicit perpetual license (default when --days omitted).
  --machine    Optional. Lock key to this machine ID at issue time.
  --issued-at  Optional unix ms issued timestamp (default: now).
`);
}

function parseArgs(argv) {
  const out = {
    customer: null,
    days: null,
    machine: null,
    perpetual: false,
    issuedAt: Date.now(),
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--customer") out.customer = argv[++i];
    else if (a === "--days") out.days = Number(argv[++i]);
    else if (a === "--machine") out.machine = argv[++i];
    else if (a === "--perpetual") out.perpetual = true;
    else if (a === "--issued-at") out.issuedAt = Number(argv[++i]);
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function toBase64Url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function issue(payload, secret) {
  const body = toBase64Url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body, "utf8").digest("hex").slice(0, 32);
  return `${PREFIX}.${body}.${sig}`;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.customer?.trim()) {
  usage();
  process.exit(args.help ? 0 : 1);
}

if (args.days != null && (!Number.isFinite(args.days) || args.days <= 0)) {
  console.error("--days must be a positive number");
  process.exit(1);
}

const secret =
  process.env.MILLIES_LICENSE_SECRET?.trim() ||
  process.env.NEXT_PUBLIC_MILLIES_LICENSE_SECRET?.trim() ||
  DEFAULT_SECRET;
const expiresAt =
  args.perpetual || args.days == null
    ? null
    : args.issuedAt + args.days * 24 * 60 * 60 * 1000;

const payload = {
  v: 1,
  c: args.customer.trim(),
  i: args.issuedAt,
  e: expiresAt,
  m: args.machine?.trim() || null,
};

const key = issue(payload, secret);
const expiresLabel = payload.e ? new Date(payload.e).toISOString() : "perpetual";
const machineLabel = payload.m || "(binds on first activation)";

console.log("");
console.log("Millie's Supermarket license");
console.log("----------------------------");
console.log(`Customer : ${payload.c}`);
console.log(`Expires  : ${expiresLabel}`);
console.log(`Machine  : ${machineLabel}`);
console.log("");
console.log(key);
console.log("");

if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `license_key<<EOF\n${key}\nEOF\ncustomer=${payload.c}\nexpires=${expiresLabel}\nmachine=${machineLabel}\n`,
  );
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Millie's Supermarket license\n\n| Field | Value |\n| --- | --- |\n| Customer | ${payload.c} |\n| Expires | ${expiresLabel} |\n| Machine | \`${machineLabel}\` |\n\n\`\`\`\n${key}\n\`\`\`\n`,
  );
}
