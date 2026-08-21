import { landingCopy } from "@/features/marketing/content";

/** Story scroll — receive → restock → sell → sync with product visuals. */
export function LandingJourney() {
  return (
    <section
      id="journey"
      className="landing-journey scroll-mt-24 border-t border-border px-4 py-24 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-primary text-sm font-semibold tracking-wide">
            {landingCopy.journey.eyebrow}
          </p>
          <h2 className="text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {landingCopy.journey.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base text-pretty sm:text-lg">
            {landingCopy.journey.subtitle}
          </p>
        </div>

        <div className="mt-16 space-y-20 lg:space-y-28">
          {landingCopy.journey.steps.map((step, index) => {
            const reverse = index % 2 === 1;
            return (
              <article
                key={step.id}
                className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                  reverse ? "lg:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div data-reveal>
                  <p className="text-primary text-xs font-bold tracking-[0.18em] uppercase">
                    Step {step.step}
                  </p>
                  <h3 className="text-foreground mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground mt-4 max-w-md text-base leading-relaxed">
                    {step.detail}
                  </p>
                </div>
                <div data-depth-panel className="landing-depth-preserve">
                  {step.visual === "receive" ? <ReceiveVisual /> : null}
                  {step.visual === "restock" ? <RestockVisual /> : null}
                  {step.visual === "sell" ? <SellVisual /> : null}
                  {step.visual === "sync" ? <SyncVisual /> : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ReceiveVisual() {
  return (
    <div className="border-border bg-card relative overflow-hidden rounded-2xl border p-6 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Supplier</p>
          <p className="text-foreground text-sm font-semibold">Achimota Distributors</p>
        </div>
        <span className="text-muted-foreground text-xs">→</span>
        <div className="text-right">
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Warehouse</p>
          <p className="text-foreground text-sm font-semibold">Wholesale stock</p>
        </div>
      </div>
      <div data-inventory-stack className="landing-journey-stack relative mt-8 h-36">
        <div data-inventory-box className="landing-journey-box landing-journey-box-a">
          <span>Receive</span>
          <strong>Rice 50kg × 40</strong>
        </div>
        <div data-inventory-box className="landing-journey-box landing-journey-box-b">
          <span>Receive</span>
          <strong>Oil 5L × 60</strong>
        </div>
        <div data-inventory-box className="landing-journey-box landing-journey-box-c">
          <span>Reason</span>
          <strong>Supplier GRN-2041</strong>
        </div>
      </div>
    </div>
  );
}

function RestockVisual() {
  return (
    <div className="border-border bg-card relative overflow-hidden rounded-2xl border p-6 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
      <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Branch transfer</p>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="rounded-xl bg-[#111827] px-3 py-4 text-white">
          <p className="text-[10px] text-slate-400 uppercase">Warehouse</p>
          <p className="mt-1 text-sm font-semibold">2,140 units</p>
        </div>
        <div className="landing-transfer-rail" aria-hidden>
          <span data-transfer-dot />
          <span data-transfer-dot />
          <span data-transfer-dot />
        </div>
        <div className="space-y-2">
          <div className="border-border rounded-lg border bg-background px-3 py-2">
            <p className="text-[10px] text-muted-foreground">East Legon retail</p>
            <p className="text-foreground text-sm font-semibold">+120 units</p>
          </div>
          <div className="border-border rounded-lg border bg-background px-3 py-2">
            <p className="text-[10px] text-muted-foreground">Kumasi wholesale</p>
            <p className="text-foreground text-sm font-semibold">+80 units</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SellVisual() {
  return (
    <div className="border-border bg-card relative overflow-hidden rounded-2xl border shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
      <div className="bg-[#111827] px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-wide text-slate-400 uppercase">Checkout · Counter 02</p>
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            Offline ready
          </span>
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">GH₵ 2,450.00</p>
      </div>
      <div className="space-y-3 p-5">
        <div
          data-scan-line
          className="border-primary/40 bg-primary/10 flex items-center justify-between rounded-lg border border-dashed px-3 py-2"
        >
          <span className="text-primary text-xs font-semibold">Barcode scan · SKU-88421</span>
          <span className="text-primary text-xs font-semibold tabular-nums">+145.00</span>
        </div>
        <div
          data-receipt
          className="landing-receipt border-border rounded-lg border border-dashed bg-background px-4 py-3"
        >
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Thermal receipt</p>
          <p className="text-foreground mt-1 text-sm font-semibold">Sale #NV-10482</p>
          <p className="text-muted-foreground mt-1 text-xs">MoMo · Printed · Inventory reserved</p>
        </div>
      </div>
    </div>
  );
}

function SyncVisual() {
  return (
    <div className="border-border bg-card relative overflow-hidden rounded-2xl border p-6 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-[#111827] px-4 py-4 text-white">
          <p className="text-[10px] tracking-wide text-slate-400 uppercase">Outbox</p>
          <ul className="mt-3 space-y-2 text-xs">
            <li data-outbox-item className="flex justify-between gap-2">
              <span className="text-slate-300">Sale NV-10482</span>
              <span className="text-amber-300">Queued</span>
            </li>
            <li data-outbox-item className="flex justify-between gap-2">
              <span className="text-slate-300">Receive GRN-2041</span>
              <span className="text-amber-300">Queued</span>
            </li>
            <li data-outbox-item className="flex justify-between gap-2">
              <span className="text-slate-300">Transfer TR-91</span>
              <span className="text-primary">Syncing…</span>
            </li>
          </ul>
        </div>
        <div className="border-border rounded-xl border bg-background px-4 py-4">
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Cloud truth</p>
          <p className="text-foreground mt-2 text-sm font-semibold">Convex committed</p>
          <div data-chart-grow className="mt-4 h-16">
            <svg className="h-full w-full" viewBox="0 0 160 56" aria-hidden>
              <path
                data-chart-fill
                d="M0 44 L20 40 L40 42 L60 28 L80 32 L100 18 L120 22 L160 8 L160 56 L0 56 Z"
                fill="url(#landingSyncFill)"
                opacity="0.9"
              />
              <defs>
                <linearGradient id="landingSyncFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                data-chart-line
                d="M0 44 L20 40 L40 42 L60 28 L80 32 L100 18 L120 22 L160 8"
                fill="none"
                stroke="#0EA5E9"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">All branches aligned</p>
        </div>
      </div>
    </div>
  );
}
