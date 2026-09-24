# Novend Marketing Website Redesign — Cursor Implementation Brief

## 1. Objective

Redesign the Novend public website so it feels like a mature, trustworthy commercial product—not a generic template or an AI-generated feature catalogue.

The redesign should borrow **principles**, not source code or distinctive artwork, from polished sites such as Vital-Go, Shopify POS, Square, and Lightspeed:

- confident editorial typography;
- clear visual hierarchy and generous whitespace;
- focused product storytelling;
- authentic product UI shown as evidence;
- fewer, stronger sections instead of many repetitive cards;
- consistent visual language across marketing, download, authentication, documentation, and legal pages.

Do not clone Vital-Go's exact shapes, layout, copy, images, gradients, or animations. Novend must remain recognizably Novend and appropriate for Ghanaian retail businesses.

## 2. Current-State Findings

### What already works

- The product proposition is understandable: offline-first POS, inventory, branches, reporting, and sync.
- The hero has a relevant product image and clear primary/secondary actions.
- Pricing and supported industries are visible.
- Legal, help, documentation, release, and download routes already exist.
- The current light blue/navy direction is suitable for a dependable business product.

### What makes the site feel less mature

1. **The homepage is overloaded.** It tries to explain offline behavior, workflow, features, industries, pricing, FAQ, downloads, and support in one long page. This weakens the narrative.
2. **The sections repeat the same UI pattern.** Similar headings, icon cards, pills, bordered boxes, and feature lists make the experience feel assembled rather than art-directed.
3. **The visual system lacks a strong signature.** Blue accent text, white backgrounds, generic icons, and conventional cards are competent but do not create a memorable Novend identity.
4. **The product is shown too little.** A commercial POS should demonstrate checkout, inventory, offline state, branch transfer, and reporting with crisp, authentic screenshots.
5. **Trust is mostly claimed, not demonstrated.** The site needs customer evidence, operational specifics, support expectations, security summaries, platform availability, and honest product limitations.
6. **The copy is feature-heavy.** It often describes what the system contains rather than the business outcome or the problem being removed.
7. **The footer and homepage contain too many equal-weight links and calls to action.** This adds density without improving decision-making.
8. **The cookie panel visually competes with the hero.** Keep it legally useful but reduce its width, elevation, and initial visual dominance.
9. **The current canonical and social URLs are incorrect.** They use `https://noven-pos.vercel.app` instead of `https://novend-pos.vercel.app`.
10. **Large sections appear dependent on entrance animations.** A full-page capture showed blank areas before activation. Important content must remain present and readable when JavaScript, motion, or intersection observers fail.

## 3. Creative Direction

Use the working concept: **“The operating system for resilient retail.”**

Novend should feel:

- dependable rather than flashy;
- modern African retail technology rather than a Silicon Valley clone;
- operational, fast, and precise;
- premium enough for a multi-branch organization while approachable for a small shop;
- credible during unreliable connectivity.

### Visual language

- Keep navy as the trust anchor and cyan/sky blue as the action accent.
- Add one restrained warm accent, such as amber, only for status, proof points, or small highlights—not for primary buttons.
- Use off-white and pale blue surfaces instead of pure white everywhere.
- Use large fields of color and asymmetric compositions to create rhythm. Do not place every idea in a card.
- Use a small family of softly rounded shapes inspired by receipt paper, inventory labels, connected nodes, or a checkout counter—not Vital-Go's exact circular artwork.
- Prefer subtle borders and tonal separation over heavy shadows.
- Use gradients sparingly and only as background atmosphere.
- Product screenshots should be the strongest visual element.

### Typography

- Use one high-quality sans family consistently, preferably Geist, Inter, or Manrope.
- Display heading: 64–76 px desktop, 40–48 px tablet, 36–42 px mobile; line-height approximately 0.98–1.08.
- Section heading: 42–56 px desktop and 30–36 px mobile.
- Body: 17–19 px desktop and 16–18 px mobile; line-height 1.55–1.7.
- Avoid overusing bold. Create hierarchy through scale, spacing, and color.
- Keep paragraph width near 55–68 characters.

