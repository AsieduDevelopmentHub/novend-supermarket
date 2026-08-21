/** Isometric-style Novend POS stage — checkout, product grid, KPIs. */
export function LandingPosStage() {
  return (
    <div
      data-depth-stage
      className="landing-pos-stage landing-depth-preserve relative mx-auto w-full max-w-[440px]"
    >
      <div className="landing-pos-frame overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="text-muted-foreground ml-1 text-[11px] font-medium">Novend POS</span>
          <span className="bg-primary/15 text-primary ml-auto rounded-md px-2 py-0.5 text-[10px] font-semibold">
            Synced
          </span>
        </div>

        <div className="grid grid-cols-[56px_1fr_132px] sm:grid-cols-[64px_1fr_148px]">
          <aside className="bg-sidebar flex flex-col items-center gap-3 px-2 py-3">
            <span className="bg-primary h-8 w-8 rounded-lg" />
            <span className="h-7 w-7 rounded-md bg-white/10" />
            <span className="h-7 w-7 rounded-md bg-white/10" />
            <span className="h-7 w-7 rounded-md bg-white/10" />
            <span className="mt-auto h-7 w-7 rounded-full bg-white/15" />
          </aside>

          <div className="bg-background space-y-3 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-foreground text-xs font-semibold">Products</p>
              <span className="text-muted-foreground text-[10px]">Scan ready</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: "Panadol Extra", meta: "Pharmacy", price: "18.00" },
                { name: "Indomie carton", meta: "Wholesale", price: "145.00" },
                { name: "USB cable", meta: "Electronics", price: "35.00" },
                { name: "Ankara print", meta: "Fashion", price: "90.00" },
              ].map((item) => (
                <div
                  key={item.name}
                  className="border-border rounded-lg border bg-card p-2 shadow-sm"
                >
                  <div className="bg-primary/10 mb-2 h-8 rounded-md" />
                  <p className="text-foreground truncate text-[11px] font-medium">{item.name}</p>
                  <p className="text-muted-foreground text-[10px]">{item.meta}</p>
                  <p className="text-foreground mt-1 text-[11px] font-semibold tabular-nums">
                    GH₵ {item.price}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-border flex flex-col border-l bg-card p-2.5">
            <p className="text-foreground text-[11px] font-semibold">Checkout</p>
            <ul className="mt-2 flex-1 space-y-2">
              <li className="flex justify-between gap-1 text-[10px]">
                <span className="text-muted-foreground truncate">Panadol × 2</span>
                <span className="font-medium tabular-nums">36.00</span>
              </li>
              <li className="flex justify-between gap-1 text-[10px]">
                <span className="text-muted-foreground truncate">Indomie × 1</span>
                <span className="font-medium tabular-nums">145.00</span>
              </li>
              <li
                data-scan-line
                className="border-primary/30 bg-primary/10 flex justify-between gap-1 rounded-md border border-dashed px-1.5 py-1 text-[10px]"
              >
                <span className="text-primary truncate font-medium">Scan → USB cable</span>
                <span className="text-primary font-semibold tabular-nums">35.00</span>
              </li>
            </ul>
            <div className="border-border mt-2 border-t pt-2">
              <p className="text-muted-foreground text-[9px] tracking-wide uppercase">Total</p>
              <p className="text-foreground text-sm font-semibold tabular-nums tracking-tight">
                GH₵ 216.00
              </p>
              <div className="bg-primary text-primary-foreground mt-2 rounded-md py-1.5 text-center text-[10px] font-semibold">
                Take payment
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        data-kpi
        className="landing-float-kpi absolute -top-3 -right-2 z-20 hidden rounded-xl border border-border bg-card px-3 py-2 shadow-md sm:block"
      >
        <p className="text-muted-foreground text-[9px] tracking-wide uppercase">Today</p>
        <p className="text-foreground text-sm font-semibold tabular-nums">GH₵ 48,920</p>
        <svg className="mt-1 h-8 w-28" viewBox="0 0 112 28" aria-hidden>
          <path
            d="M0 22 L16 18 L32 20 L48 12 L64 14 L80 6 L96 9 L112 3"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div
        data-kpi
        className="landing-float-kpi absolute -bottom-2 -left-2 z-20 hidden rounded-xl border border-border bg-card px-3 py-2 shadow-md sm:block"
      >
        <p className="text-muted-foreground text-[9px] tracking-wide uppercase">Inventory</p>
        <p className="text-foreground text-sm font-semibold">1,842 units</p>
        <p className="text-muted-foreground text-[10px]">12 low-stock alerts</p>
      </div>
    </div>
  );
}
