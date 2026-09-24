## Error Type
Console Error

## Error Message
A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:

- A server/client branch `if (typeof window !== 'undefined')`.
- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

https://react.dev/link/hydration-mismatch

  ...
    <InnerScrollHandlerNew focusAndScrollRef={{scrollRef:null, ...}} cacheNode={{rsc:{...}, ...}}>
      <ErrorBoundary errorComponent={undefined} errorStyles={undefined} errorScripts={undefined}>
        <LoadingBoundary name="/" loading={null}>
          <HTTPAccessFallbackBoundary notFound={<SegmentViewNode>} forbidden={undefined} unauthorized={undefined}>
            <HTTPAccessFallbackErrorBoundary pathname="/" notFound={<SegmentViewNode>} forbidden={undefined} ...>
              <RedirectBoundary>
                <RedirectErrorBoundary router={{...}}>
                  <InnerLayoutRouter url="/" tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} segmentPath={[...]} ...>
                    <SegmentViewNode type="page" pagePath="page.tsx">
                      <SegmentTrieNode>
                      <HomePage>
                        <script>
                        <LandingPage>
                          <div ref={{current:null}} className="marketing-...">
                            <a
                              href="#product"
                              className="bg-primary text-primary-foreground focus:ring-ring sr-only focus:not-sr-only ..."
-                             data-cursor-ref="e0"
                            >
+                             Skip to product story
                            <div ref={{current:null}}>
                              ...
                                <div className="pointer-ev...">
                                  <LinkComponent href="/" className="flex shrin...">
                                    <a
                                      className="flex shrink-0 items-center gap-2.5"
                                      ref={function}
                                      onClick={function onClick}
                                      onMouseEnter={function onMouseEnter}
                                      onTouchStart={function onTouchStart}
                                      href="/"
-                                     data-cursor-ref="e1"
                                    >
                                  <nav>
                                  <div className="flex shrin...">
                                    <_c asChild={true} variant="ghost" size="sm" className="hidden h-9...">
                                      <Slot.Slot className={"items-ce..."} ref={null}>
                                        <LinkComponent href="https://da..." className={"items-ce..."} ref={null}>
                                          <a
                                            className={"items-center justify-center gap-2 whitespace-nowrap transitio..."}
                                            ref={function}
                                            onClick={function onClick}
                                            onMouseEnter={function onMouseEnter}
                                            onTouchStart={function onTouchStart}
                                            href="https://dashboard.novendpos.app/login"
-                                           data-cursor-ref="e2"
                                          >
+                                           Sign in
                                    <_c asChild={true} size="sm" className="hidden h-9...">
                                      <Slot.Slot className={"items-ce..."} ref={null}>
                                        <LinkComponent href="https://da..." className={"items-ce..."} ref={null}>
                                          <a
                                            className={"items-center justify-center gap-2 whitespace-nowrap transitio..."}
                                            ref={function}
                                            onClick={function onClick}
                                            onMouseEnter={function onMouseEnter}
                                            onTouchStart={function onTouchStart}
                                            href="https://dashboard.novendpos.app/signup"
-                                           data-cursor-ref="e3"
                                          >
+                                           Start free
                                    ...
                                      <Primitive.button type="button" aria-haspopup="dialog" aria-expanded={false} ...>
                                        <Primitive.button.Slot type="button" aria-haspopup="dialog" aria-expanded={false} ...>
                                          <_c type="button" variant="outline" size="icon" className="h-10 w-10 ..." ...>
                                            <button
                                              className={"inline-flex items-center justify-center gap-2 whitespace-no..."}
                                              ref={function}
                                              type="button"
                                              aria-label="Open menu"
                                              aria-haspopup="dialog"
                                              aria-expanded={false}
                                              aria-controls={undefined}
                                              data-state="closed"
                                              onClick={function handleEvent}
-                                             data-cursor-ref="e4"
                                            >
                              <main>
                                ...
                                  <div className="landing-ed...">
                                    <div>
                                    <div>
                                    <div className="relative z...">
                                      <div data-hero-copy={true} className="max-w-[580px]">
                                        <p
                                          className="border-primary/25 bg-primary/10 text-primary inline-flex rounded-..."
-                                         data-cursor-ref="e62"
                                        >
+                                         Offline-first POS for modern retail
                                        <h1
                                          className="mt-5 text-[2.5rem] leading-[1.04] font-semibold tracking-tight te..."
-                                         data-cursor-ref="e63"
                                        >
                                        <p
                                          className="mt-5 max-w-[580px] text-base leading-relaxed text-pretty text-[#5..."
-                                         data-cursor-ref="e64"
                                        >
+                                         Novend brings checkout, inventory, branch transfers, and reporting into one d...
                                        <div className="mt-8 flex ...">
                                          <_c asChild={true} size="lg" className="h-12 w-ful...">
                                            <Slot.Slot className={"inline-f..."} ref={null}>
                                              <LinkComponent href="https://da..." className={"inline-f..."} ref={null}>
                                                <a
                                                  className={"inline-flex items-center justify-center gap-2 whitespac..."}
                                                  ref={function}
                                                  onClick={function onClick}
                                                  onMouseEnter={function onMouseEnter}
                                                  onTouchStart={function onTouchStart}
                                                  href="https://dashboard.novendpos.app/signup"
-                                                 data-cursor-ref="e5"
                                                >
+                                                 Start free for 14 days
                                          <_c asChild={true} size="lg" variant="outline" className="h-12 w-ful...">
                                            <Slot.Slot className={"inline-f..."} ref={null}>
                                              <LinkComponent href="/product" className={"inline-f..."} ref={null}>
                                                <a
                                                  className={"inline-flex items-center justify-center gap-2 whitespac..."}
                                                  ref={function}
                                                  onClick={function onClick}
                                                  onMouseEnter={function onMouseEnter}
                                                  onTouchStart={function onTouchStart}
                                                  href="/product"
-                                                 data-cursor-ref="e6"
                                                >
+                                                 Explore the product
                                        <ul className="mt-8 flex ...">
                                          <li
                                            className="inline-flex items-center gap-2 text-sm font-medium text-[#0B1220]"
-                                           data-cursor-ref="e65"
                                          >
                                          <li
                                            className="inline-flex items-center gap-2 text-sm font-medium text-[#0B1220]"
-                                           data-cursor-ref="e66"
                                          >
                                          <li
                                            className="inline-flex items-center gap-2 text-sm font-medium text-[#0B1220]"
-                                           data-cursor-ref="e67"
                                          >
                                      ...
                                        <div className="absolute b...">
                                          <div className="inline-fle...">
                                            <span>
                                            <div className="min-w-0 te...">
                                              <p
                                                className="text-[12px] font-semibold tracking-tight text-[#0B1220]"
-                                               data-cursor-ref="e68"
                                              >
+                                               Offline mode
                                              <p
                                                className="text-[11px] text-[#526174]"
-                                               data-cursor-ref="e69"
                                              >
+                                               Changes ready to sync after setup
                                <LandingProofStrip>
                                  <section
                                    aria-label="Platform strengths"
                                    className="bg-white"
-                                   data-cursor-ref="e70"
                                  >
                                    <div className="mx-auto ma...">
                                      <ul className="grid grid-...">
                                        <li
                                          className="flex items-center gap-3 px-4 py-5 sm:px-6 sm:py-6   lg:border-l-0"