### Layout system

- Content max width: 1200–1280 px.
- Standard page gutter: 24 px mobile, 40 px tablet, 64 px desktop.
- Section spacing: roughly 96–144 px desktop and 64–88 px mobile.
- Border radius scale: 12, 20, and 32 px. Do not use a different radius on every component.
- Use a 12-column desktop grid and deliberate asymmetry in feature storytelling.

## 3A. Exact Visual Blueprint — Implement This Layout

This section is prescriptive. Cursor should follow these component, surface, gradient, spacing, and layout decisions unless the existing codebase creates a genuine technical conflict.

### Global page canvas

- Main background: `#F8FAFC`.
- Alternate section background: `#EFF8FF`.
- Dark section background: `#071426` with subtle lighter navy areas.
- Primary text: `#0B1220`.
- Secondary text: `#526174`.
- Primary accent: `#38BDF8`.
- Strong blue accent: `#0284C7`.
- Border: `rgba(11, 18, 32, 0.10)`.
- Use a faint page-level glow only behind the hero: a radial gradient from `rgba(56,189,248,.18)` to transparent. Do not apply a gradient to every section.
- Cards must use one of only two styles:
  1. **Light card:** white or `rgba(255,255,255,.86)`, 1 px border, 20 px radius, very soft shadow.
  2. **Dark card:** `#0D1C31`, 1 px white/10% border, 20 px radius, no strong shadow.
- Do not use glassmorphism outside the navigation and one small floating hero status card.

### 1. Header — floating pill navigation

Desktop composition:

- Place the header inside a `max-width: 1240px` container, 20 px from the top.
- Height: 64 px.
- White/88% background with backdrop blur, 1 px border, 18 px radius, soft shadow.
- Left: horizontal Novend logo, approximately 120–132 px wide.
- Center: Product, Industries, Pricing, Resources, Download.
- Right: Sign in as a text button and Start free as a candy-blue filled button.
- Use 14–15 px medium-weight navigation text.
- Dropdowns use 320–380 px white cards with grouped links, short descriptions, 16 px radius, and no decorative icons unless they aid scanning.
- Sticky state: move to 10 px from the top, reduce height to 58 px, increase background opacity, and keep the same radius.

Mobile composition:

- Use a normal full-width 64 px header, not a squeezed desktop pill.
- Logo left; menu icon right; no second CTA in the header.
- Menu opens as a full-width sheet below the header with grouped accordion links and a full-width Start free button at the bottom.

### 2. Hero — asymmetric split panel

Surface and size:

- Place the hero 16 px below the header.
- Desktop min-height: 720–760 px.
- Use a large rounded container with 32 px radius and `overflow: hidden`.
- Background: `linear-gradient(135deg, #F4FBFF 0%, #EAF7FF 48%, #F8FAFC 100%)`.
- Add one subtle cyan radial glow behind the product image and a faint dot/grid pattern at less than 5% opacity.
- Do not use floating bubbles, random particles, or Vital-Go's overlapping blue circles.

Desktop layout:

- Two columns: text 46%, product visual 54%.
- Left content vertically centered with 56–72 px left padding.
- Right visual reaches close to the right and bottom edges to avoid an empty white half.
- Eyebrow: small cyan status pill containing `Offline-first POS for modern retail`.
- Heading: maximum three lines, 68–76 px, heavy but not extra-black.
- Highlight only the words `internet stops` with blue text; do not use multicolor gradient text.
- Paragraph below: max-width 580 px, 18 px.
- CTA row: filled primary button and bordered secondary button.
- Proof list below CTAs: a horizontal list with three check icons—No card required, Works offline after setup, Desktop and mobile.

Product visual:

- Use an authentic dashboard or checkout screenshot inside a clean desktop app frame.
- Frame background: white, 18–22 px radius, 1 px navy/10% border, soft shadow `0 30px 80px rgba(11,18,32,.16)`.
- Rotate no more than 1 degree; ideally keep it straight.
- Add one phone/PWA view in front at the lower-right, approximately 28–32% of the desktop frame height.
- Add exactly one floating status card near the lower-left of the visual: green dot, `Offline mode`, and `7 changes ready to sync`.
- Do not add more than two floating cards.

