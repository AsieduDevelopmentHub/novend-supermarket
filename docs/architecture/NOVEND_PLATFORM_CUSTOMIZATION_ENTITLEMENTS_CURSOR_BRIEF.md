# Novend Platform-Controlled Customization, Entitlements & Billing — Cursor Implementation Brief

## 1. Goal

Give the Novend platform administrator centralized control over each organization's visual identity, visible modules, usable capabilities, billing visibility, and negotiated pricing.

This should make Novend feel configured for each business while preserving one maintainable product and one secure authorization system.

Also reduce unnecessary Vercel Fluid CPU usage caused by dynamic rendering and middleware work on public/static traffic.

## 2. Confirmed Product Decisions

- Only platform administrators can control organization accent colors, sidebar colors, visual presets, feature access, billing visibility, and custom offers.
- Organization administrators cannot change platform-controlled branding or entitlements.
- New organizations can inherit a default experience policy based on their creation time.
- Existing organizations keep their assigned snapshot unless a platform administrator deliberately changes or migrates them.
- Public subscription choices are Monthly and Annual only.
- Annual is selected by default; Monthly is the alternate toggle.
- Remove Lifetime from new sales and public pricing.
- Do not delete historical Lifetime subscriptions. Treat them as a legacy plan until explicitly migrated.
- The platform administrator can hide the Billing section for an organization.
- A hidden Billing page must not disable payment enforcement or create free access.
- Features must be gated in navigation, UI, local/offline behavior, and authoritative Convex mutations/queries.
- Custom pricing is private to the assigned organization and must never leak into the public plan catalog or another tenant.
- Describe customized deployments honestly as “configured for your business” or “your Novend workspace.” Do not falsely claim that the underlying software was uniquely developed for that customer.

## 3. Architecture Overview

Create four separate concepts instead of one large settings JSON:

1. **Experience Preset** — reusable platform-owned colors and appearance values.
2. **Organization Experience Assignment** — which preset and optional overrides an organization receives.
3. **Feature Entitlements** — which product capabilities are enabled, disabled, or inherited.
4. **Commercial Offer** — the private monthly/annual prices and limits available to one organization.

Do not use Vercel Flags as the source of truth for tenant entitlements. Novend must work offline, and Convex already owns organization licensing. Keep organization entitlements in Convex and copy the resolved result into the offline licence snapshot. Vercel Flags may later be used only for engineering rollouts or experiments.

## 4. Data Model

### 4.1 Experience presets

Add `experiencePresets`:

```ts
experiencePresets: defineTable({
  key: v.string(),                    // e.g. novend-default, retail-blue, pharmacy-green
  name: v.string(),
  status: v.union(v.literal("active"), v.literal("archived")),
  accent: v.string(),                 // validated #RRGGBB
  accentForeground: v.string(),
  sidebarBackground: v.string(),
  sidebarForeground: v.string(),
  sidebarAccent: v.string(),
  sidebarAccentForeground: v.string(),
  focusRing: v.string(),
  success: v.string(),
  warning: v.string(),
  danger: v.string(),
  radiusScale: v.union(v.literal("compact"), v.literal("default"), v.literal("soft")),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_key", ["key"])
  .index("by_status", ["status"])
```

Rules:

- Store semantic tokens, not arbitrary CSS.
- Reject unsafe values such as `url()`, `var()`, gradients, malformed hex, or user-supplied CSS.
- Validate contrast before save. Accent/foreground and sidebar/foreground combinations must meet WCAG AA for normal interface text.
- Presets are platform-owned and read-only to tenants.
- Archiving a preset prevents new assignments but does not break organizations already using it.

### 4.2 Organization experience assignment

Add to `organizations`:

```ts
experiencePresetId: v.optional(v.id("experiencePresets")),
experienceOverrides: v.optional(v.object({
  accent: v.optional(v.string()),
  accentForeground: v.optional(v.string()),
  sidebarBackground: v.optional(v.string()),
  sidebarForeground: v.optional(v.string()),
  sidebarAccent: v.optional(v.string()),
  sidebarAccentForeground: v.optional(v.string()),
})),
experienceVersion: v.optional(v.number()),
```

Prefer assigning a reusable preset. Use organization overrides only for negotiated/customized customers.

