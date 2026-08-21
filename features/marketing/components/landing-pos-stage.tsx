/** Realistic Novend Sales UI mock — sidebar shell + product grid + Current Sale cart. */
export function LandingPosStage() {
  const products = [
    { name: "Panadol Extra", price: "18.00" },
    { name: "Indomie carton", price: "145.00" },
    { name: "USB cable 2m", price: "35.00" },
    { name: "Ankara print", price: "90.00" },
    { name: "Malta Guinness", price: "12.50" },
    { name: "Cooking oil 5L", price: "145.00" },
  ] as const;

  return (
    <div
      data-depth-stage
      className="landing-pos-stage landing-depth-preserve relative mx-auto w-full max-w-[520px]"
    >
      <div className="landing-pos-frame overflow-hidden rounded-2xl border border-border bg-background shadow-[0_28px_70px_rgba(15,23,42,0.16)]">
        <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="text-muted-foreground ml-1.5 text-[11px] font-medium">Sales</span>
          <span className="bg-primary/15 text-primary ml-auto rounded-md px-2 py-0.5 text-[10px] font-semibold">
            Synced
          </span>
        </div>

        <div className="grid grid-cols-[52px_minmax(0,1fr)_minmax(132px,158px)] sm:grid-cols-[60px_minmax(0,1fr)_minmax(150px,176px)]">
          <aside className="bg-sidebar flex flex-col items-center gap-2.5 px-1.5 py-3">
            <span className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold">
              N
            </span>
            <span className="bg-primary/25 h-7 w-7 rounded-md" title="Sales" />
            <span className="h-7 w-7 rounded-md bg-white/10" />
            <span className="h-7 w-7 rounded-md bg-white/10" />
            <span className="h-7 w-7 rounded-md bg-white/10" />
            <span className="mt-auto h-7 w-7 rounded-full bg-white/15" />
          </aside>

          <div className="min-w-0 space-y-2.5 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-foreground text-xs font-semibold tracking-tight">Sales</h3>
              <span className="text-muted-foreground truncate text-[10px]">Main branch</span>
            </div>
            <div className="border-border bg-muted/50 h-7 rounded-md border px-2 text-[10px] leading-7 text-slate-400">
              Search products or scan…
            </div>
            <p className="text-foreground text-[10px] font-semibold">Quick Products</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {products.map((item) => (
                <div
                  key={item.name}
                  className="border-border hover:border-primary bg-card rounded-xl border p-1.5 shadow-sm transition-colors"
                >
                  <div className="bg-muted mb-1.5 aspect-[4/3] rounded-lg" />
                  <p className="text-foreground truncate text-[10px] font-medium leading-tight">
                    {item.name}
                  </p>
                  <p className="text-primary mt-0.5 text-[10px] font-semibold tabular-nums">
                    GH₵ {item.price}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-border flex flex-col border-l bg-card">
            <div className="border-border sticky top-0 border-b bg-card/95 px-2.5 py-2 backdrop-blur">
              <p className="text-foreground text-[11px] font-semibold">Current Sale</p>
              <p className="text-muted-foreground text-[9px]">Walk-in customer</p>
            </div>
            <ul className="flex-1 space-y-2 px-2.5 py-2">
              <li className="text-[10px]">
                <div className="flex justify-between gap-1">
                  <span className="text-foreground truncate font-medium">Panadol Extra</span>
                  <span className="tabular-nums">36.00</span>
                </div>
                <p className="text-muted-foreground">2 × 18.00</p>
              </li>
              <li className="text-[10px]">
                <div className="flex justify-between gap-1">
                  <span className="text-foreground truncate font-medium">Indomie carton</span>
                  <span className="tabular-nums">145.00</span>
                </div>
                <p className="text-muted-foreground">1 × 145.00</p>
              </li>
              <li data-scan-line className="border-primary/35 bg-primary/10 rounded-md border border-dashed px-1.5 py-1 text-[10px]">
                <div className="text-primary flex justify-between gap-1 font-medium">
                  <span className="truncate">USB cable 2m</span>
                  <span className="tabular-nums">35.00</span>
                </div>
                <p className="text-primary/80">Just scanned</p>
              </li>
            </ul>
            <div className="border-border mt-auto space-y-1 border-t px-2.5 py-2">
              <div className="text-muted-foreground flex justify-between text-[9px]">
                <span>Subtotal</span>
                <span className="tabular-nums">216.00</span>
              </div>
              <div className="text-muted-foreground flex justify-between text-[9px]">
                <span>Discount</span>
                <span className="tabular-nums">0.00</span>
              </div>
              <div className="flex justify-between text-[11px] font-semibold">
                <span>Total</span>
                <span className="text-primary tabular-nums">GH₵ 216.00</span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                <span className="bg-secondary text-secondary-foreground rounded-md py-1.5 text-center text-[9px] font-semibold">
                  Hold
                </span>
                <span className="bg-primary text-primary-foreground rounded-md py-1.5 text-center text-[9px] font-semibold">
                  Pay
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        data-kpi
        className="border-border bg-card absolute -top-3 -right-1 z-20 hidden rounded-xl border px-3 py-2 shadow-md sm:block"
      >
        <p className="text-muted-foreground text-[9px]">Today&apos;s sales</p>
        <p className="text-foreground text-sm font-semibold tabular-nums">GH₵ 48,920</p>
      </div>
      <div
        data-kpi
        className="border-border bg-card absolute -bottom-2 -left-1 z-20 hidden rounded-xl border px-3 py-2 shadow-md sm:block"
      >
        <p className="text-muted-foreground text-[9px]">Low stock</p>
        <p className="text-foreground text-sm font-semibold">12 alerts</p>
      </div>
    </div>
  );
}