Mobile hero:

- Stack copy first and visual second.
- Use 24 px outer padding and 28 px inner padding.
- Heading 40–44 px.
- CTA buttons become full-width stacked buttons.
- Proof items wrap into two rows.
- Show the desktop screenshot edge-to-edge within the hero and the phone at approximately 34% width.

### 3. Proof strip — plain list, not cards

- Place directly after the hero with 48–64 px vertical padding.
- Use a single horizontal row separated by thin vertical dividers.
- Content: Works offline, Multi-branch inventory, Cross-platform, Encrypted backup traffic.
- Each item contains a 20 px line icon, a short bold label, and no paragraph.
- Do not wrap each item in an individual card.
- On mobile, render as a 2 × 2 grid with thin row/column separators.

### 4. Product outcomes — three alternating feature bands

General pattern:

- Use three large feature bands with 112–136 px vertical spacing.
- Do not place all features in a uniform card grid.
- Each band uses a 5/7 or 7/5 column split and alternates image/text positions.
- Text area contains an eyebrow, heading, one paragraph, a three-item check list, and one inline link.
- Screenshot area uses a 24 px rounded frame with a subtle border.

Band 1 — Sell without interruption:

- Background: off-white page canvas.
- Text left, screenshot right.
- Screenshot: checkout/sales screen.
- Add a small cyan-bordered inline badge within the screenshot frame: `Offline • Sale saved locally`.
- Supporting list: barcode-ready checkout, hold/resume sale, receipt options.

Band 2 — Inventory across every location:

- Place inside a pale-blue full-width section.
- Screenshot left, text right.
- Use a screenshot of branch/warehouse inventory.
- Behind the screenshot, add one large low-opacity rounded rectangle—not multiple decorative blobs.
- Supporting list: branch stock, warehouse transfers, low-stock visibility.

Band 3 — Reports that explain the business:

- Background: off-white.
- Text left, screenshot right.
- Combine one main analytics screenshot with a narrow stacked mini-list of three report formats: PDF, Excel, CSV.
- The format items may be compact cards, but keep them inside the visual composition rather than creating a separate page section.

### 5. Offline-first section — dark technical story panel

- Use a full-width dark navy section with 32 px top-level radius on desktop and no radius on mobile.
- Padding: 112 px desktop, 72 px mobile.
- Header centered: cyan eyebrow, white heading, muted-blue paragraph.
- Below, use a horizontal four-step connected flow on desktop:
  1. Sell on device
  2. Save locally
  3. Reconnect
  4. Sync safely
- Each step is a dark card, but the cards are visually connected by one thin cyan progress line.
- Cards: 20 px radius, 24 px padding, small step number, line icon, title, maximum two-line description.
- Highlight step 2 with a slightly lighter surface to emphasize local-first behavior.
- Beneath the steps, show a compact terminal/status strip: green dot, `Counter operational`, sync queue count, last connected time.
- On mobile, turn the flow into a vertical timeline with the connecting line on the left.

### 6. Platform capabilities — bento grid

Use a bento grid here because the capabilities differ in weight. This should be the only major bento/card-heavy section.

Desktop grid:

- 12 columns, two rows, 20 px gaps.
- POS card: span 7 columns × 2 rows; include large screenshot and brief copy.
- Inventory card: span 5 columns × 1 row; include a small stock chart or list fragment.
- Branches card: span 5 columns × 1 row; include a simple location/transfer visual.
- Reports card: span 4 columns × 1 row.
- Hardware card: span 4 columns × 1 row.
- Cross-platform card: span 4 columns × 1 row with Windows, Android, browser, Apple platform labels.

Card rules:

- White surfaces, 20–24 px radius, subtle border, no strong colored shadow.
- Use screenshots/UI fragments in the large cards and line illustrations/icons in the small cards.
- Vary surface tint slightly between white, pale blue, and very pale slate.
- No card should contain more than one paragraph and three short points.
- On tablet use two columns; on mobile use one column with POS first.

### 7. Industry section — dark text panel plus interactive preview

- Use a two-column section on a pale-blue background.
- Left 38%: heading, description, and vertical industry tab list.
- Right 62%: one large white preview card that changes by selected industry.
- Industry list items: Pharmacy, Supermarket, Wholesale, Fashion, Electronics.
- Active industry item uses a navy filled pill with white text; inactive items use transparent background and a bottom border.
- The preview card includes industry title, one short scenario, three check points, and one product screenshot or cropped UI panel.
- Do not use five separate industry cards simultaneously.
- On mobile, the industry list becomes a horizontally scrollable segmented control above the preview.

### 8. Customer evidence — editorial quote, not testimonial cards

- Only render when verified customer material exists.
- Use a single wide dark-navy card, 28–32 px radius.
- Left: real store/customer photograph taking about 40% width.
- Right: large quote, customer name/role/business, and one verified result.
- Use oversized opening quotation mark at low opacity.
- Do not create a carousel, star-rating row, or three fake testimonials.
- Until verified evidence exists, replace this section with a white `Built with local retailers` research panel containing three concise research commitments.

### 9. Pricing preview — three cards plus separate lifetime banner

- Background: off-white.
- Centered section header and monthly/yearly segmented toggle.
- Use three equal-height pricing cards for Basic, Pro, Enterprise.
- Basic and Enterprise: white card, 1 px border, 24 px radius.
- Pro: navy card with white text and a small candy-blue `Most popular` label. Do not use a glowing border.
- Each card: plan name, audience line, price, CTA, then a plain five-item list.
- Keep plan comparison off the homepage; link to the full pricing page.
- Place Lifetime below as a full-width pale-blue horizontal banner, not a fourth matching card.
- Lifetime banner layout: title/copy left, price and CTA right.
- On mobile, stack Pro first, then Basic, Enterprise, Lifetime.

### 10. FAQ — clean accordion list

- Use a centered 820 px column.
- No outer card around the entire FAQ.
- Each question is a full-width row with top/bottom borders, 20–24 px vertical padding, and plus/minus icon.
- Open answer appears directly below with no nested colored box.
- Show six to eight high-value questions only; link to Help Center for the rest.

### 11. Final CTA — dark conversion panel

- Use a large dark navy rounded panel within the page container.
- Add a restrained cyan radial glow in the top-right.
- Left: heading and one sentence.
- Right: primary white button with navy text and secondary transparent button with white border.
- Include a small platform line below: `Windows • macOS • Linux • Android • iPhone/iPad PWA`.
- Avoid device mockups here; the hero and product bands already contain enough product imagery.

### 12. Footer — structured dark footer

- Full-width `#071426` background.
- Top row: logo and two-line description left; four link columns right.
- Use muted text, clear column labels, and 16–20 px row spacing.
- Bottom row: copyright, Ghana location, cookie settings, and social links if active.
- Add a thin top border; no decorative giant wordmark.

### Exact supporting-page pattern

All non-home marketing pages should use this predictable structure:

1. Compact floating header.
2. Page hero with pale-blue gradient, eyebrow, 48–60 px heading, short paragraph, and optional CTA.
3. Breadcrumb above the heading on docs/legal pages only.
4. Main content using alternating editorial bands or a readable document column.
5. One dark final CTA, except legal pages.
6. Shared dark footer.

Specific designs:

- **Pricing:** hero → three pricing cards → lifetime banner → feature-comparison table → billing/support notes → FAQ → CTA.
- **Download:** hero → detected-platform featured card → three platform cards → installation steps in a numbered list → release/security information → FAQ.
- **Product detail:** hero with screenshot → problem/outcome band → three capability bands → offline behavior callout → related features → CTA.
- **Industry detail:** hero with real industry photo and product overlay → daily workflow timeline → relevant features → setup/hardware guidance → customer proof → CTA.
- **Sign in/up:** split screen on desktop; left 42% navy brand/product panel, right 58% white form area. On mobile remove the marketing panel and show only compact logo + form.
- **Docs/help:** no gradients in the reading area; fixed left navigation, 720–780 px article column, optional right table of contents.
- **Legal:** 760–820 px reading column, white background, sticky table of contents on desktop, no cards except one contact callout.