Do not allow custom logos, product names, email sender identities, or domains in the first implementation. Color customization is low risk; full white-labeling introduces trademark, support, email, domain, app-store, and legal complexity and should be a separate phase.

### 4.3 Default policy for future organizations

Add `organizationProvisioningPolicies`:

```ts
organizationProvisioningPolicies: defineTable({
  name: v.string(),
  status: v.union(v.literal("scheduled"), v.literal("active"), v.literal("retired")),
  effectiveFrom: v.number(),
  experiencePresetId: v.id("experiencePresets"),
  featureTemplateId: v.optional(v.id("featureTemplates")),
  publicPlanKey: v.optional(v.union(v.literal("basic"), v.literal("pro"), v.literal("enterprise"))),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_status_effectiveFrom", ["status", "effectiveFrom"])
```

Provisioning behavior:

- `provisionOrganization` resolves the latest active policy where `effectiveFrom <= now`.
- Copy the resolved preset/template IDs to the organization at creation time.
- Do not dynamically link all old organizations to the newest default. A default change affects future organizations only.
- Provide a separate audited “Apply to selected existing organizations” bulk action.
- At most one policy may be active for a given instant. Validate overlapping schedules.

### 4.4 Feature registry

Create one typed feature registry in code:

```ts
export const FEATURE_KEYS = [
  "billing.view",
  "billing.selfServeCheckout",
  "products.images",
  "inventory.wholesale",
  "branches.multiBranch",
  "reports.advanced",
  "reports.pdf",
  "reports.xlsx",
  "staff.compensation",
  "customerDisplay",
  "cloud.backup",
  "cloud.remoteMonitoring",
  "imports.products",
  "exports.reports",
] as const;
```

Every key needs metadata:

- label;
- description;
- category;
- default behavior;
- prerequisite features;
- offline behavior;
- relevant routes/navigation items;
- authoritative backend operations that enforce it.

Do not allow arbitrary database strings to create unknown features.

### 4.5 Feature templates and per-organization overrides

Add `featureTemplates`:

```ts
featureTemplates: defineTable({
  key: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  values: v.array(v.object({
    feature: featureKeyValidator,
    enabled: v.boolean(),
  })),
  status: v.union(v.literal("active"), v.literal("archived")),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_key", ["key"])
```

Add to `organizations`:

```ts
featureTemplateId: v.optional(v.id("featureTemplates")),
featureOverrides: v.optional(v.array(v.object({
  feature: featureKeyValidator,
  value: v.union(
    v.literal("inherit"),
    v.literal("enabled"),
    v.literal("disabled"),
  ),
}))),
featureEntitlementVersion: v.optional(v.number()),
billingVisibility: v.optional(v.union(
  v.literal("visible"),
  v.literal("hidden"),
  v.literal("custom_offer_only"),
)),
```

Use tri-state overrides so removing an override returns the organization to template/plan behavior.

### 4.6 Entitlement precedence

Resolve each capability in this order:

1. Platform safety kill switch, if one exists.
2. Organization status/licence write access.
3. Explicit organization feature override.
4. Organization feature template.
5. Private commercial offer feature override.
6. Plan-derived capability.
7. Secure default.

Rules:

- A prerequisite disabled higher in the tree disables dependent features.
- A plan limit and a feature switch solve different problems. Keep them separate.
- “Hidden from navigation” is not the same as “disabled.” A disabled capability must fail on the backend.
- Return a structured denial: `{ code, feature, reason, upgradeAllowed }`.

## 5. Resolved Organization Configuration

Create a single resolver shared by session bootstrap and licence snapshots:

```ts
type ResolvedOrganizationConfig = {
  organizationId: Id<"organizations">;
  version: number;
  experience: ResolvedExperienceTokens;
  features: Record<FeatureKey, boolean>;
  billingVisibility: "visible" | "hidden" | "custom_offer_only";
  commercial: {
    planKey: "basic" | "pro" | "enterprise";
    offerId?: Id<"commercialOffers">;
    canSelfServe: boolean;
  };
};
```

Requirements:

- Resolve once in Convex, not separately in every React component.
- Cache/store it in the local Dexie organization/licence snapshot.
- Increment a monotonic version whenever experience, features, plan, offer, or organization status changes.
- Sync clients invalidate and replace cached configuration when the version increases.
- New devices must connect once to obtain a valid configuration.
- An offline device uses the last signed/validated configuration within the existing licence TTL.
- Platform disablement must be reflected at the next successful sync; do not pretend it can instantly disable a disconnected terminal.

