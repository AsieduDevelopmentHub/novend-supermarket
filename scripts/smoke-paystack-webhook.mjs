/**
 * Smoke test for the Paystack webhook endpoint.
 *
 * Verifies signature enforcement and graceful handling of unknown references
 * against a real deployment. Run with:
 *   node scripts/smoke-paystack-webhook.mjs <convex-site-url>
 */
import crypto from "node:crypto";

const siteUrl = process.argv[2] ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
const secret = process.env.PAYSTACK_SECRET_KEY;

if (!siteUrl || !secret) {
  console.error(
    "Usage: PAYSTACK_SECRET_KEY=... node scripts/smoke-paystack-webhook.mjs <convex-site-url>",
  );
  process.exit(1);
}

const endpoint = `${siteUrl.replace(/\/$/, "")}/billing/paystack/webhook`;

function sign(body) {
  return crypto.createHmac("sha512", secret).update(body).digest("hex");
}

async function post(body, signature) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature ? { "x-paystack-signature": signature } : {}),
    },
    body,
  });
  return { status: response.status, text: await response.text() };
}

const cases = [
  {
    name: "rejects a missing signature",
    body: JSON.stringify({ event: "charge.success", data: {} }),
    signature: null,
    expect: 401,
  },
  {
    name: "rejects a forged signature",
    body: JSON.stringify({ event: "charge.success", data: {} }),
    signature: "0".repeat(128),
    expect: 401,
  },
  {
    name: "accepts a signed event with an unknown reference",
    body: JSON.stringify({
      event: "charge.success",
      data: {
        reference: `SMOKE-${Date.now()}`,
        amount: 29900,
        currency: "GHS",
        status: "success",
        paid_at: new Date().toISOString(),
        customer: { customer_code: "CUS_smoke" },
      },
    }),
    signed: true,
    expect: 200,
  },
  {
    name: "accepts a signed subscription.disable for an unknown subscription",
    body: JSON.stringify({
      event: "subscription.disable",
      data: { subscription_code: "SUB_smoke_unknown", status: "complete" },
    }),
    signed: true,
    expect: 200,
  },
];

let failures = 0;
for (const testCase of cases) {
  const signature = testCase.signed ? sign(testCase.body) : testCase.signature;
  const result = await post(testCase.body, signature);
  const ok = result.status === testCase.expect;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${testCase.name} — expected ${testCase.expect}, got ${result.status} ${result.text.slice(0, 120)}`,
  );
}

console.log(
  failures === 0 ? "\nAll webhook smoke checks passed." : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
