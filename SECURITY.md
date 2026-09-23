# Security Policy

## Supported versions

Security fixes are applied to the latest released `main` line and to actively
supported tagged releases of Novend POS. Older tags may not receive patches.

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report privately so we can assess impact, prepare a fix, and coordinate
disclosure before details are public.

### Preferred channel

Email **security@asiedudevhub.com** with:

- A short description of the issue and its impact
- Steps to reproduce (or a proof of concept)
- Affected product surface (web, Electron desktop, Android, Convex API)
- Your preferred contact method and any disclosure timeline constraints

If that address is unreachable, use the repository’s GitHub **Security →
Advisories → Report a vulnerability** flow (private vulnerability reporting).

### What to expect

- We aim to acknowledge valid reports within **5 business days**.
- We will confirm whether the report is in scope and share a remediation plan
  when we have enough detail.
- Please give us a reasonable window to ship a fix before public disclosure.

### Out of scope (examples)

- Issues that require physical access to an unlocked till or an already
  compromised device profile
- Theoretical risks without a practical exploit path
- Reports against third-party services (Convex, Vercel, Paystack, etc.) — report
  those to the vendor; we still welcome notice if Novend misconfigures them

## Hardening notes for contributors

- Convex remains the authorization boundary; UI checks are not sufficient.
- Never commit secrets, keystores, or production credentials.
- See `docs/development/14-SECURITY_GUIDE.md` and
  `docs/PRODUCTION_READINESS_CHECKLIST.md` for engineering controls and
  release blockers.