## 6. Theme Application

### 6.1 CSS token layer

Map resolved tokens to CSS variables on the authenticated app root:

```css
--primary
--primary-foreground
--ring
--sidebar
--sidebar-foreground
--sidebar-primary
--sidebar-primary-foreground
--success
--warning
--destructive
--radius
```

- Apply variables before the app shell paints to prevent a default-blue flash.
- Cache the latest resolved tokens in Dexie/local storage for offline boot.
- Add `data-experience-version` to the app root for diagnostics.
- Do not overwrite user light/dark preference. Experience tokens provide both compatible light and dark variants, or derive dark variants using validated platform logic.
- Receipt styling, exported reports, and printed invoices should remain stable unless explicitly included in the preset. Do not accidentally recolor legally important documents.

### 6.2 Platform UI

In the organization detail page, add an `Experience` tab containing:

- preset selector;
- live sidebar/button/form preview;
- optional organization color overrides;
- contrast validation results;
- Reset to preset;
- Save draft;
- Publish;
- assignment history and audit details.

Use draft/publish behavior so a partially edited color set never reaches production terminals.

Add a Platform → Configuration → Experience presets page for creating, previewing, archiving, and scheduling defaults for future organizations.

## 7. Feature Control UI

Add an `Entitlements` tab to the platform organization detail view.

UI structure:

- Search input.
- Category accordion: Commerce, Inventory, Branches, Reports, Staff, Hardware, Cloud, Billing.
- Each row shows feature name, inherited source, effective state, override control, and dependency warning.
- Control options: Inherit / Enabled / Disabled.
- Show “Effective from Pro plan,” “Enabled by Retail template,” or “Disabled by organization override.”
- Save changes in one mutation, validate dependencies, increment entitlement versions, and write one audit event containing the diff.

Do not expose this page or its mutations to organization administrators.

### Enforcement checklist for every feature

- navigation visibility;
- route guard;
- page empty/disabled state;
- action/button visibility;
- Convex mutation authorization;
- Convex query data exposure where sensitive;
- background job behavior;
- import/export path;
- local Dexie write path;
- sync/outbox replay;
- offline licence snapshot.

If a previously enabled feature is disabled while there are pending offline operations:

- do not silently delete the operations;
- quarantine them as `blocked_by_entitlement`;
- show the organization administrator a safe resolution notice after reconnecting;
- allow platform support to inspect and resolve them.

## 8. Billing and Pricing Changes

### 8.1 Remove Lifetime safely

Do not immediately remove `lifetime` from validators because historical rows and cached offline licences may contain it.

Migration sequence:

1. Mark Lifetime `sellable: false` and `legacy: true` in the catalog.
2. Remove it from public pricing, checkout, new organization assignment, and platform plan selectors for new subscriptions.
3. Keep resolution and access rules for existing Lifetime organizations.
4. Add tests proving legacy Lifetime customers retain access.
5. After every legacy organization is migrated and old client versions expire, consider a later schema cleanup.

Change `DEFAULT_PLAN_KEY` from `lifetime` to `basic`. Unknown plan data must never fall back to the most powerful entitlement set.

### 8.2 Annual default

- Rename UI text from `Yearly` to `Annual` while keeping internal cycle value `yearly` unless a full migration is justified.
- Initial pricing state must be `yearly`.
- Toggle label order: `Annual` first, `Monthly` second.
- Show `2 months free` beside Annual.
- Preserve the selected cycle in the URL only when helpful, for example `?billing=monthly`; absence means Annual.
- Checkout must receive the selected cycle explicitly and revalidate that the plan supports it.

### 8.3 Billing visibility

Use the resolved `billingVisibility`:

- `visible`: show Billing, public plans, subscription state, invoices/history, and allowed checkout actions.
- `hidden`: remove Billing navigation and tenant billing routes; platform admin manages the organization commercially.
- `custom_offer_only`: show Billing but only show the assigned custom offer, current subscription state, invoices/history, and actions allowed by that offer.

Direct route access must use the same decision. Do not merely hide the sidebar item.

Payment callbacks and webhooks must remain operational even when the UI is hidden.

## 9. Custom Commercial Offers