-                                         data-cursor-ref="e71"
                                        >
                                        <li
                                          className="flex items-center gap-3 px-4 py-5 sm:px-6 sm:py-6 border-l border..."
-                                         data-cursor-ref="e72"
                                        >
                                        <li
                                          className="flex items-center gap-3 px-4 py-5 sm:px-6 sm:py-6  border-t borde..."
-                                         data-cursor-ref="e73"
                                        >
                                        <li
                                          className="flex items-center gap-3 px-4 py-5 sm:px-6 sm:py-6 border-l border..."
-                                         data-cursor-ref="e74"
                                        >
                                <LandingEditorialFeatures>
                                  <div id="product">
                                    <LandingSection id="product-pos" tone="pearl" className="px-4 py-16...">
                                      <section id="product-pos" aria-labelledby={undefined} className="relative s...">
                                        <div className="mx-auto gr...">
                                          <div className="lg:order-1">
                                            <p
                                              className="text-primary text-[13px] font-semibold tracking-[0.14em] uppe..."
-                                             data-cursor-ref="e75"
                                            >
+                                             Point of sale
                                            <h2
                                              className="mt-3 max-w-lg text-3xl font-semibold tracking-tight text-bala..."
-                                             data-cursor-ref="e76"
                                            >
+                                             Sell without interruption
                                            <p
                                              className="mt-4 max-w-[38rem] text-base leading-relaxed text-pretty text..."
-                                             data-cursor-ref="e77"
                                            >
+                                             Keep the counter moving with barcode scanning, hold and resume, receipts,...
                                            <ul className="mt-6 space...">
                                              <li
                                                className="flex gap-2.5 text-sm leading-relaxed text-slate-700 sm:text..."
-                                               data-cursor-ref="e78"
                                              >
                                              <li
                                                className="flex gap-2.5 text-sm leading-relaxed text-slate-700 sm:text..."
-                                               data-cursor-ref="e79"
                                              >
                                              <li
                                                className="flex gap-2.5 text-sm leading-relaxed text-slate-700 sm:text..."
-                                               data-cursor-ref="e80"
                                              >
                                            <LinkComponent href="/product/pos" className="text-prima...">
                                              <a
                                                className="text-primary mt-7 inline-flex items-center gap-1.5 text-sm ..."
                                                ref={function}
                                                onClick={function onClick}
                                                onMouseEnter={function onMouseEnter}
                                                onTouchStart={function onTouchStart}
                                                href="/product/pos"
-                                               data-cursor-ref="e7"
                                              >
                                          <div className="lg:order-2">
                                            <ExpandableScreenshot src="/marketing..." alt="Novend che..." ...>
                                              <button
                                                type="button"
                                                onClick={function onClick}
                                                className="landing-expandable-shot group/shot relative block w-full cu..."
                                                aria-label="View larger: Novend checkout with cart, barcode-ready cata..."
-                                               data-cursor-ref="e8"
                                              >
                                              ...
                                    <LandingSection id="product-in..." tone="soft" className="px-4 py-16...">
                                      <section id="product-in..." aria-labelledby={undefined} className="relative s...">
                                        <div className="mx-auto gr...">
                                          <div className="lg:order-2">
                                            <p
                                              className="text-primary text-[13px] font-semibold tracking-[0.14em] uppe..."
-                                             data-cursor-ref="e81"
                                            >
+                                             {"Inventory & branches"}
                                            <h2
                                              className="mt-3 max-w-lg text-3xl font-semibold tracking-tight text-bala..."
-                                             data-cursor-ref="e82"
                                            >
+                                             Know what is in every location
                                            <p
                                              className="mt-4 max-w-[38rem] text-base leading-relaxed text-pretty text..."
-                                             data-cursor-ref="e83"
                                            >
+                                             Track warehouse and branch stock in one system. Transfer inventory with h...
                                            <ul className="mt-6 space...">
                                              <li
                                                className="flex gap-2.5 text-sm leading-relaxed text-slate-700 sm:text..."
-                                               data-cursor-ref="e84"
                                              >
                                              <li
                                                className="flex gap-2.5 text-sm leading-relaxed text-slate-700 sm:text..."
-                                               data-cursor-ref="e85"
                                              >
                                              <li
                                                className="flex gap-2.5 text-sm leading-relaxed text-slate-700 sm:text..."
-                                               data-cursor-ref="e86"
                                              >
                                            <LinkComponent href="/product/i..." className="text-prima...">
                                              <a
                                                className="text-primary mt-7 inline-flex items-center gap-1.5 text-sm ..."
                                                ref={function}
                                                onClick={function onClick}
                                                onMouseEnter={function onMouseEnter}
                                                onTouchStart={function onTouchStart}
                                                href="/product/inventory"
-                                               data-cursor-ref="e9"
                                              >
                                          <div className="lg:order-1">
                                            <ExpandableScreenshot src="/marketing..." alt="Novend who..." ...>
                                              <button
                                                type="button"
                                                onClick={function onClick}
                                                className="landing-expandable-shot group/shot relative block w-full cu..."
                                                aria-label="View larger: Novend wholesale inventory and branch stock o..."
-                                               data-cursor-ref="e10"
                                              >
                                              ...
                                    <LandingSection id="product-re..." tone="pearl" className="px-4 py-16...">
                                      <section id="product-re..." aria-labelledby={undefined} className="relative s...">
                                        <div className="mx-auto gr...">
                                          <div className="lg:order-1">
                                            <p
                                              className="text-primary text-[13px] font-semibold tracking-[0.14em] uppe..."
-                                             data-cursor-ref="e87"
                                            >
+                                             {"Reports & evidence"}
                                            <h2
                                              className="mt-3 max-w-lg text-3xl font-semibold tracking-tight text-bala..."
-                                             data-cursor-ref="e88"
                                            >
+                                             Make decisions with evidence
                                            <p
                                              className="mt-4 max-w-[38rem] text-base leading-relaxed text-pretty text..."
-                                             data-cursor-ref="e89"
                                            >
+                                             Review revenue, margin, stock valuation, and exports from views that upda...
                                            <ul className="mt-6 space...">
                                              <li
                                                className="flex gap-2.5 text-sm leading-relaxed text-slate-700 sm:text..."
-                                               data-cursor-ref="e90"
                                              >
                                              <li
                                                className="flex gap-2.5 text-sm leading-relaxed text-slate-700 sm:text..."
-                                               data-cursor-ref="e91"
                                              >
                                              <li
                                                className="flex gap-2.5 text-sm leading-relaxed text-slate-700 sm:text..."
-                                               data-cursor-ref="e92"
                                              >
                                            <LinkComponent href="/product/r..." className="text-prima...">
                                              <a
                                                className="text-primary mt-7 inline-flex items-center gap-1.5 text-sm ..."
                                                ref={function}
                                                onClick={function onClick}
                                                onMouseEnter={function onMouseEnter}
                                                onTouchStart={function onTouchStart}
                                                href="/product/reports"
