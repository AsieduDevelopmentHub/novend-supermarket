import { type ReactNode } from "react";
import { landingCopy } from "@/features/marketing/content";

/** Operational journey — alternating step + visual (no sticky pin). */
export function LandingJourney() {
  return (
    <section
      id="journey"
      className="landing-journey scroll-mt-24 border-t border-border bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
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

        <div className="mt-12 space-y-14 sm:mt-16 sm:space-y-20 lg:space-y-28">
          {landingCopy.journey.steps.map((step, index) => {
            const reverse = index % 2 === 1;
            return (
              <article
                key={step.id}
                className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-16 ${
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
                  <JourneyVisual id={step.id} />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function JourneyVisual({ id }: { id: string }) {
  switch (id) {
    case "receive":
      return (
        <Panel>
          <FlowHeader from="Supplier" to="Receive desk" />
          <div data-inventory-stack className="landing-journey-stack relative mt-8 h-36">
            <div data-inventory-box className="landing-journey-box landing-journey-box-a">
              <span>GRN-2041</span>
              <strong>Rice 50kg × 40</strong>
            </div>
            <div data-inventory-box className="landing-journey-box landing-journey-box-b">
              <span>GRN-2041</span>
              <strong>Oil 5L × 60</strong>
            </div>
            <div data-inventory-box className="landing-journey-box landing-journey-box-c">
              <span>Reason</span>
              <strong>Supplier delivery</strong>
            </div>
          </div>
        </Panel>
      );
    case "warehouse":
      return (
        <Panel>
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
            Wholesale inventory
          </p>
          <p className="text-foreground mt-2 text-2xl font-semibold tracking-tight">2,140 units</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {["Rice 50kg", "Oil 5L", "Indomie", "Soap carton"].map((sku) => (
              <div key={sku} className="border-border rounded-xl border bg-background px-3 py-3">
                <p className="text-foreground text-sm font-medium">{sku}</p>
                <p className="text-muted-foreground mt-1 text-xs">In warehouse</p>
              </div>
            ))}
          </div>
        </Panel>
      );
    case "transfer":
      return (
        <Panel>
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Branch transfer</p>
          <div className="mt-4 grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-xl bg-[#111827] px-3 py-4 text-white">
              <p className="text-[10px] text-slate-400 uppercase">Warehouse</p>
              <p className="mt-1 text-sm font-semibold">−200 units</p>
            </div>
            <div className="landing-transfer-rail hidden sm:block" aria-hidden>
              <span data-transfer-dot />
              <span data-transfer-dot />
              <span data-transfer-dot />
            </div>
            <div className="space-y-2">
              <div className="border-border rounded-lg border bg-background px-3 py-2">
                <p className="text-muted-foreground text-[10px]">East Legon</p>
                <p className="text-foreground text-sm font-semibold">+120</p>
              </div>
              <div className="border-border rounded-lg border bg-background px-3 py-2">
                <p className="text-muted-foreground text-[10px]">Kumasi</p>
                <p className="text-foreground text-sm font-semibold">+80</p>
              </div>
            </div>
          </div>
        </Panel>
      );
    case "sell":
      return (
        <Panel className="overflow-hidden p-0">
          <div className="bg-[#111827] px-5 py-4 text-white">
            <div className="flex items-center justify-between">
              <p className="text-[10px] tracking-wide text-slate-400 uppercase">Current Sale</p>
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                Offline ready
              </span>
            </div>
            <p className="text-primary mt-3 text-2xl font-semibold tracking-tight tabular-nums">
              GH₵ 2,450.00
            </p>
          </div>
          <div className="space-y-3 p-5">
            <div
              data-scan-line
              className="border-primary/40 bg-primary/10 flex items-center justify-between rounded-lg border border-dashed px-3 py-2"
            >
              <span className="text-primary text-xs font-semibold">Barcode scan · SKU-88421</span>
              <span className="text-primary text-xs font-semibold tabular-nums">+145.00</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="bg-secondary text-secondary-foreground rounded-md py-2 text-center text-xs font-semibold">
                Hold
              </span>
              <span className="bg-primary text-primary-foreground rounded-md py-2 text-center text-xs font-semibold">
                Pay
              </span>
            </div>
          </div>
        </Panel>
      );
    case "local":
      return (
        <Panel>
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">On this device</p>
          <p className="text-foreground mt-2 text-lg font-semibold">Local database</p>
          <ul className="mt-5 space-y-2">
            {[
              { label: "Sale NV-10482", state: "Stored" },
              { label: "Receive GRN-2041", state: "Stored" },
              { label: "Transfer TR-91", state: "Stored" },
            ].map((row) => (
              <li
                key={row.label}
                className="border-border flex items-center justify-between rounded-lg border bg-background px-3 py-2.5 text-sm"
              >
                <span className="text-foreground font-medium">{row.label}</span>
                <span className="text-primary text-xs font-semibold">{row.state}</span>
              </li>
            ))}
          </ul>
        </Panel>
      );
    case "sync":
      return (
        <Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-[#111827] px-4 py-4 text-white">
              <p className="text-[10px] tracking-wide text-slate-400 uppercase">Outbox</p>
              <ul className="mt-3 space-y-2 text-xs">
                <li className="flex justify-between gap-2">
                  <span className="text-slate-300">Sale NV-10482</span>
                  <span className="text-primary">Syncing…</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-slate-300">Receive GRN-2041</span>
                  <span className="text-amber-300">Queued</span>
                </li>
              </ul>
            </div>
            <div className="border-border rounded-xl border bg-background px-4 py-4">
              <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Cloud</p>
              <p className="text-foreground mt-2 text-sm font-semibold">Synced to business view</p>
              <svg className="mt-4 h-14 w-full" viewBox="0 0 160 56" aria-hidden>
                <path
                  d="M0 44 L20 40 L40 42 L60 28 L80 32 L100 18 L120 22 L160 8"
                  fill="none"
                  stroke="#0EA5E9"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              <p className="text-muted-foreground mt-1 text-xs">Dashboard updated</p>
            </div>
          </div>
        </Panel>
      );
    default:
      return null;
  }
}

function Panel({
  children,
  className = "p-6",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-border bg-card landing-shadow-panel rounded-2xl border ${className}`}
    >
      {children}
    </div>
  );
}

function FlowHeader({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-muted-foreground text-[10px] tracking-wide uppercase">{from}</p>
        <p className="text-foreground text-sm font-semibold">Achimota Distributors</p>
      </div>
      <span className="text-muted-foreground text-xs">→</span>
      <div className="text-right">
        <p className="text-muted-foreground text-[10px] tracking-wide uppercase">{to}</p>
        <p className="text-foreground text-sm font-semibold">Wholesale</p>
      </div>
    </div>
  );
}