Add `commercialOffers`:

```ts
commercialOffers: defineTable({
  organizationId: v.id("organizations"),
  name: v.string(),
  status: v.union(
    v.literal("draft"),
    v.literal("active"),
    v.literal("accepted"),
    v.literal("expired"),
    v.literal("withdrawn"),
  ),
  basePlanKey: v.union(v.literal("basic"), v.literal("pro"), v.literal("enterprise")),
  currency: v.string(),
  monthlyPrice: v.optional(v.number()),
  yearlyPrice: v.optional(v.number()),
  allowedCycles: v.array(v.union(v.literal("monthly"), v.literal("yearly"))),
  limitOverrides: v.optional(limitOverridesValidator),
  featureOverrides: v.optional(v.array(v.object({
    feature: featureKeyValidator,
    enabled: v.boolean(),
  }))),
  validFrom: v.number(),
  validUntil: v.optional(v.number()),
  notesInternal: v.optional(v.string()),
  customerMessage: v.optional(v.string()),
  createdBy: v.id("users"),
  approvedBy: v.optional(v.id("users")),
  acceptedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_organization_status", ["organizationId", "status"])
```

Rules:

- Exactly one active/accepted offer per organization.
- Prices are stored in the smallest currency unit or with a clearly enforced integer-major-unit convention matching current Paystack code. Do not mix conventions.
- Public APIs never list offers belonging to another organization.
- Tenant queries derive organization identity from the authenticated session; never accept arbitrary `organizationId` from the client.
- Internal notes are platform-only and never included in tenant responses.
- Activating an offer creates or updates the Paystack recurring plan/customer arrangement through the existing billing provider abstraction.
- Webhook application must validate the expected organization, offer, amount, cycle, and reference.
- Offer modifications after acceptance create a new revision; do not silently rewrite agreed commercial terms.
- Audit create, approve, publish, accept, withdraw, expire, and price changes.

Tenant experience for `custom_offer_only`:

- Heading: `Your Novend plan`.
- Show only the negotiated plan name, monthly/annual choices allowed by the offer, included limits, included capabilities, renewal terms, and support contact.
- Do not show public Basic/Pro/Enterprise cards beside it.
- Do not falsely label it “custom-built software.” Use “configured for [Business Name]” or “custom commercial plan.”

## 10. Platform Admin Workflow

Organization detail tabs should become:

1. Overview
2. Licence & limits
3. Experience
4. Entitlements
5. Commercial offer
6. Devices
7. Activity/audit

Recommended actions:

- Assign experience preset.
- Preview tenant shell.
- Publish organization overrides.
- Assign feature template.
- Override individual capabilities.
- Set Billing visibility.
- Create/approve/publish a private offer.
- View effective configuration and its source.
- Copy configuration from another organization, with a confirmation screen showing the diff.
- Schedule default policy for organizations created after a chosen timestamp.
- Bulk-apply a preset/template only to explicitly selected organizations.

All mutations must call `requirePlatformAdmin`, validate tenant IDs, write audit logs, and bump configuration/entitlement versions.

## 11. Vercel Fluid CPU Investigation

### 11.1 Strong code-level findings

#### A. The proxy runs for almost every application and API request

Current matcher:

```ts
matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"]
```

This includes public marketing, pricing, product, industry, documentation, legal, authentication, app, platform, and API requests.

The proxy then:

- creates a CSP nonce;
- copies request headers;
- executes `convexAuth.isAuthenticated()`;
- may execute an additional Convex `users.me` query through `ConvexHttpClient`;
- applies security headers.

This makes ordinary public traffic eligible for compute instead of serving as a simple cached/static response.

#### B. Root layout reads `headers()` for every route

`app/layout.tsx` calls:

```ts
const nonce = (await headers()).get("x-nonce") ?? undefined;
```

Reading request headers makes the root route tree request-dependent. Because marketing and authenticated pages share this root, otherwise static public pages cannot receive the full benefit of static generation/caching.

#### C. Per-request CSP nonces conflict with static public pages

The nonce is a security improvement, but putting it in the universal root forces per-request work. Split the marketing and application security/rendering strategies instead of making every page dynamic.

#### D. Image optimizer cache TTL is only 60 seconds