-                                               data-cursor-ref="e11"
                                              >
                                          <div className="lg:order-2">
                                            <ExpandableScreenshot src="/marketing..." alt="Novend ana..." ...>
                                              <button
                                                type="button"
                                                onClick={function onClick}
                                                className="landing-expandable-shot group/shot relative block w-full cu..."
                                                aria-label="View larger: Novend analytics overview with revenue and in..."
-                                               data-cursor-ref="e12"
                                              >
                                              ...
                                <LandingOfflineFlow>
                                  <section id="offline-sync" className="scroll-mt-...">
                                    <div className="mx-auto ma...">
                                      <div className="overflow-h...">
                                        <header className="mx-auto ma...">
                                          <p
                                            className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase"
-                                           data-cursor-ref="e93"
                                          >
+                                           {"Offline & sync"}
                                          <h2
                                            className="mt-3 text-3xl font-semibold tracking-tight text-balance text-wh..."
-                                           data-cursor-ref="e94"
                                          >
+                                           Built for unreliable connectivity
                                          <p
                                            className="mt-4 text-base leading-relaxed text-pretty text-slate-300 sm:te..."
-                                           data-cursor-ref="e95"
                                          >
+                                           After setup, the counter keeps working on the device. Pending changes uploa...
                                        <ol className="relative m...">
                                          <div>
                                          <li
                                            className="relative rounded-[20px] border border-white/10 p-5 sm:p-6 bg-[#..."
-                                           data-cursor-ref="e96"
                                          >
                                            <span>
                                            <p
                                              className="mt-3 text-base font-semibold tracking-tight text-white"
-                                             data-cursor-ref="e97"
                                            >
+                                             Sell on device
                                            <p
                                              className="mt-2 text-sm leading-relaxed text-slate-400"
-                                             data-cursor-ref="e98"
                                            >
+                                             Each completed sale and stock change is recorded on the counter first.
                                          <li
                                            className="relative rounded-[20px] border border-white/10 p-5 sm:p-6 bg-[#..."
-                                           data-cursor-ref="e99"
                                          >
                                            <span>
                                            <p
                                              className="mt-3 text-base font-semibold tracking-tight text-white"
-                                             data-cursor-ref="e100"
                                            >
+                                             Save locally
                                            <p
                                              className="mt-2 text-sm leading-relaxed text-slate-400"
-                                             data-cursor-ref="e101"
                                            >
+                                             Core selling and local operations continue when the network drops.
                                          <li
                                            className="relative rounded-[20px] border border-white/10 p-5 sm:p-6 bg-[#..."
-                                           data-cursor-ref="e102"
                                          >
                                            <span>
                                            <p
                                              className="mt-3 text-base font-semibold tracking-tight text-white"
-                                             data-cursor-ref="e103"
                                            >
+                                             Reconnect
                                            <p
                                              className="mt-2 text-sm leading-relaxed text-slate-400"
-                                             data-cursor-ref="e104"
                                            >
+                                             When connectivity returns, queued work is ready to upload.
                                          <li
                                            className="relative rounded-[20px] border border-white/10 p-5 sm:p-6 bg-[#..."
-                                           data-cursor-ref="e105"
                                          >
                                            <span>
                                            <p
                                              className="mt-3 text-base font-semibold tracking-tight text-white"
-                                             data-cursor-ref="e106"
                                            >
+                                             Sync safely
                                            <p
                                              className="mt-2 text-sm leading-relaxed text-slate-400"
-                                             data-cursor-ref="e107"
                                            >
+                                             Pending changes upload in the background and connected views refresh.
                                        <div>
                                        <p
                                          className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-s..."
-                                         data-cursor-ref="e108"
                                        >
+                                         Qualification: core selling and local operations continue offline after initi...
                                ...
                                  <section id="industries" aria-labelledby={undefined} className="relative s...">
                                    <div className="mx-auto w-...">
                                      <header className="max-w-2xl">
                                        <p
                                          className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase"
-                                         data-cursor-ref="e109"
                                        >
+                                         Industries
                                        <h2
                                          className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#0B..."
-                                         data-cursor-ref="e110"
                                        >
+                                         Built for how your store actually works
                                        <p
                                          className="mt-4 text-base leading-relaxed text-pretty text-[#526174] sm:text-lg"
-                                         data-cursor-ref="e111"
                                        >
+                                         Select an industry to see the checkout context and the capabilities that matt...
                                      <div className={"landing-..."} role="tablist" aria-label="Select an ...">
                                        <button
                                          id="industry-tab-pharmacy"
                                          type="button"
                                          role="tab"
                                          aria-selected={true}
                                          aria-controls="industry-panel-pharmacy"
                                          tabIndex={0}
                                          onClick={function onClick}
                                          onKeyDown={function onKeyDown}
                                          className="shrink-0 snap-start rounded-full px-4 py-2.5 text-sm font-semibol..."
-                                         data-cursor-ref="e13"
                                        >
+                                         Pharmacy
                                        <button
                                          id="industry-tab-supermarket"
                                          type="button"
                                          role="tab"
                                          aria-selected={false}
                                          aria-controls="industry-panel-supermarket"
                                          tabIndex={-1}
                                          onClick={function onClick}
                                          onKeyDown={function onKeyDown}
                                          className="shrink-0 snap-start rounded-full px-4 py-2.5 text-sm font-semibol..."
-                                         data-cursor-ref="e14"
                                        >
+                                         Supermarket
                                        <button
                                          id="industry-tab-wholesale"
                                          type="button"
                                          role="tab"
                                          aria-selected={false}
                                          aria-controls="industry-panel-wholesale"
                                          tabIndex={-1}
                                          onClick={function onClick}
                                          onKeyDown={function onKeyDown}
                                          className="shrink-0 snap-start rounded-full px-4 py-2.5 text-sm font-semibol..."
-                                         data-cursor-ref="e15"
                                        >
+                                         Wholesale
                                        <button
                                          id="industry-tab-fashion"
                                          type="button"
                                          role="tab"
                                          aria-selected={false}
                                          aria-controls="industry-panel-fashion"
                                          tabIndex={-1}
                                          onClick={function onClick}
                                          onKeyDown={function onKeyDown}
                                          className="shrink-0 snap-start rounded-full px-4 py-2.5 text-sm font-semibol..."
-                                         data-cursor-ref="e16"
                                        >
+                                         Fashion
                                        <button
                                          id="industry-tab-electronics"
                                          type="button"
                                          role="tab"
                                          aria-selected={false}
                                          aria-controls="industry-panel-electronics"
                                          tabIndex={-1}
                                          onClick={function onClick}
                                          onKeyDown={function onKeyDown}
                                          className="shrink-0 snap-start rounded-full px-4 py-2.5 text-sm font-semibol..."
-                                         data-cursor-ref="e17"
                                        >
+                                         Electronics
                                      <div id="industry-p..." role="tabpanel" aria-labelledby="industry-t..." ...>
                                        <div className="grid min-w...">
                                          <div className="order-2 fl...">
                                            <h3
                                              className="text-xl font-semibold tracking-tight text-[#0B1220] sm:text-2xl"
-                                             data-cursor-ref="e112"
                                            >
+                                             Pharmacy counters
                                            <p
                                              className="mt-3 text-sm leading-relaxed text-[#526174] sm:text-base"
-                                             data-cursor-ref="e113"
                                            >
