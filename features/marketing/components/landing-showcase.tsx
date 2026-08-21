/** Scroll-stage visual: isometric POS + floating KPIs + inventory depth. */
export function LandingShowcase() {
  return (
    <section className="landing-showcase relative overflow-hidden px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="relative z-10 mx-auto max-w-6xl">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-primary text-sm font-semibold tracking-wide">Product depth</p>
          <h2 className="text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            A till that feels modern — even when the network does not
          </h2>
        </div>

        <div className="landing-perspective relative mt-16 min-h-[420px] sm:min-h-[480px]">
          <div
            data-kpi
            className="landing-kpi-float landing-kpi-float-a landing-depth-preserve absolute top-4 left-2 z-20 sm:left-8"
          >
            <p>Today</p>
            <strong>+18% sales</strong>
          </div>
          <div
            data-kpi
            className="landing-kpi-float landing-kpi-float-b landing-depth-preserve absolute top-16 right-2 z-20 sm:right-10"
          >
            <p>Sync</p>
            <strong>Caught up</strong>
          </div>
          <div
            data-kpi
            className="landing-kpi-float landing-kpi-float-c landing-depth-preserve absolute bottom-24 left-4 z-20 sm:bottom-28 sm:left-16"
          >
            <p>Branches</p>
            <strong>Aligned</strong>
          </div>

          <div
            data-iso-device
            className="landing-iso-device landing-depth-preserve absolute top-1/2 left-1/2 z-10 w-[min(88%,340px)] -translate-x-1/2 -translate-y-1/2"
          >
            <div className="landing-iso-screen overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-[0_30px_70px_rgba(15,23,42,0.16)]">
              <div className="bg-[#111827] px-4 py-3 text-white">
                <p className="text-[10px] tracking-wide text-slate-400 uppercase">Checkout</p>
                <p className="mt-1 text-lg font-semibold">GH₵ 186.50</p>
              </div>
              <div className="space-y-2 p-4">
                <div className="h-2.5 w-3/4 rounded-full bg-slate-100" />
                <div className="h-2.5 w-1/2 rounded-full bg-slate-100" />
                <div className="bg-primary/15 mt-3 rounded-xl px-3 py-2 text-xs font-semibold text-[#0369A1]">
                  Ready to pay · Offline safe
                </div>
              </div>
            </div>
          </div>

          <div data-inventory-stack className="landing-inventory-stack absolute right-[8%] bottom-8 z-0 hidden sm:block">
            <span data-inventory-box className="landing-box landing-box-a" />
            <span data-inventory-box className="landing-box landing-box-b" />
            <span data-inventory-box className="landing-box landing-box-c" />
          </div>

          <div
            data-depth-panel
            className="landing-analytics-panel landing-depth-preserve absolute bottom-6 left-[6%] hidden w-44 rounded-2xl border border-white/80 bg-white/90 p-3 shadow-lg backdrop-blur md:block"
          >
            <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Analytics</p>
            <svg className="mt-2 h-12 w-full" viewBox="0 0 120 40" aria-hidden>
              <path
                d="M0 30 L20 26 L40 28 L60 16 L80 20 L100 8 L120 12"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