`next.config.ts` sets `images.minimumCacheTTL: 60` for frequently changing marketing images. Repeated image optimization after short cache lifetimes can add compute and transformations, especially with many large PNG variants.

#### E. Mobile update proxy is always dynamic and uncached

`/api/mobile-updates/latest` uses `force-dynamic`, fetch `no-store`, upstream `no-cache`, and response `no-store`. Every client update check invokes Vercel and then Convex. Frequent app polling would multiply this cost.

#### F. Public page animation/lazy-loading behavior should not drive repeated dynamic requests

Keep marketing pages statically renderable and ensure animations do not trigger repeated data fetching or blank server output.

### 11.2 Required remediation

#### Phase 1 — Measure before changing

After Vercel project access is available, collect for the last 7 and 30 days:

- Fluid CPU by route/function;
- invocations by route;
- average and p95 duration;
- middleware/proxy invocations;
- image optimization transformations;
- request paths and status codes;
- bot traffic and update-check frequency;
- production versus preview usage.

Do not claim exact savings until these metrics are captured.

#### Phase 2 — Separate public and authenticated rendering

Preferred solution:

- Move authenticated app/platform routes into a route group with a request-aware layout.
- Keep marketing/docs/legal pages in a static layout that does not call `headers()`.
- Apply CSP nonces only where executable inline scripts genuinely require them.
- For static marketing pages, use a static CSP without a per-request nonce or eliminate inline scripts so hashes/strict external scripts are possible.
- Preserve HSTS, frame restrictions, MIME protections, referrer policy, and permissions policy through static `next.config.ts` headers where appropriate.

#### Phase 3 — Narrow proxy work

- Exclude public content routes from authentication middleware when they do not need session redirects.
- Avoid querying `users.me` in middleware for every privileged navigation.
- Prefer a signed session claim for role/platform-admin/onboarding routing, with Convex remaining authoritative inside queries/mutations.
- If claims cannot yet be trusted, restrict the extra query to routes that truly require the redirect decision.
- Keep backend role checks even after route-level optimization.
- Preserve correct login redirects and Capacitor boot behavior with regression tests.

#### Phase 4 — Cache update metadata

- Replace `force-dynamic + no-store` with a short revalidation window such as 5–15 minutes where release urgency allows.
- Return `s-maxage` plus `stale-while-revalidate` for update metadata.
- Let clients check on app start and at a restrained interval, not every page render.
- Allow an explicit manual “Check for updates” action to bypass stale client state when needed.
- Keep release binaries outside this proxy path.

#### Phase 5 — Optimize marketing images

- Stop adding timestamp/query-string cache busting for unchanged assets.
- Use content-hashed filenames.
- Convert large PNG screenshots to AVIF/WebP while preserving a high-quality source.
- Raise image cache TTL substantially for immutable assets.
- Use only the responsive sizes actually rendered.
- Keep the landing page to five purposeful product screens: checkout, dashboard/analytics, inventory, branches/wholesale, reports.

### 11.3 Verification

Add tests proving:

- public marketing routes remain static/cached;
- authenticated routes still redirect correctly;
- unauthorized roles cannot access protected Convex operations;
- CSP remains effective;
- Capacitor/Electron boot and auth continue working;
- update checks respect the chosen cache/revalidation policy;
- no route generates a nonce unnecessarily;
- direct visits to disabled feature/billing routes are denied correctly.

After deployment compare 7-day normalized metrics:

- CPU milliseconds per 1,000 requests;
- middleware duration per 1,000 requests;
- update-route invocation count;
- image transformations;
- TTFB and error rates.

## 12. Files/Areas Cursor Must Inspect and Update

At minimum:

- `convex/schema.ts`
- `convex/shared/plans.ts`
- `convex/shared/capabilities.ts`
- `convex/shared/licensing.ts`
- `convex/shared/entitlements.ts`
- `convex/shared/provisionOrganization.ts`
- `convex/shared/subscriptions.ts`
- `convex/billing.ts`
- `convex/platform.ts`
- `convex/settings.ts`
- `features/platform/components/platform-org-detail-view.tsx`
- `features/platform/components/platform-license-panel.tsx`
- platform organization creation UI
- tenant sidebar/navigation definitions
- billing/pricing components and routes
- app providers/theme token application
- Dexie schema and licence/config snapshot
- sync/outbox enforcement
- `proxy.ts`
- `app/layout.tsx` and route-group layouts
- `next.config.ts`
- `app/api/mobile-updates/latest/route.ts`
- billing, multi-tenant, offline, routing, and security documentation