+                                             Dispense with batch tracking, expiry alerts, and barcode-ready checkout. ...
                                            <ul className="mt-5 space...">
                                              <li
                                                className="flex gap-2.5 text-sm leading-snug text-[#0B1220]"
-                                               data-cursor-ref="e114"
                                              >
                                              <li
                                                className="flex gap-2.5 text-sm leading-snug text-[#0B1220]"
-                                               data-cursor-ref="e115"
                                              >
                                              <li
                                                className="flex gap-2.5 text-sm leading-snug text-[#0B1220]"
-                                               data-cursor-ref="e116"
                                              >
                                            <LinkComponent href="https://da..." className="text-prima...">
                                              <a
                                                className="text-primary mt-6 inline-flex items-center gap-1.5 text-sm ..."
                                                ref={function}
                                                onClick={function onClick}
                                                onMouseEnter={function onMouseEnter}
                                                onTouchStart={function onTouchStart}
                                                href="https://dashboard.novendpos.app/signup"
-                                               data-cursor-ref="e18"
                                              >
                                          <div className="order-1 fl...">
                                            <div className="landing-mo...">
                                              <div className="landing-mo...">
                                                <ExpandableScreenshot src="/marketing..." alt="Novend pha..." ...>
                                                  <button
                                                    type="button"
                                                    onClick={function onClick}
                                                    className="landing-expandable-shot group/shot relative block w-ful..."
                                                    aria-label="View larger: Novend pharmacy POS sale screen with medi..."
-                                                   data-cursor-ref="e19"
                                                  >
                                                  ...
                                                ...
                                              ...
                                      ...
                                <LandingResearchProof>
                                  <LandingSection id="proof" tone="pearl" className="px-4 py-16...">
                                    <section id="proof" aria-labelledby={undefined} className="relative s...">
                                      <div className="mx-auto ma...">
                                        <p
                                          className="text-[13px] font-semibold tracking-[0.14em] text-amber-700 uppercase"
-                                         data-cursor-ref="e117"
                                        >
+                                         Built with local retailers
                                        <h2
                                          className="mt-3 text-2xl font-semibold tracking-tight text-balance text-[#0F..."
-                                         data-cursor-ref="e118"
                                        >
+                                         Designed from counter realities—not invented testimonials
                                        <p
                                          className="mt-4 text-base leading-relaxed text-pretty text-slate-600 sm:text-lg"
-                                         data-cursor-ref="e119"
                                        >
+                                         Novend is shaped around pharmacies, provision shops, wholesalers, and multi-b...
                                <LandingPricingPreview>
                                  <LandingSection id="pricing" tone="soft" className="px-4 py-16...">
                                    <section id="pricing" aria-labelledby={undefined} className="relative s...">
                                      <div className="mx-auto ma...">
                                        <header className="mx-auto ma...">
                                          <p
                                            className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase"
-                                           data-cursor-ref="e120"
                                          >
+                                           Pricing
                                          <h2
                                            className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#..."
-                                           data-cursor-ref="e121"
                                          >
+                                           Clear plans for how you grow
                                          <p
                                            className="mt-4 text-base leading-relaxed text-pretty text-slate-600 sm:te..."
-                                           data-cursor-ref="e122"
                                          >
+                                           Every plan includes offline POS after setup, barcode support, receipts, inv...
                                        <div className="mt-8 flex ...">
                                          <div className="inline-fle..." role="group" aria-label="Billing cycle">
                                            <button
                                              type="button"
                                              aria-pressed={true}
                                              onClick={function onClick}
                                              className="rounded-full px-4 py-2 text-sm font-medium transition-colors ..."
-                                             data-cursor-ref="e20"
                                            >
                                            <button
                                              type="button"
                                              aria-pressed={false}
                                              onClick={function onClick}
                                              className="rounded-full px-4 py-2 text-sm font-medium transition-colors ..."
-                                             data-cursor-ref="e21"
                                            >
                                        <ul className="mt-10 grid...">
                                          <li
                                            className="flex flex-col rounded-[20px] border p-6 border-slate-200/90 bg-..."
-                                           data-cursor-ref="e123"
                                          >
                                            <div className="flex items...">
                                              <p
                                                className="text-sm font-semibold tracking-tight text-[#0F172A]"
-                                               data-cursor-ref="e124"
                                              >
+                                               Basic
                                            <p
                                              className="mt-4 text-3xl font-semibold tracking-tight text-[#0F172A]"
-                                             data-cursor-ref="e125"
                                            >
                                            <p
                                              className="mt-4 text-sm leading-relaxed text-slate-600"
-                                             data-cursor-ref="e126"
                                            >
+                                             For single-location shops that need a dependable counter and catalogue.
                                            <_c asChild={true} className="mt-6 w-full" variant="outline">
                                              <Slot.Slot className={"inline-f..."} ref={null}>
                                                <LinkComponent href="https://da..." className={"inline-f..."} ref={null}>
                                                  <a
                                                    className={"inline-flex items-center justify-center gap-2 whitesp..."}
                                                    ref={function}
                                                    onClick={function onClick}
                                                    onMouseEnter={function onMouseEnter}
                                                    onTouchStart={function onTouchStart}
                                                    href="https://dashboard.novendpos.app/signup"
-                                                   data-cursor-ref="e22"
                                                  >
+                                                   Start free trial
                                          <li
                                            className="flex flex-col rounded-[20px] border p-6 border-primary/40 bg-wh..."
-                                           data-cursor-ref="e127"
                                          >
                                            <div className="flex items...">
                                              <p
                                                className="text-sm font-semibold tracking-tight text-[#0F172A]"
-                                               data-cursor-ref="e128"
                                              >
+                                               Pro
                                              ...
                                            <p
                                              className="mt-4 text-3xl font-semibold tracking-tight text-[#0F172A]"
-                                             data-cursor-ref="e129"
                                            >
                                            <p
                                              className="mt-4 text-sm leading-relaxed text-slate-600"
-                                             data-cursor-ref="e130"
                                            >
+                                             For pharmacies, supermarkets, and growing wholesalers that need branches ...
                                            <_c asChild={true} className="mt-6 w-full" variant="default">
                                              <Slot.Slot className={"inline-f..."} ref={null}>
                                                <LinkComponent href="https://da..." className={"inline-f..."} ref={null}>
                                                  <a
                                                    className={"inline-flex items-center justify-center gap-2 whitesp..."}
                                                    ref={function}
                                                    onClick={function onClick}
                                                    onMouseEnter={function onMouseEnter}
                                                    onTouchStart={function onTouchStart}
                                                    href="https://dashboard.novendpos.app/signup"
-                                                   data-cursor-ref="e23"
                                                  >
+                                                   Start free trial
                                          <li
                                            className="flex flex-col rounded-[20px] border p-6 border-slate-200/90 bg-..."
-                                           data-cursor-ref="e131"
                                          >
                                            <div className="flex items...">
                                              <p
                                                className="text-sm font-semibold tracking-tight text-[#0F172A]"
-                                               data-cursor-ref="e132"
                                              >
+                                               Enterprise
                                            <p
                                              className="mt-4 text-3xl font-semibold tracking-tight text-[#0F172A]"
-                                             data-cursor-ref="e133"
                                            >
                                            <p
                                              className="mt-4 text-sm leading-relaxed text-slate-600"