### Responsive behavior table

| Breakpoint   | Required behavior                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| `< 640px`    | Single-column sections, 24 px gutters, stacked CTAs, no floating nav pill, no decorative image overflow |
| `640–899px`  | Two-column capability cards, compact hero visual, industry tabs above preview                           |
| `900–1199px` | Desktop-like layout with reduced heading size and 40 px gutters                                         |
| `1200px+`    | Full 12-column layout, 64 px gutters, maximum 1240–1280 px content width                                |

### Component usage rule

- Use **lists** for proof points, plan benefits, workflow steps, platform requirements, and FAQ questions.
- Use **cards** only for pricing, platform/download choices, the offline steps, and the capability bento grid.
- Use **gradients** only in the hero, one final CTA glow, and subtle screenshot backdrops.
- Use **full-width colored bands** for offline-first and the second product story section.
- Use **tabs** only for industries and monthly/yearly pricing.
- Use **tables** only for detailed plan comparison and release/platform requirements.
- Use **screenshots** in the hero and three outcome bands; do not repeat the same screenshot.
- Use **icons** as supporting navigation/scanning aids, never as the main visual content.

## 4. Proposed Information Architecture

### Primary navigation

- Product
  - Point of Sale
  - Inventory
  - Branches & Transfers
  - Reports
  - Offline & Sync
- Industries
  - Pharmacy
  - Supermarket
  - Wholesale
  - Fashion & Specialty Retail
- Pricing
- Resources
  - Help Center
  - Documentation
  - Release Notes
  - Security
- Download

Right-side actions:

- Sign in — quiet text action
- Start free trial — primary action

On mobile, use a full-screen or large-sheet menu with clear grouped links. Keep the primary CTA visible but do not show a crowded desktop navigation.

### Recommended public routes

- `/` — focused overview and conversion page
- `/product` — complete platform overview
- `/product/pos`
- `/product/inventory`
- `/product/offline-sync`
- `/industries/[industry]`
- `/pricing`
- `/security`
- `/customers` or `/stories` when genuine customer evidence is available
- `/download`
- existing `/docs`, `/docs/help`, `/docs/releases`
- existing legal pages

Do not create empty or thin pages solely to increase page count. Launch a route only when it has useful, unique content.

## 5. Homepage Structure

### A. Navigation

Use a calm, compact header. It may float over the hero or sit inside the hero surface, but it must remain legible and usable. A sticky state should become slightly smaller and gain a subtle border/background blur after scrolling.

### B. Hero

Replace the generic “Run Your Business. Anywhere.” presentation with a more specific operational promise.

Suggested copy direction:

> **Keep selling—even when the internet stops.**  
> Novend brings checkout, inventory, branch transfers, and reporting into one dependable system built for everyday retail.

Primary CTA: **Start free for 14 days**  
Secondary CTA: **Watch product tour** or **Explore the product**

Hero proof row:

- No card required
- Works offline after setup
- Windows, Android, web, and iPhone/iPad PWA

Hero visual:

- Use a large authentic Novend checkout or dashboard screenshot.
- Present it in a layered desktop/tablet composition with a small offline-status detail.
- Avoid a generic monitor mockup with unreadable UI.
- Do not use the uploaded “Princellen Water and Wine” logo as Novend branding.
- The uploaded composite can only be used after confirming it reflects a real deployed Novend instance and obtaining permission from that customer.

### C. Trust strip

Use one of these only when the evidence exists:

- real customer logos with consent;
- “Built for pharmacies, supermarkets, wholesalers, and multi-branch retailers” with restrained industry labels;
- an honest metric such as number of active stores, transactions processed, or uptime period.