Cursor must locate actual filenames before editing and adjust this list to the repository structure.

## 13. Implementation Order

### Phase 0 — Repository mapping and tests

- Map current theme variables, sidebar, navigation, billing UI, plan checks, offline licence cache, organization provisioning, and platform detail UI.
- Write characterization tests around current licensing and legacy Lifetime behavior.

### Phase 1 — Typed registries and schema

- Add feature keys/metadata, presets, templates, policies, offers, and organization fields.
- Add indexes and validators.
- Add backward-compatible defaults.

### Phase 2 — Central resolver

- Implement `resolveOrganizationConfig`.
- Merge plan, template, offer, and organization overrides with documented precedence.
- Add dependency validation and structured denial reasons.

### Phase 3 — Offline snapshot

- Extend licence/config payload and Dexie schema.
- Add version invalidation.
- Enforce capabilities in local mutations and outbox replay.

### Phase 4 — Platform UI

- Experience preset management.
- Default provisioning policies.
- Organization Experience, Entitlements, and Commercial offer tabs.
- Preview, diff, publish, audit, and safe bulk assignment.

### Phase 5 — Tenant UI

- Apply semantic theme variables.
- Generate navigation from effective entitlements.
- Add route/action guards and useful disabled states.
- Implement Billing visibility modes.

### Phase 6 — Billing migration

- Make Lifetime legacy/non-sellable.
- Change default plan fallback to Basic.
- Make Annual default and Monthly alternate.
- Implement private offer checkout and webhook verification.
- Update public pricing and billing documentation.

### Phase 7 — Vercel CPU optimization

- Add timing/route instrumentation first.
- Split static public and dynamic authenticated layouts.
- Narrow proxy matching/work.
- Cache update metadata.
- raise immutable image TTL and optimize assets.

### Phase 8 — Verification and rollout

- Type-check, lint, unit tests, production build, Playwright flows.
- Test two organizations with different presets and feature sets simultaneously.
- Test online/offline entitlement changes and pending outbox operations.
- Deploy behind a platform-only rollout switch to staging.
- Migrate one internal/test organization first.
- Review CPU metrics before wider rollout.
- Open PR to `main` only after staging verification.

## 14. Acceptance Criteria

- Platform admin can create and publish safe experience presets.
- Platform admin can set the preset/template used by organizations created after a specified time.
- Existing organizations do not change unless explicitly targeted.
- Organization admins cannot edit platform-controlled branding or entitlements.
- Different organizations can display different accents/sidebar styles without cross-tenant leakage or flash of the wrong theme.
- Platform admin can enable/disable supported features per organization.
- Disabled features are hidden and rejected by authoritative backend/local write gates.
- Offline clients use the last validated entitlement snapshot and reconcile safely.
- Billing supports Monthly and Annual for new sales, with Annual selected by default.
- Lifetime is absent from new sales but existing Lifetime customers retain access.
- Unknown plan values fall back to Basic, never Lifetime/Enterprise.
- Billing visibility supports visible, hidden, and custom-offer-only.
- An organization assigned a custom offer can see only its own negotiated terms.
- Custom offer prices cannot leak into public catalog or other organizations.
- Every platform change is audited with actor, organization, before/after diff, and time.
- Public pages no longer require request headers/nonces unless necessary.
- Proxy/auth work is reduced without weakening backend authorization.
- Vercel CPU is compared before/after using normalized route metrics.

## 15. Cursor Execution Instruction

Work in small, reviewable phases. Before editing, produce a repository map naming the exact files and current behavior for theme tokens, navigation, plan resolution, billing, offline licence caching, and proxy/layout rendering.

Do not scatter `if (organizationId === ...)`, plan checks, or feature booleans across React components. Build typed registries and one central resolver. Do not remove historical Lifetime support until data and old clients have been migrated. Do not rely on hidden navigation as security. Do not place secrets, gateway codes, internal offer notes, or cross-tenant configuration in client-readable payloads.

After each phase, run `pnpm typecheck`, `pnpm lint`, relevant Vitest suites, and the production build. Add migrations/backfills, update architecture documentation, and report test results and unresolved risks before proceeding to staging.