-                                             data-cursor-ref="e134"
                                            >
+                                             For chains and distributors that need custom limits, onboarding, and supp...
                                            <_c asChild={true} className="mt-6 w-full" variant="outline">
                                              <Slot.Slot className={"inline-f..."} ref={null}>
                                                <LinkComponent href={"mailto:a..."} className={"inline-f..."} ref={null}>
                                                  <a
                                                    className={"inline-flex items-center justify-center gap-2 whitesp..."}
                                                    ref={function}
                                                    onClick={function onClick}
                                                    onMouseEnter={function onMouseEnter}
                                                    onTouchStart={function onTouchStart}
                                                    href={"mailto:asiedudev.hub@gmail.com?subject=Novend%20Enterprise..."}
-                                                   data-cursor-ref="e24"
                                                  >
+                                                   Talk to sales
                                        <p
                                          className="mt-6 text-center text-xs leading-relaxed text-slate-500"
-                                         data-cursor-ref="e135"
                                        >
+                                         Lifetime is no longer offered for new purchases. Organizations that already h...
                                        <div className="mt-8 text-...">
                                          <LinkComponent href="/pricing" className="text-prima...">
                                            <a
                                              className="text-primary text-sm font-semibold underline-offset-4 hover:u..."
                                              ref={function}
                                              onClick={function onClick}
                                              onMouseEnter={function onMouseEnter}
                                              onTouchStart={function onTouchStart}
                                              href="/pricing"
-                                             data-cursor-ref="e25"
                                            >
+                                             Compare all features
                                ...
                                  <section id="faq" aria-labelledby={undefined} className="relative s...">
                                    <div className="mx-auto ma...">
                                      <header className="mx-auto ma...">
                                        <p
                                          className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase"
-                                         data-cursor-ref="e136"
                                        >
+                                         FAQ
                                        <h2
                                          className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#0F..."
-                                         data-cursor-ref="e137"
                                        >
+                                         Questions retailers ask first
                                      <div className="mt-12 grid...">
                                        ...
                                          <div className="flex flex-..." data-orientation="vertical" ...>
                                            ...
                                              <_c2 className={"group ga..."}>
                                                <AccordionHeader className="flex">
                                                  <Primitive.h3 data-orientation="vertical" data-state="closed" ...>
                                                    <h3
                                                      data-orientation="vertical"
                                                      data-state="closed"
                                                      data-disabled={undefined}
                                                      className="flex"
                                                      ref={null}
-                                                     data-cursor-ref="e138"
                                                    >
                                                      ...
                                                        <AccordionCollectionItemSlot.Slot data-radix-collection-item="" ...>
                                                          <CollapsibleTrigger aria-disabled={undefined} ...>
                                                            <Primitive.button type="button" aria-controls={undefined} ...>
                                                              <button
                                                                type="button"
                                                                aria-controls={undefined}
                                                                aria-expanded={false}
                                                                data-state="closed"
                                                                data-disabled={undefined}
                                                                disabled={undefined}
                                                                aria-disabled={undefined}
                                                                data-orientation="vertical"
                                                                id="radix-_R_b8l9bmlalb_"
                                                                className={"flex flex-1 items-center justify-between ..."}
                                                                data-radix-collection-item=""
                                                                onClick={function handleEvent}
                                                                ref={function}
-                                                               data-cursor-ref="e26"
                                                              >
                                            ...
                                              <_c2 className={"group ga..."}>
                                                <AccordionHeader className="flex">
                                                  <Primitive.h3 data-orientation="vertical" data-state="closed" ...>
                                                    <h3
                                                      data-orientation="vertical"
                                                      data-state="closed"
                                                      data-disabled={undefined}
                                                      className="flex"
                                                      ref={null}
-                                                     data-cursor-ref="e139"
                                                    >
                                                      ...
                                                        <AccordionCollectionItemSlot.Slot data-radix-collection-item="" ...>
                                                          <CollapsibleTrigger aria-disabled={undefined} ...>
                                                            <Primitive.button type="button" aria-controls={undefined} ...>
                                                              <button
                                                                type="button"
                                                                aria-controls={undefined}
                                                                aria-expanded={false}
                                                                data-state="closed"
                                                                data-disabled={undefined}
                                                                disabled={undefined}
                                                                aria-disabled={undefined}
                                                                data-orientation="vertical"
                                                                id="radix-_R_j8l9bmlalb_"
                                                                className={"flex flex-1 items-center justify-between ..."}
                                                                data-radix-collection-item=""
                                                                onClick={function handleEvent}
                                                                ref={function}
-                                                               data-cursor-ref="e27"
                                                              >
                                            ...
                                              <_c2 className={"group ga..."}>
                                                <AccordionHeader className="flex">
                                                  <Primitive.h3 data-orientation="vertical" data-state="closed" ...>
                                                    <h3
                                                      data-orientation="vertical"
                                                      data-state="closed"
                                                      data-disabled={undefined}
                                                      className="flex"
                                                      ref={null}
-                                                     data-cursor-ref="e140"
                                                    >
                                                      ...
                                                        <AccordionCollectionItemSlot.Slot data-radix-collection-item="" ...>
                                                          <CollapsibleTrigger aria-disabled={undefined} ...>
                                                            <Primitive.button type="button" aria-controls={undefined} ...>
                                                              <button
                                                                type="button"
                                                                aria-controls={undefined}
                                                                aria-expanded={false}
                                                                data-state="closed"
                                                                data-disabled={undefined}
                                                                disabled={undefined}
                                                                aria-disabled={undefined}
                                                                data-orientation="vertical"
                                                                id="radix-_R_r8l9bmlalb_"
                                                                className={"flex flex-1 items-center justify-between ..."}
                                                                data-radix-collection-item=""
                                                                onClick={function handleEvent}
                                                                ref={function}
-                                                               data-cursor-ref="e28"
                                                              >
                                            ...
                                              <_c2 className={"group ga..."}>
                                                <AccordionHeader className="flex">
                                                  <Primitive.h3 data-orientation="vertical" data-state="closed" ...>
                                                    <h3
                                                      data-orientation="vertical"
                                                      data-state="closed"
                                                      data-disabled={undefined}
                                                      className="flex"
                                                      ref={null}
-                                                     data-cursor-ref="e141"
                                                    >
                                                      ...
                                                        <AccordionCollectionItemSlot.Slot data-radix-collection-item="" ...>
                                                          <CollapsibleTrigger aria-disabled={undefined} ...>
                                                            <Primitive.button type="button" aria-controls={undefined} ...>
                                                              <button
                                                                type="button"
                                                                aria-controls={undefined}
                                                                aria-expanded={false}
                                                                data-state="closed"
                                                                data-disabled={undefined}
                                                                disabled={undefined}
                                                                aria-disabled={undefined}
                                                                data-orientation="vertical"
                                                                id="radix-_R_138l9bmlalb_"
                                                                className={"flex flex-1 items-center justify-between ..."}
                                                                data-radix-collection-item=""
                                                                onClick={function handleEvent}
                                                                ref={function}
