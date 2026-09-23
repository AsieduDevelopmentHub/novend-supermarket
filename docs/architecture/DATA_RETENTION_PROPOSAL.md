# Data retention periods (proposal)

> **LEGAL REVIEW REQUIRED**  
> These periods are an engineering proposal only. They must not replace counsel-
> approved Privacy Policy / DPA language. Vague phrases such as “commercially
> reasonable period” remain in marketing/legal copy until this draft is approved
> and published.

Last updated: 2026-09-23 (draft)

## Proposed periods

| Record class                                                                               | Proposed retention                                                                    | Notes / open questions                               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Active organization business data (products, sales, receipts, customers, inventory, staff) | Duration of subscription / access + **90 days** after organization closure for export | Confirm statutory minima for Ghana and other markets |
| Closed organization active systems                                                         | Delete or de-identify within **90 days** after closure                                | Except legal hold / dispute                          |
| Encrypted portable / cloud backups                                                         | Rolling **30–90 days** after supersession or org closure                              | Align with backup product entitlements               |
| Application audit logs (business attribution)                                              | **24 months**                                                                         | May need longer for regulated industries             |
| Authentication / security logs (login failures, rate limits)                               | **12 months**                                                                         | Shorter if pure operational                          |
| Billing records (invoices, payment references, webhooks)                                   | **7 years** or statutory tax minimum                                                  | **Accountant confirmation required**                 |
| Support communications                                                                     | **24 months** after ticket close                                                      |                                                      |
| Failed imports / uploads                                                                   | **30 days** then purge                                                                | Unless tied to an open support case                  |
| Platform telemetry (`platformEvents` detail rows)                                          | **90 days** (already implemented for detailed rows)                                   | Durable rollups may retain counts longer             |
| Device presence / update check metadata                                                    | **90 days**                                                                           | Confirm product need                                 |

## Employee / payroll data (P2-4)

Salary, commission, attendance, and payroll exports need a separate notice and
usually **stricter** access and retention than ordinary POS customer data.
Proposal: retain payroll payment records for the same statutory period as
billing (**7 years** pending accountant confirmation); restrict exports to
administrator/owner roles only.

## Status

| Step                                           | Status      |
| ---------------------------------------------- | ----------- |
| Engineering draft                              | DONE        |
| Legal approval                                 | **BLOCKED** |
| Privacy Policy / DPA update                    | **BLOCKED** |
| Automated purge jobs matching approved periods | Not started |