Never invent logos, testimonials, ratings, user counts, transaction counts, or uptime statistics.

### D. Outcome-led product story

Use three large alternating editorial sections, not a grid of six equal cards:

1. **Sell without interruption** — checkout, barcode, receipts, hold/resume, and offline status.
2. **Know what is in every location** — inventory, warehouse, branches, transfers, and low-stock visibility.
3. **Make decisions with evidence** — revenue, margin, stock valuation, exports, and reports.

Each section needs:

- a short eyebrow;
- a concise outcome-driven heading;
- one paragraph;
- no more than three supporting bullets;
- a large authentic screenshot;
- one contextual link.

### E. Offline-first explainer

Make offline capability Novend's signature differentiator. Replace the current four similar step cards with a compact visual sequence:

1. Sale writes to the device.
2. Counter keeps operating.
3. Pending changes sync on reconnection.
4. Connected views refresh.

Include an explicit qualification: core selling and local operations continue offline **after initial setup**. Do not imply that every cloud/admin function is permanently available without connectivity.

### F. Industry selector

Use tabs or a segmented control with one shared product visual area. Selecting Pharmacy, Supermarket, Wholesale, or Fashion updates the use case, screenshot, and three relevant capabilities. This creates interaction without multiplying cards.

Accessibility requirements:

- real tab semantics;
- keyboard navigation;
- visible focus;
- content remains available without animation.

### G. Customer proof

Add this section only with verified material. Ideal content:

- customer name and business type;
- actual quote;
- portrait or store photo with permission;
- one verifiable outcome;
- link to a case study.

If proof is not available, use a transparent “Built with local retailers” product-research section rather than fake testimonials.

### H. Pricing preview

Do not place every plan detail on the homepage. Show three concise plan summaries with “Compare all features” linking to `/pricing`. Put the lifetime license in a separate callout because its purchasing model differs from subscriptions.

Avoid duplicated benefit lists. Explain VAT/tax treatment, currency, trial conversion, support scope, update entitlement, backup limits, cancellation, and refund eligibility on the full pricing page.

### I. Final CTA

Use one decision:

> **Ready for a calmer counter?**  
> Set up your catalogue, make a test sale, and see how Novend handles a working day.

Primary: Start free  
Secondary: Talk to sales

### J. Footer

Keep four concise columns: Product, Industries, Resources, Legal. Add contact and company information without turning every item into a decorated card. Use a dark navy footer with restrained branding, not an oversized novelty wordmark.

## 6. Other Page Requirements

### Product pages

- Use a consistent product-page template.
- Lead with one operational outcome, one authentic screenshot, and a short CTA.
- Follow with workflow, capabilities, relevant offline behavior, hardware/platform notes, FAQ, and final CTA.
- Clearly distinguish available features from roadmap features.

### Industry pages

- Do not merely replace the industry name inside the same template.
- Describe the industry's daily workflow, common failure points, relevant Novend modules, setup expectations, and a tailored demo.
- Pharmacy content must avoid implying clinical, prescribing, or regulatory functionality Novend does not provide.

### Pricing page

- Put the monthly/yearly toggle next to a plain-language savings statement.
- Use a comparison table below the plan cards.
- Make plan limits scannable and group them by catalogue, team, locations/devices, backup/storage, reports, and support.
- Explain what happens when a limit is reached.
- Use “Recommended” only if there is a real business reason, not as visual pressure.
- Make enterprise and lifetime purchasing flows distinct.

### Download page

- Detect the platform but always let the user choose another platform.
- Show version, release date, file size, supported OS versions, architecture, checksum/signature where available, and release notes.
- Explain Windows/macOS security prompts honestly.
- Separate desktop installers, Android, and iPhone/iPad PWA instructions.
- Never present an unsigned build as though it is signed.

### Sign-in and sign-up

- Use the same public brand system but reduce marketing noise.
- Keep the form in a focused 420–480 px column.
- Provide clear validation, password requirements, loading states, show/hide password, and recovery paths.
- Do not use decorative product claims that compete with the task.
- Make privacy/terms consent readable and specific.