-                                                               data-cursor-ref="e29"
                                                              >
                                            ...
                                              <_c2 className={"group ga..."}>
                                                <AccordionHeader className="flex">
                                                  <Primitive.h3 data-orientation="vertical" data-state="closed" ...>
                                                    <h3
                                                      data-orientation="vertical"
                                                      data-state="closed"
                                                      data-disabled={undefined}
                                                      className="flex"
                                                      ref={null}
-                                                     data-cursor-ref="e142"
                                                    >
                                                      ...
                                                        <AccordionCollectionItemSlot.Slot data-radix-collection-item="" ...>
                                                          <CollapsibleTrigger aria-disabled={undefined} ...>
                                                            <Primitive.button type="button" aria-controls={undefined} ...>
                                                              <button
                                                                type="button"
                                                                aria-controls={undefined}
                                                                aria-expanded={false}
                                                                data-state="closed"
                                                                data-disabled={undefined}
                                                                disabled={undefined}
                                                                aria-disabled={undefined}
                                                                data-orientation="vertical"
                                                                id="radix-_R_1b8l9bmlalb_"
                                                                className={"flex flex-1 items-center justify-between ..."}
                                                                data-radix-collection-item=""
                                                                onClick={function handleEvent}
                                                                ref={function}
-                                                               data-cursor-ref="e30"
                                                              >
                                            ...
                                              <_c2 className={"group ga..."}>
                                                <AccordionHeader className="flex">
                                                  <Primitive.h3 data-orientation="vertical" data-state="closed" ...>
                                                    <h3
                                                      data-orientation="vertical"
                                                      data-state="closed"
                                                      data-disabled={undefined}
                                                      className="flex"
                                                      ref={null}
-                                                     data-cursor-ref="e143"
                                                    >
                                                      ...
                                                        <AccordionCollectionItemSlot.Slot data-radix-collection-item="" ...>
                                                          <CollapsibleTrigger aria-disabled={undefined} ...>
                                                            <Primitive.button type="button" aria-controls={undefined} ...>
                                                              <button
                                                                type="button"
                                                                aria-controls={undefined}
                                                                aria-expanded={false}
                                                                data-state="closed"
                                                                data-disabled={undefined}
                                                                disabled={undefined}
                                                                aria-disabled={undefined}
                                                                data-orientation="vertical"
                                                                id="radix-_R_1j8l9bmlalb_"
                                                                className={"flex flex-1 items-center justify-between ..."}
                                                                data-radix-collection-item=""
                                                                onClick={function handleEvent}
                                                                ref={function}
-                                                               data-cursor-ref="e31"
                                                              >
                                        <aside className="relative o...">
                                          <div className="flex items...">
                                            <div className="min-w-0 fl...">
                                              <h3
                                                className="text-xl font-semibold tracking-tight text-[#0F172A]"
-                                               data-cursor-ref="e144"
                                              >
+                                               Still have questions?
                                              <p
                                                className="mt-2.5 text-sm leading-relaxed text-slate-600"
-                                               data-cursor-ref="e145"
                                              >
+                                               Contact our support team anytime.
                                              <_c asChild={true} className="mt-6 font-...">
                                                <Slot.Slot className={"inline-f..."} ref={null}>
                                                  <a
                                                    href={"mailto:asiedudev.hub@gmail.com?subject=Novend%20Sales%20In..."}
                                                    className={"inline-flex items-center justify-center gap-2 whitesp..."}
                                                    ref={null}
-                                                   data-cursor-ref="e32"
                                                  >
+                                                   Contact support
                                            ...
                                ...
                                  <div className="landing-ct...">
                                    <div>
                                    <div className="relative z...">
                                      <div className="flex flex-...">
                                        <h2
                                          className="text-3xl font-semibold tracking-tight text-balance text-white sm:..."
-                                         data-cursor-ref="e146"
                                        >
+                                         Ready for a calmer counter?
                                        <p
                                          className="mt-4 max-w-xl text-base leading-relaxed text-pretty text-slate-30..."
-                                         data-cursor-ref="e147"
                                        >
+                                         Set up your catalogue, make a test sale, and see how Novend handles a working...
                                        <div className="mt-8 flex ...">
                                          <_c asChild={true} size="lg" className="h-12 round...">
                                            <Slot.Slot className={"inline-f..."} ref={null}>
                                              <LinkComponent href="https://da..." className={"inline-f..."} ref={null}>
                                                <a
                                                  className={"inline-flex items-center justify-center gap-2 whitespac..."}
                                                  ref={function}
                                                  onClick={function onClick}
                                                  onMouseEnter={function onMouseEnter}
                                                  onTouchStart={function onTouchStart}
                                                  href="https://dashboard.novendpos.app/signup"
-                                                 data-cursor-ref="e33"
                                                >
+                                                 Start free
                                          <_c asChild={true} size="lg" variant="outline" className="h-12 round...">
                                            <Slot.Slot className={"inline-f..."} ref={null}>
                                              <LinkComponent href={"mailto:a..."} className={"inline-f..."} ref={null}>
                                                <a
                                                  className={"inline-flex items-center justify-center gap-2 whitespac..."}
                                                  ref={function}
                                                  onClick={function onClick}
                                                  onMouseEnter={function onMouseEnter}
                                                  onTouchStart={function onTouchStart}
                                                  href={"mailto:asiedudev.hub@gmail.com?subject=Novend%20Sales%20Inqu..."}
-                                                 data-cursor-ref="e34"
                                                >
+                                                 Talk to sales
                                        <p
                                          className="mt-8 text-sm text-slate-400"
-                                         data-cursor-ref="e148"
                                        >
+                                         Windows • macOS • Linux • Android • iPhone/iPad PWA
                                      ...
                              <LandingFooter>
                                <footer className="bg-[#0B122...">
                                  <div className="mx-auto ma...">
                                    <div className="flex flex-...">
                                      <div className="max-w-sm s...">
                                        <LinkComponent href="/" className="inline-fle...">
                                          <a
                                            className="inline-flex items-center gap-3"
                                            ref={function}
                                            onClick={function onClick}
                                            onMouseEnter={function onMouseEnter}
                                            onTouchStart={function onTouchStart}
                                            href="/"
-                                           data-cursor-ref="e35"
                                          >
                                        <p
                                          className="text-sm font-medium tracking-tight text-white"
-                                         data-cursor-ref="e149"
                                        >
+                                         Novend by Asiedu Development Hub
                                        <p
                                          className="text-sm leading-relaxed text-slate-400"
-                                         data-cursor-ref="e150"
                                        >
+                                         Commercial POS for pharmacies, supermarkets, wholesalers, and multi-branch re...
                                      <div className="grid flex-...">
                                        <FooterColumn title="Product" links={[...]}>
                                          <div className={undefined}>
                                            <p
                                              className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 up..."
-                                             data-cursor-ref="e151"
                                            >
+                                             Product
                                            <ul className="mt-4 space...">
                                              <li
-                                               data-cursor-ref="e152"
                                              >
                                                <FooterLink href="/product/pos">
                                                  <LinkComponent href="/product/pos" className="text-sm te...">
                                                    <a
                                                      className="text-sm text-slate-400 transition-colors hover:text-w..."
                                                      ref={function}
                                                      onClick={function onClick}
                                                      onMouseEnter={function onMouseEnter}
                                                      onTouchStart={function onTouchStart}
                                                      href="/product/pos"
-                                                     data-cursor-ref="e36"
                                                    >
