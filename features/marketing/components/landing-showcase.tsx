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

        <div className="landing-perspective relative mt-16 min-h-[460px] sm:min-h-[520px]">
          <div
            data-kpi
            className="landing-kpi-float landing-depth-preserve absolute top-2 left-1 z-20 sm:top-4 sm:left-6"
          >
            <p>Today’s revenue</p>
            <strong>GH₵ 48,920</strong>
            <span className="landing-kpi-meta">+12.4% vs yesterday</span>
          </div>
          <div
            data-kpi
            className="landing-kpi-float landing-depth-preserve absolute top-14 right-1 z-20 sm:top-16 sm:right-8"
          >
            <p>Sync status</p>
            <strong>All caught up</strong>
            <span className="landing-kpi-meta">Outbox empty · 0 pending</span>
          </div>
          <div
            data-kpi
            className="landing-kpi-float landing-depth-preserve absolute bottom-28 left-2 z-20 sm:bottom-32 sm:left-10"
          >
            <p>Active branches</p>
            <strong>6 of 6 online</strong>
            <span className="landing-kpi-meta">Warehouse + retail</span>
          </div>

          <div
            data-iso-device
            className="landing-iso-device landing-depth-preserve absolute top-1/2 left-1/2 z-10 w-[min(92%,380px)] -translate-x-1/2 -translate-y-1/2"
          >
            <div className="landing-iso-screen overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_36px_80px_rgba(15,23,42,0.18)]">
              <div className="bg-[#0B1220] px-5 py-4 text-white">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] tracking-[0.16em] text-slate-400 uppercase">
                    Sale · Counter 02
                  </p>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-300 uppercase">
                    Offline ready
                  </span>
                </div>
                <p className="mt-3 text-[11px] tracking-wide text-slate-400 uppercase">Total due</p>
                <p className="landing-iso-total mt-1 tabular-nums">GH₵ 2,450.00</p>
              </div>
              <ul className="divide-y divide-slate-100 px-5 py-1">
                <li className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="text-foreground text-sm font-medium">Premium rice · 50kg</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">2 cartons × GH₵ 780.00</p>
                  </div>
                  <p className="text-foreground text-sm font-semibold tabular-nums">1,560.00</p>
                </li>
                <li className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="text-foreground text-sm font-medium">Cooking oil · 5L</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">4 packs × GH₵ 145.00</p>
                  </div>
                  <p className="text-foreground text-sm font-semibold tabular-nums">580.00</p>
                </li>
                <li className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="text-foreground text-sm font-medium">Wholesale discount</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">Manager override · 5%</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-emerald-600">−310.00</p>
                </li>
              </ul>
              <div className="border-t border-slate-100 px-5 py-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Payment</span>
                  <span className="text-foreground font-medium">Mobile money · MoMo</span>
                </div>
                <div className="bg-primary/12 mt-3 rounded-xl px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-[#0369A1]">
                  Ready to settle · Inventory reserved
                </div>
              </div>
            </div>
          </div>

          <div
            data-inventory-stack
            className="landing-inventory-stack absolute right-[4%] bottom-10 z-0 hidden w-[148px] sm:block"
          >
            <div data-inventory-box className="landing-box landing-box-a">
              <span>Warehouse</span>
              <strong>214 SKUs</strong>
            </div>
            <div data-inventory-box className="landing-box landing-box-b">
              <span>Branch stock</span>
              <strong>1,842 units</strong>
            </div>
            <div data-inventory-box className="landing-box landing-box-c">
              <span>Low stock</span>
              <strong>12 alerts</strong>
            </div>
          </div>

          <div
            data-depth-panel
            className="landing-analytics-panel landing-depth-preserve absolute bottom-6 left-[4%] hidden w-52 rounded-2xl border border-white/80 bg-white/95 p-4 shadow-lg backdrop-blur md:block"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-[10px] tracking-[0.14em] uppercase">
                Week trend
              </p>
              <p className="text-[10px] font-semibold text-emerald-600">+8.2%</p>
            </div>
            <p className="text-foreground mt-1 text-lg font-semibold tabular-nums tracking-tight">
              GH₵ 312k
            </p>
            <svg className="mt-3 h-14 w-full" viewBox="0 0 140 48" aria-hidden>
              <defs>
                <linearGradient id="landing-chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 36 L18 32 L36 34 L54 24 L72 28 L90 16 L108 20 L140 10 L140 48 L0 48 Z"
                fill="url(#landing-chart-fill)"
              />
              <path
                d="M0 36 L18 32 L36 34 L54 24 L72 28 L90 16 L108 20 L140 10"
                fill="none"
                stroke="#0EA5E9"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-muted-foreground mt-1 text-[11px]">Across all branches this week</p>
          </div>
        </div>
      </div>
    </section>
  );
}