### Documentation and help

- Use a dedicated docs shell: left navigation, content column, optional right table of contents, search, breadcrumbs, previous/next links.
- Keep prose widths readable and code/config blocks horizontally scrollable.
- Add “Was this helpful?” only if feedback is stored and reviewed.

### Legal pages

- Keep them visually related to the brand but prioritize readability over marketing style.
- Add last-updated date, table of contents, stable heading anchors, print styles, and contact route.
- Do not animate legal content.

### Security page

Create a plain-language trust page that accurately describes:

- data in transit and backup protection;
- device-local data behavior;
- account and role controls;
- incident reporting contact;
- backup and recovery scope;
- subprocessors and hosting regions where applicable;
- vulnerability reporting;
- what Novend does **not** promise.

Every claim must match the implementation and legal documents.

## 7. Component and Design-System Work

Create or rationalize reusable components rather than styling each page independently:

- `MarketingHeader`
- `MobileNavigation`
- `HeroShell`
- `ProductScreenshotFrame`
- `ProofStrip`
- `EditorialFeature`
- `OfflineFlow`
- `IndustryTabs`
- `TestimonialOrResearchProof`
- `PricingPreview`
- `PlatformDownloadCard`
- `FAQAccordion`
- `MarketingCTA`
- `MarketingFooter`
- `LegalDocumentLayout`
- `DocsLayout`

Create a small token layer for:

- color roles;
- type scale;
- spacing;
- radii;
- borders and shadows;
- max widths;
- motion duration/easing;
- focus ring.

Avoid:

- excessive gradients;
- glassmorphism on every component;
- icons inside colored circles everywhere;
- endless 3-column feature grids;
- random floating particles;
- typewriter text;
- scroll hijacking;
- parallax that harms performance;
- stock photos of unrelated foreign shops;
- AI-generated fake dashboards or customer claims.

## 8. Motion

Motion should clarify structure, not manufacture polish.

- Use 160–260 ms for controls and 400–650 ms for section entrance transitions.
- Animate opacity and small transforms only.
- Do not hide core content until an intersection observer fires.
- Respect `prefers-reduced-motion`.
- Disable nonessential motion on low-power/mobile contexts where appropriate.
- The page must remain complete and understandable with animations disabled.

## 9. Accessibility

Meet WCAG 2.2 AA for the public site.

- semantic landmarks and heading order;
- skip link;
- keyboard-operable navigation, tabs, dialogs, and accordions;
- visible focus indicators;
- 44 × 44 px minimum touch targets where practical;
- sufficient contrast, including cyan text on pale backgrounds;
- useful alternative text for screenshots and product imagery;
- decorative imagery hidden from assistive technology;
- form labels, instructions, error summaries, and field-level errors;
- no information conveyed through color alone;
- no auto-rotating carousels;
- zoom/reflow at 200% and 400% without loss of function.

## 10. Performance and Technical Quality

Targets for representative mobile pages:

- LCP below 2.5 seconds at the 75th percentile;
- CLS below 0.1;
- INP below 200 ms;
- Lighthouse performance 90+ as a development guardrail, not a substitute for field data;
- accessibility 95+;
- no console errors or hydration warnings.

Implementation requirements:

- render meaningful content on the server;
- use responsive images with correct `sizes`;
- preload only the actual hero asset and critical font subset;
- lazy-load below-fold media;
- reserve media dimensions to prevent layout shift;
- use CSS for simple decoration rather than large raster assets;
- keep third-party scripts minimal and consent-aware;
- ensure the cookie banner does not block the main CTA on small screens;
- test with JavaScript disabled or interrupted to confirm that core public content remains readable.

## 11. SEO and Metadata Fixes

- Correct all `noven-pos.vercel.app` canonical, Open Graph, Twitter, schema, sitemap, and absolute asset URLs to the actual canonical production domain.
- Choose one permanent production domain before final launch and redirect all alternatives to it.
- Use unique titles and descriptions per route.
- Generate valid Organization, SoftwareApplication, FAQ, and Breadcrumb schema only where the visible content supports it.
- Add an XML sitemap and confirm robots rules.
- Use a branded, legible Open Graph image—not the login hero by default for every page.
- Give product and industry pages stable, descriptive URLs.