+                                                     Point of Sale
                                              <li
-                                               data-cursor-ref="e153"
                                              >
                                                <FooterLink href="/product/i...">
                                                  <LinkComponent href="/product/i..." className="text-sm te...">
                                                    <a
                                                      className="text-sm text-slate-400 transition-colors hover:text-w..."
                                                      ref={function}
                                                      onClick={function onClick}
                                                      onMouseEnter={function onMouseEnter}
                                                      onTouchStart={function onTouchStart}
                                                      href="/product/inventory"
-                                                     data-cursor-ref="e37"
                                                    >
+                                                     Inventory
                                              <li
-                                               data-cursor-ref="e154"
                                              >
                                                <FooterLink href="/product/o...">
                                                  <LinkComponent href="/product/o..." className="text-sm te...">
                                                    <a
                                                      className="text-sm text-slate-400 transition-colors hover:text-w..."
                                                      ref={function}
                                                      onClick={function onClick}
                                                      onMouseEnter={function onMouseEnter}
                                                      onTouchStart={function onTouchStart}
                                                      href="/product/offline-sync"
-                                                     data-cursor-ref="e38"
                                                    >
+                                                     {"Offline & Sync"}
                                              <li
-                                               data-cursor-ref="e155"
                                              >
                                                <FooterLink href="/pricing">
                                                  <LinkComponent href="/pricing" className="text-sm te...">
                                                    <a
                                                      className="text-sm text-slate-400 transition-colors hover:text-w..."
                                                      ref={function}
                                                      onClick={function onClick}
                                                      onMouseEnter={function onMouseEnter}
                                                      onTouchStart={function onTouchStart}
                                                      href="/pricing"
-                                                     data-cursor-ref="e39"
                                                    >
+                                                     Pricing
                                              <li
-                                               data-cursor-ref="e156"
                                              >
                                                <FooterLink href="/download">
                                                  <LinkComponent href="/download" className="text-sm te...">
                                                    <a
                                                      className="text-sm text-slate-400 transition-colors hover:text-w..."
                                                      ref={function}
                                                      onClick={function onClick}
                                                      onMouseEnter={function onMouseEnter}
                                                      onTouchStart={function onTouchStart}
                                                      href="/download"
-                                                     data-cursor-ref="e40"
                                                    >
+                                                     Download
                                        <FooterColumn title="Industries" links={[...]}>
                                          <div className={undefined}>
                                            <p
                                              className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 up..."
-                                             data-cursor-ref="e157"
                                            >
+                                             Industries
                                            <ul className="mt-4 space...">
                                              <li
-                                               data-cursor-ref="e158"
                                              >
                                                <FooterLink href="/#industry...">
                                                  <a
                                                    href="/#industry-pharmacy"
                                                    className="text-sm text-slate-400 transition-colors hover:text-whi..."
-                                                   data-cursor-ref="e41"
                                                  >
+                                                   Pharmacy
                                              <li
-                                               data-cursor-ref="e159"
                                              >
                                                <FooterLink href="/#industry...">
                                                  <a
                                                    href="/#industry-supermarket"
                                                    className="text-sm text-slate-400 transition-colors hover:text-whi..."
-                                                   data-cursor-ref="e42"
                                                  >
+                                                   Supermarket
                                              <li
-                                               data-cursor-ref="e160"
                                              >
                                                <FooterLink href="/#industry...">
                                                  <a
                                                    href="/#industry-wholesale"
                                                    className="text-sm text-slate-400 transition-colors hover:text-whi..."
-                                                   data-cursor-ref="e43"
                                                  >
+                                                   Wholesale
                                              <li
-                                               data-cursor-ref="e161"
                                              >
                                                <FooterLink href="/#industry...">
                                                  <a
                                                    href="/#industry-fashion"
                                                    className="text-sm text-slate-400 transition-colors hover:text-whi..."
-                                                   data-cursor-ref="e44"
                                                  >
+                                                   {"Fashion & Specialty"}
                                              <li
-                                               data-cursor-ref="e162"
                                              >
                                                <FooterLink href="/#industry...">
                                                  <a
                                                    href="/#industry-electronics"
                                                    className="text-sm text-slate-400 transition-colors hover:text-whi..."
-                                                   data-cursor-ref="e45"
                                                  >
+                                                   Electronics
                                        <FooterColumn title="Resources" links={[...]}>
                                          <div className={undefined}>
                                            <p
                                              className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 up..."
-                                             data-cursor-ref="e163"
                                            >
+                                             Resources
                                            <ul className="mt-4 space...">
                                              <li
-                                               data-cursor-ref="e164"
                                              >
                                                <FooterLink href="/docs">
                                                  <LinkComponent href="/docs" className="text-sm te...">
                                                    <a
                                                      className="text-sm text-slate-400 transition-colors hover:text-w..."
                                                      ref={function}
                                                      onClick={function onClick}
                                                      onMouseEnter={function onMouseEnter}
                                                      onTouchStart={function onTouchStart}
                                                      href="/docs"
-                                                     data-cursor-ref="e46"
                                                    >
+                                                     Documentation
                                              <li
-                                               data-cursor-ref="e165"
                                              >
                                                <FooterLink href="/docs/help">
                                                  <LinkComponent href="/docs/help" className="text-sm te...">
                                                    <a
                                                      className="text-sm text-slate-400 transition-colors hover:text-w..."
                                                      ref={function}
                                                      onClick={function onClick}
                                                      onMouseEnter={function onMouseEnter}
                                                      onTouchStart={function onTouchStart}
                                                      href="/docs/help"
-                                                     data-cursor-ref="e47"
                                                    >
+                                                     Help Center
                                              <li
-                                               data-cursor-ref="e166"
                                              >
                                                <FooterLink href="/docs/rele...">
                                                  <LinkComponent href="/docs/rele..." className="text-sm te...">
                                                    <a
                                                      className="text-sm text-slate-400 transition-colors hover:text-w..."
                                                      ref={function}
                                                      onClick={function onClick}
                                                      onMouseEnter={function onMouseEnter}
                                                      onTouchStart={function onTouchStart}
                                                      href="/docs/releases"
-                                                     data-cursor-ref="e48"
                                                    >
+                                                     Release Notes
                                              <li
-                                               data-cursor-ref="e167"
                                              >
                                                <FooterLink href={"mailto:a..."}>
                                                  <a
                                                    href={"mailto:asiedudev.hub@gmail.com?subject=Novend%20Sales%20In..."}
                                                    className="text-sm text-slate-400 transition-colors hover:text-whi..."
-                                                   data-cursor-ref="e49"
                                                  >
+                                                   Contact Support
                                        <FooterColumn title="Legal" links={[...]}>
                                          <div className={undefined}>
                                            <p
                                              className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 up..."
-                                             data-cursor-ref="e168"
                                            >
+                                             Legal
                                            <ul className="mt-4 space...">
                                              <li
-                                               data-cursor-ref="e169"
                                              >
                                                <FooterLink href="/privacy">
                                                  <LinkComponent href="/privacy" className="text-sm te...">
                                                    <a
                                                      className="text-sm text-slate-400 transition-colors hover:text-w..."
                                                      ref={function}
                                                      onClick={function onClick}
                                                      onMouseEnter={function onMouseEnter}
                                                      onTouchStart={function onTouchStart}
                                                      href="/privacy"
