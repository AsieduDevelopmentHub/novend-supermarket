# Subprocessors (draft)

> **LEGAL REVIEW REQUIRED**  
> This document is an engineering draft for counsel. It is **not** an approved
> customer-facing subprocessor schedule. Do not cite it as legally complete.

Last updated: 2026-09-23 (draft)

## Change notification (proposed)

Material subprocessor changes should be announced with reasonable advance notice
where required by contract or applicable law. Exact notice periods and customer
objection rights are **BLOCKED** pending legal review.

## Draft inventory

| Provider (legal name TBD)                                             | Purpose                                                     | Data categories (typical)                                    | Region (confirm)                 | Status                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------- | --------------------------------------- |
| Convex (Convex, Inc. or successor)                                    | Primary application database, auth hooks, backend functions | Organization business data, staff profiles, auth identifiers | Confirm Convex deployment region | DRAFT                                   |
| Vercel (Vercel Inc.)                                                  | Web app hosting / edge                                      | HTTP traffic, cookies, logs                                  | Confirm project region           | DRAFT                                   |
| Resend (or current transactional email vendor)                        | Transactional email (verification, resets)                  | Email addresses, message metadata                            | Confirm                          | DRAFT                                   |
| Paystack (Paystack Payments Limited / Stripe affiliate as applicable) | Subscription billing                                        | Billing identifiers, amounts, limited customer metadata      | Confirm                          | DRAFT                                   |
| GitHub (Microsoft)                                                    | Source control, CI, desktop/mobile release assets           | Source, build logs, release binaries                         | Confirm                          | DRAFT                                   |
| Error monitoring (e.g. Sentry)                                        | Application error reporting                                 | Stack traces, device/app metadata — **must scrub PII**       | Confirm                          | **NOT ENABLED** — no production DSN yet |
| Analytics / support tools                                             | Product analytics or support inbox (if/when used)           | TBD                                                          | TBD                              | DRAFT / unused until named              |

## Data categories reminder

Novend processes POS business data (products, inventory, sales, receipts,
customers, staff, payroll-related fields where enabled). Local devices also hold
an operational replica — see privacy documentation for the device threat model.

## Open questions for counsel

1. Exact legal names and DPA links for each provider.
2. Controller vs processor roles for customer content vs platform telemetry.
3. Transfer mechanisms for any cross-border processing.
4. Whether Android/iOS store distribution introduces additional subprocessors.
5. Customer notification and objection process wording for the DPA.
