import Image from "next/image";
import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Undo2,
  Warehouse,
} from "lucide-react";
import { BRANDING } from "@/constants/branding";
import { formatCurrency } from "@/lib/currency";

/** Real app nav (collapsed rail) — mirrors `config/navigation` Sales-first set. */
const NAV = [
  { title: "Dashboard", Icon: LayoutDashboard, active: false },
  { title: "Sales", Icon: ShoppingCart, active: true },
  { title: "Orders", Icon: ClipboardList, active: false },
  { title: "Returns", Icon: Undo2, active: false },
  { title: "Inventory", Icon: Boxes, active: false },
  { title: "Wholesale", Icon: Warehouse, active: false },
  { title: "Products", Icon: Package, active: false },
] as const;

/**
 * Demo catalog shaped like live POS tiles (name + sellingPrice).
 * Images omitted → Package placeholder — same empty-image state as SalesView.
 */
const PRODUCTS = [
  { id: "p1", name: "Panadol Extra 500mg", sellingPrice: 18 },
  { id: "p2", name: "Indomie Chicken (Carton)", sellingPrice: 145 },
  { id: "p3", name: "Frytol Cooking Oil 5L", sellingPrice: 145 },
  { id: "p4", name: "Malta Guinness 330ml", sellingPrice: 12.5 },
  { id: "p5", name: "USB-C Cable 2m", sellingPrice: 35 },
  { id: "p6", name: "Ankara Print (Yard)", sellingPrice: 90 },
] as const;

const CART_LINES = [
  { name: "Panadol Extra 500mg", qty: 2, unit: 18, scanned: false },
  { name: "Indomie Chicken (Carton)", qty: 1, unit: 145, scanned: false },
  { name: "USB-C Cable 2m", qty: 1, unit: 35, scanned: true },
] as const;

const CART_TOTAL = CART_LINES.reduce((sum, line) => sum + line.qty * line.unit, 0);

/** Realistic Novend Sales shell — real nav icons, POS empty-image tiles, spaced KPI cards. */
export function LandingPosStage() {
  return (
    <div
      data-depth-stage
      className="landing-pos-stage landing-depth-preserve relative mx-auto w-full max-w-[560px]"
    >
      <div className="landing-pos-frame relative z-10 overflow-hidden rounded-2xl border border-border bg-background shadow-[0_28px_70px_rgba(15,23,42,0.16)]">
        <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="text-muted-foreground ml-1.5 text-[11px] font-medium">Sales</span>
          <span className="bg-primary/15 text-primary ml-auto rounded-md px-2 py-0.5 text-[10px] font-semibold">
            Synced
          </span>
        </div>

        <div className="grid grid-cols-[52px_minmax(0,1fr)_minmax(140px,168px)] sm:grid-cols-[60px_minmax(0,1fr)_minmax(156px,180px)]">
          <aside className="bg-sidebar flex flex-col items-center gap-1.5 px-1.5 py-3">
            <div className="relative mb-1.5 h-8 w-8 overflow-hidden rounded-lg">
              <Image src={BRANDING.brandmark} alt="" fill sizes="32px" className="object-contain" />
            </div>
            {NAV.map(({ title, Icon, active }) => (
              <span
                key={title}
                title={title}
                className={
                  active
                    ? "bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg"
                    : "flex h-8 w-8 items-center justify-center rounded-lg text-white/55"
                }
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="sr-only">{title}</span>
              </span>
            ))}
            <span
              title="Settings"
              className="mt-auto flex h-8 w-8 items-center justify-center rounded-lg text-white/45"
            >
              <Settings className="h-4 w-4" aria-hidden />
            </span>
          </aside>

          <div className="min-w-0 space-y-2.5 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-foreground text-xs font-semibold tracking-tight">Sales</h3>
              <span className="text-muted-foreground truncate text-[10px]">Main branch</span>
            </div>
            <div className="border-border bg-muted/50 text-muted-foreground h-7 rounded-md border px-2 text-[10px] leading-7">
              Search products…
            </div>
            <p className="text-foreground text-[10px] font-semibold tracking-tight">Quick Products</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {PRODUCTS.map((product) => (
                <div
                  key={product.id}
                  className="border-border hover:border-primary bg-card rounded-xl border p-1.5 text-left shadow-sm transition-colors sm:p-2"
                >
                  <div className="bg-muted relative mb-1.5 aspect-[4/3] overflow-hidden rounded-lg">
                    <Package className="text-muted-foreground absolute inset-0 m-auto h-6 w-6" />
                  </div>
                  <p className="text-foreground line-clamp-2 text-[10px] font-medium leading-tight">
                    {product.name}
                  </p>
                  <p className="text-primary mt-1 text-[10px] font-semibold tabular-nums">
                    {formatCurrency(product.sellingPrice)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-border flex flex-col border-l bg-card">
            <div className="border-border border-b bg-card/95 px-2.5 py-2">
              <p className="text-foreground flex items-center gap-1.5 text-[11px] font-semibold">
                <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
                Current Sale
              </p>
              <p className="text-muted-foreground mt-0.5 text-[9px]">Walk-in customer</p>
            </div>
            <ul className="flex-1 space-y-2 px-2.5 py-2">
              {CART_LINES.map((line) => (
                <li
                  key={line.name}
                  data-scan-line={line.scanned ? true : undefined}
                  className={
                    line.scanned
                      ? "border-primary/35 bg-primary/10 rounded-md border border-dashed px-1.5 py-1 text-[10px]"
                      : "text-[10px]"
                  }
                >
                  <div className="flex justify-between gap-1">
                    <span
                      className={
                        line.scanned
                          ? "text-primary truncate font-medium"
                          : "text-foreground truncate font-medium"
                      }
                    >
                      {line.name}
                    </span>
                    <span
                      className={
                        line.scanned ? "text-primary font-semibold tabular-nums" : "tabular-nums"
                      }
                    >
                      {formatCurrency(line.qty * line.unit)}
                    </span>
                  </div>
                  <p className={line.scanned ? "text-primary/80" : "text-muted-foreground"}>
                    {line.scanned
                      ? "Just scanned"
                      : `${line.qty} × ${formatCurrency(line.unit)}`}
                  </p>
                </li>
              ))}
            </ul>
            <div className="border-border mt-auto space-y-1 border-t px-2.5 py-2">
              <div className="text-muted-foreground flex justify-between text-[9px]">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(CART_TOTAL)}</span>
              </div>
              <div className="text-muted-foreground flex justify-between text-[9px]">
                <span>Discount</span>
                <span className="tabular-nums">{formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-semibold">
                <span>Total</span>
                <span className="text-primary tabular-nums">{formatCurrency(CART_TOTAL)}</span>
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
        className="landing-float-kpi border-border bg-card absolute top-2 right-2 z-20 hidden rounded-xl border px-3.5 py-2.5 shadow-md sm:block lg:top-0 lg:right-0 lg:translate-x-[28%] lg:-translate-y-[22%]"
      >
        <p className="text-muted-foreground text-[9px]">Today&apos;s sales</p>
        <p className="text-foreground text-sm font-semibold tabular-nums">
          {formatCurrency(48920)}
        </p>
      </div>
      <div
        data-kpi
        className="landing-float-kpi border-border bg-card absolute bottom-2 left-2 z-20 hidden rounded-xl border px-3.5 py-2.5 shadow-md sm:block lg:bottom-0 lg:left-0 lg:-translate-x-[24%] lg:translate-y-[28%]"
      >
        <p className="text-muted-foreground text-[9px]">Low stock</p>
        <p className="text-foreground text-sm font-semibold">12 alerts</p>
      </div>
    </div>
  );
}