-                                                     data-cursor-ref="e50"
                                                    >
+                                                     Privacy Policy
                                              <li
-                                               data-cursor-ref="e170"
                                              >
                                                <FooterLink href="/terms">
                                                  <LinkComponent href="/terms" className="text-sm te...">
                                                    <a
                                                      className="text-sm text-slate-400 transition-colors hover:text-w..."
                                                      ref={function}
                                                      onClick={function onClick}
                                                      onMouseEnter={function onMouseEnter}
                                                      onTouchStart={function onTouchStart}
                                                      href="/terms"
-                                                     data-cursor-ref="e51"
                                                    >
+                                                     Terms of Service
                                              <li
-                                               data-cursor-ref="e171"
                                              >
                                                <FooterLink href="/refund">
                                                  <LinkComponent href="/refund" className="text-sm te...">
                                                    <a
                                                      className="text-sm text-slate-400 transition-colors hover:text-w..."
                                                      ref={function}
                                                      onClick={function onClick}
                                                      onMouseEnter={function onMouseEnter}
                                                      onTouchStart={function onTouchStart}
                                                      href="/refund"
-                                                     data-cursor-ref="e52"
                                                    >
+                                                     Refund Policy
                                              <li
-                                               data-cursor-ref="e172"
                                              >
                                                <FooterLink href="/cookies">
                                                  <LinkComponent href="/cookies" className="text-sm te...">
                                                    <a
                                                      className="text-sm text-slate-400 transition-colors hover:text-w..."
                                                      ref={function}
                                                      onClick={function onClick}
                                                      onMouseEnter={function onMouseEnter}
                                                      onTouchStart={function onTouchStart}
                                                      href="/cookies"
-                                                     data-cursor-ref="e53"
                                                    >
+                                                     Cookie Policy
                                              <li
-                                               data-cursor-ref="e173"
                                              >
                                                <FooterLink href="/aup">
                                                  <LinkComponent href="/aup" className="text-sm te...">
                                                    <a
                                                      className="text-sm text-slate-400 transition-colors hover:text-w..."
                                                      ref={function}
                                                      onClick={function onClick}
                                                      onMouseEnter={function onMouseEnter}
                                                      onTouchStart={function onTouchStart}
                                                      href="/aup"
-                                                     data-cursor-ref="e54"
                                                    >
+                                                     Acceptable Use
                                              <li
-                                               data-cursor-ref="e174"
                                              >
                                                <FooterLink href="/dpa">
                                                  <LinkComponent href="/dpa" className="text-sm te...">
                                                    <a
                                                      className="text-sm text-slate-400 transition-colors hover:text-w..."
                                                      ref={function}
                                                      onClick={function onClick}
                                                      onMouseEnter={function onMouseEnter}
                                                      onTouchStart={function onTouchStart}
                                                      href="/dpa"
-                                                     data-cursor-ref="e55"
                                                    >
+                                                     Data Processing
                                    <div className="mt-12 bord...">
                                      <p
                                        className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase"
-                                       data-cursor-ref="e175"
                                      >
+                                       Contact
                                      <ul className="mt-4 grid ...">
                                        <ContactItem icon={{...}} label="Email" value="asiedudev...." ...>
                                          <li
                                            className="flex gap-3"
-                                           data-cursor-ref="e176"
                                          >
                                            <Mail>
                                            <div className="min-w-0">
                                              <p
                                                className="text-[11px] font-medium tracking-wide text-slate-500 uppercase"
-                                               data-cursor-ref="e177"
                                              >
+                                               Email
                                              <a
                                                href="mailto:asiedudev.hub@gmail.com"
                                                className="mt-0.5 block text-sm text-slate-300 transition-colors hover..."
-                                               data-cursor-ref="e56"
                                              >
+                                               asiedudev.hub@gmail.com
                                        <ContactItem icon={{...}} label="WhatsApp (UK)" value="+44 7868 1..." ...>
                                          <li
                                            className="flex gap-3"
-                                           data-cursor-ref="e178"
                                          >
                                            <MessageCircle>
                                            <div className="min-w-0">
                                              <p
                                                className="text-[11px] font-medium tracking-wide text-slate-500 uppercase"
-                                               data-cursor-ref="e179"
                                              >
+                                               WhatsApp (UK)
                                              <a
                                                href="https://wa.me/447868178108"
                                                className="mt-0.5 block text-sm text-slate-300 transition-colors hover..."
-                                               data-cursor-ref="e57"
                                              >
+                                               +44 7868 178108
                                        <ContactItem icon={{...}} label={"Calls & ..."} value="+233 55 52..." ...>
                                          <li
                                            className="flex gap-3"
-                                           data-cursor-ref="e180"
                                          >
                                            <Phone>
                                            <div className="min-w-0">
                                              <p
                                                className="text-[11px] font-medium tracking-wide text-slate-500 uppercase"
-                                               data-cursor-ref="e181"
                                              >
+                                               {"Calls & WhatsApp (Ghana)"}
                                              <a
                                                href="tel:+233555257482"
                                                className="mt-0.5 block text-sm text-slate-300 transition-colors hover..."
-                                               data-cursor-ref="e58"
                                              >
+                                               +233 55 525 7482
                                              <a
                                                href="https://wa.me/233555257482"
                                                className="mt-1 inline-block text-xs font-medium text-slate-400 transi..."
-                                               data-cursor-ref="e59"
                                              >
+                                               WhatsApp
                                        <ContactItem icon={{...}} label="Location" value="Sunyani, B...">
                                          <li
                                            className="flex gap-3"
-                                           data-cursor-ref="e182"
                                          >
                                            <MapPin>
                                            <div className="min-w-0">
                                              <p
                                                className="text-[11px] font-medium tracking-wide text-slate-500 uppercase"
-                                               data-cursor-ref="e183"
                                              >
+                                               Location
                                              <p
                                                className="mt-0.5 text-sm text-slate-300"
-                                               data-cursor-ref="e184"
                                              >
+                                               Sunyani, Bono Region, Ghana
                                  <div className="border-t b...">
                                    <div className="mx-auto fl...">
                                      <p
-                                       data-cursor-ref="e185"
                                      >
                                      <div className="flex flex-...">
                                        <button
                                          type="button"
                                          onClick={function onClick}
                                          className="font-medium text-slate-400 transition-colors hover:text-[#38BDF8]..."
-                                         data-cursor-ref="e60"
                                        >
+                                         Cookie settings
                                        <p
                                          className="font-medium text-slate-400"
-                                         data-cursor-ref="e186"
                                        >
+                                         {"Designed & developed by Asiedu Development Hub"}
                    ...
                  ...
      ...



    at a (<anonymous>:null:null)
    at LandingPage (features/marketing/components/landing-page.tsx:50:7)
    at HomePage (app\page.tsx:19:7)

## Code Frame
  48 |       className="marketing-forced-light text-foreground landing-page-canvas h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain"
  49 |     >
> 50 |       <a
     |       ^
  51 |         href="#product"
  52 |         className="bg-primary text-primary-foreground focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:px-3 focus:py-2 focus:ring-2"
  53 |       >

Next.js version: 16.3.5 (Turbopack)