## 12. Copy Rules

- Use sentence case, not title case everywhere.
- Prefer concrete language: “Keep checkout running during an outage” over “Always reliable.”
- Avoid unsupported superlatives such as “best,” “perfect,” “100%,” or “bank-grade.”
- Do not describe dashboards as “real-time” where data may be local, pending sync, or refreshed later.
- State “after setup” when describing offline behavior.
- Keep each section focused on one promise.
- Keep bullet lists to three or four items unless the user explicitly asks for a full specification.
- Verify all prices, plan limits, supported platforms, backup limits, and feature claims against the product configuration before publishing.

## 13. Recommended Implementation Sequence

### Phase 1 — Audit and foundations

1. Locate all marketing, auth, download, docs, and legal routes and components.
2. Inventory existing assets and flag mockups, placeholders, and unverifiable claims.
3. Fix canonical/metadata domain errors.
4. Establish tokens, typography, container, button, link, focus, and section primitives.

### Phase 2 — Shared shell

1. Build the new header and mobile navigation.
2. Build the marketing footer.
3. Implement responsive behavior and reduced-motion handling.
4. Apply the shell to all public pages without changing authenticated application UI.

### Phase 3 — Homepage

1. Implement the focused hero and authentic product visual.
2. Add proof, outcome-led feature sections, and offline explainer.
3. Add industry interaction, restrained pricing preview, FAQ, and final CTA.
4. Remove redundant sections and duplicate claims.

### Phase 4 — Supporting pages

1. Refactor pricing and download pages.
2. Create product/industry pages only where sufficient content exists.
3. Update sign-in/sign-up visual shell.
4. Standardize docs/help and legal layouts.
5. Add the factual security/trust page.

### Phase 5 — Verification

1. Run type-check, lint, unit tests, and production build.
2. Add Playwright coverage for navigation, CTAs, pricing toggle, industry tabs, FAQ, cookie choices, downloads, sign-in/sign-up links, and legal routes.
3. Test at 360, 390, 768, 1024, 1280, and 1440 px widths.
4. Test keyboard-only use and at least one screen reader flow.
5. Run Lighthouse and inspect real screenshots, not only numeric scores.
6. Verify all copy claims against current product behavior and plan configuration.

## 14. Acceptance Criteria

The redesign is complete only when:

- the homepage has one clear narrative and no redundant feature sections;
- the hero communicates offline resilience and shows a real Novend product screen;
- public pages share one coherent design system;
- mobile navigation, tabs, accordions, cookie controls, and forms work by keyboard and touch;
- primary content is visible when motion is disabled or observers fail;
- the incorrect `noven-pos.vercel.app` metadata is gone;
- all internal links and public routes return the intended page;
- screenshots and testimonials are authentic and approved;
- claims about offline use, security, sync, platforms, pricing, and plan limits are accurate;
- Core Web Vitals and accessibility targets are met or documented with specific follow-up issues;
- the implementation does not alter authenticated POS workflows unless separately requested;
- the branch is deployed to staging and reviewed at desktop and mobile sizes before a PR is opened to `main`.

## 15. Instruction to Cursor

Start by reading the repository structure and current marketing components. Produce a short implementation plan that names the exact files to change. Then implement the redesign in small, reviewable commits.

Do not blindly rewrite the application, change business logic, alter the authenticated POS interface, invent assets, or publish unsupported claims. Reuse strong existing components when they meet the new design system. Where an authentic screenshot, customer quote, statistic, compliance statement, or product decision is missing, add a clearly named placeholder/TODO and continue with the rest of the implementation.

After implementation, run all available checks, add missing public-site tests, deploy the completed work to the staging branch/environment, and provide a summary of changed files, test results, remaining content dependencies, and any risks before opening a PR to `main`.
