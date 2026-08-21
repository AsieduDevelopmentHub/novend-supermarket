/**
 * Confirms the Paystack secret can talk to the API without creating a charge.
 *
 *   node --env-file=.env.local scripts/smoke-paystack-api.mjs
 */
const secret = process.env.PAYSTACK_SECRET_KEY;

if (!secret) {
  console.error("PAYSTACK_SECRET_KEY is not set.");
  process.exit(1);
}

const response = await fetch("https://api.paystack.co/plan", {
  headers: { authorization: `Bearer ${secret}` },
});
const payload = await response.json();

if (!response.ok || payload?.status !== true) {
  console.error("FAIL  Paystack API", response.status, payload?.message ?? payload);
  process.exit(1);
}

const plans = Array.isArray(payload.data) ? payload.data : [];
console.log(`PASS  Paystack API reachable — ${plans.length} plan(s) on this key.`);
process.exit(0);
