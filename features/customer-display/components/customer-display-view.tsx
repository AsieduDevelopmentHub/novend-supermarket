"use client";

import { CheckCircle2, Package, Sparkles } from "lucide-react";
import { ProductImage } from "@/components/media/product-image";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { RECEIPT_VENDOR_FOOTER } from "@/constants/app";
import { BRAND_TAGLINE } from "@/constants/branding";
import { cn } from "@/lib/utils";
import { useCustomerDisplayState } from "@/features/customer-display/hooks/use-customer-display-state";
import type { CustomerDisplaySnapshot } from "@/lib/sales/customer-display";
import "@/features/customer-display/customer-display.css";

export function CustomerDisplayView() {
  const snapshot = useCustomerDisplayState();
  const { branding, phase } = snapshot;
  const isComplete = phase === "complete";
  const showCart = phase === "active" || phase === "processing";
  const showAside = showCart || isComplete;

  return (
    <div className="customer-display-ambient text-foreground relative h-dvh overflow-hidden">
      <div className="customer-display-mesh" aria-hidden>
        <div className="customer-display-mesh-blobs" />
        <div className="customer-display-mesh-blobs customer-display-mesh-blobs--alt" />
        <div className="customer-display-mesh-grid customer-display-mesh-grid--primary" />
        <div className="customer-display-mesh-grid customer-display-mesh-grid--diagonal" />
      </div>

      <div className="relative z-10 flex h-dvh min-h-0 flex-col">
        <header className="customer-display-fade-up flex w-full min-w-0 shrink-0 flex-nowrap items-baseline gap-3 overflow-hidden px-6 pt-4 pb-2 lg:gap-4 lg:px-10">
          <span className="text-primary shrink-0 text-[11px] font-semibold tracking-[0.14em] uppercase lg:text-xs">
            Welcome
          </span>
          <h1 className="min-w-0 truncate text-base font-bold tracking-tight lg:text-xl xl:text-2xl">
            {branding.tradeName}
          </h1>
          <p className="text-muted-foreground min-w-0 flex-1 truncate text-right text-xs lg:text-sm xl:text-base">
            {branding.branchName ?? BRAND_TAGLINE}
          </p>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-1 lg:flex-row lg:gap-5 lg:px-10 lg:py-3">
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <PhasePanel snapshot={snapshot} phase={phase} showCart={showCart} />
          </section>

          {showAside ? (
            <aside
              className={cn(
                "flex w-full shrink-0 flex-col",
                isComplete
                  ? "min-h-0 flex-1 lg:max-w-md lg:flex-none xl:max-w-lg"
                  : "lg:w-[22rem] xl:w-[26rem]",
              )}
            >
              {isComplete ? (
                <ReceiptShowcase snapshot={snapshot} />
              ) : (
                <TotalsPanel snapshot={snapshot} processing={phase === "processing"} />
              )}
            </aside>
          ) : null}
        </main>

        <footer className="text-muted-foreground shrink-0 px-6 py-3 text-center text-xs lg:px-10 lg:text-sm">
          {RECEIPT_VENDOR_FOOTER}
        </footer>
      </div>
    </div>
  );
}

function PhasePanel({
  snapshot,
  phase,
  showCart,
}: {
  snapshot: CustomerDisplaySnapshot;
  phase: CustomerDisplaySnapshot["phase"];
  showCart: boolean;
}) {
  if (phase === "idle") {
    return (
      <div
        key="idle"
        className="customer-display-phase-in flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <IdlePanel tradeName={snapshot.branding.tradeName} />
      </div>
    );
  }

  if (phase === "complete") {
    const receiptKey =
      snapshot.invoiceNumber ??
      (snapshot.completedAt != null ? String(snapshot.completedAt) : "complete");
    return (
      <div
        key={`complete-${receiptKey}`}
        className="customer-display-phase-in flex min-h-0 flex-1 flex-col"
      >
        <CompletePanel snapshot={snapshot} />
      </div>
    );
  }

  if (showCart) {
    return (
      <div key="active" className="customer-display-phase-in flex min-h-0 flex-1 flex-col">
        <CartPanel snapshot={snapshot} processing={phase === "processing"} />
      </div>
    );
  }

  return null;
}

function IdlePanel({ tradeName }: { tradeName: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10 text-center">
      <div className="relative">
        <span
          className="customer-display-pulse-ring bg-primary/20 absolute inset-0 rounded-full"
          aria-hidden
        />
        <span
          className="customer-display-pulse-ring bg-primary/10 absolute inset-0 rounded-full [animation-delay:0.9s]"
          aria-hidden
        />
        <div className="customer-display-glass customer-display-float relative flex h-24 w-24 items-center justify-center rounded-full">
          <Sparkles className="text-primary h-10 w-10" aria-hidden />
        </div>
      </div>

      <div className="customer-display-glass max-w-xl space-y-3 rounded-2xl px-8 py-6">
        <h2 className="text-3xl font-bold tracking-tight lg:text-5xl">Welcome to {tradeName}</h2>
        <p className="text-muted-foreground text-lg leading-relaxed lg:text-xl">
          Your order will appear here as items are added. Sit back — we&apos;ve got you.
        </p>
      </div>
    </div>
  );
}

/** Left column after Pay — thank-you / come-again with the paid total under it. */
function CompletePanel({ snapshot }: { snapshot: CustomerDisplaySnapshot }) {
  const thankYou = snapshot.branding.thankYouLine?.trim() || "Thank you for your purchase!";

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 py-6 text-center lg:px-6">
      <div className="customer-display-complete-pop customer-display-glass w-full max-w-2xl rounded-2xl px-6 py-8 lg:px-10 lg:py-12">
        <div className="text-success inline-flex items-center gap-2 rounded-full px-1 py-1">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          <span className="text-sm font-semibold tracking-wide">Payment complete</span>
        </div>
        <h2 className="mt-4 text-3xl font-bold tracking-tight lg:text-5xl xl:text-6xl">
          {thankYou}
        </h2>
        <p
          key={snapshot.total}
          className="customer-display-total-pop text-primary mt-6 text-4xl font-bold tabular-nums lg:text-5xl xl:text-6xl"
        >
          {formatCurrency(snapshot.total)}
        </p>
        {snapshot.invoiceNumber ? (
          <p className="text-muted-foreground mt-3 text-sm lg:text-base">
            Receipt · {snapshot.invoiceNumber}
            {snapshot.completedAt ? ` · ${formatDateTime(snapshot.completedAt)}` : null}
          </p>
        ) : null}
        {snapshot.paymentMethod ? (
          <p className="text-muted-foreground mt-1 text-sm capitalize lg:text-base">
            Paid · {snapshot.paymentMethod.replace(/_/g, " ")}
            {snapshot.customerName ? ` · ${snapshot.customerName}` : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Full-height receipt in the right column (replaces totals after Pay). */
function ReceiptShowcase({ snapshot }: { snapshot: CustomerDisplaySnapshot }) {
  const receiptKey =
    snapshot.invoiceNumber ??
    (snapshot.completedAt != null ? String(snapshot.completedAt) : "receipt");
  const paymentLabel = snapshot.paymentMethod
    ? snapshot.paymentMethod.replace(/_/g, " ")
    : null;

  return (
    <div
      key={receiptKey}
      className="customer-display-complete-pop customer-display-glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl"
    >
      <div className="border-border/50 shrink-0 space-y-1 border-b px-5 py-4 text-center lg:px-6 lg:py-5">
        <p className="text-lg font-bold tracking-tight lg:text-xl">
          {snapshot.branding.tradeName}
        </p>
        {snapshot.branding.branchName ? (
          <p className="text-muted-foreground text-xs lg:text-sm">{snapshot.branding.branchName}</p>
        ) : null}
        {snapshot.invoiceNumber ? (
          <p className="text-muted-foreground pt-1 text-xs lg:text-sm">
            {snapshot.invoiceNumber}
            {snapshot.completedAt ? ` · ${formatDateTime(snapshot.completedAt)}` : null}
          </p>
        ) : null}
      </div>

      <ul className="divide-border/40 min-h-0 flex-1 space-y-0 overflow-y-auto overscroll-contain px-5 py-2 lg:px-6">
        {snapshot.items.map((item) => {
          const lineTotal = Math.max(0, item.unitPrice * item.quantity - (item.discount || 0));
          return (
            <li
              key={item.productId}
              className="flex items-start justify-between gap-3 border-b border-dashed py-2.5 last:border-0"
            >
              <div className="min-w-0">
                <p className="font-medium lg:text-base">{item.name}</p>
                <p className="text-muted-foreground text-xs lg:text-sm">
                  {item.quantity} × {formatCurrency(item.unitPrice)}
                </p>
              </div>
              <p className="shrink-0 tabular-nums font-medium lg:text-base">
                {formatCurrency(lineTotal)}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="border-border/50 shrink-0 space-y-1.5 border-t px-5 py-4 lg:px-6 lg:py-5">
        <div className="text-muted-foreground flex justify-between text-sm">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatCurrency(snapshot.subtotal)}</span>
        </div>
        {snapshot.discount > 0 ? (
          <div className="text-muted-foreground flex justify-between text-sm">
            <span>Discount</span>
            <span className="tabular-nums">−{formatCurrency(snapshot.discount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-lg font-semibold lg:text-xl">
          <span>Total</span>
          <span className="text-primary tabular-nums">{formatCurrency(snapshot.total)}</span>
        </div>
        {paymentLabel ? (
          <p className="text-muted-foreground text-xs capitalize lg:text-sm">
            Paid · {paymentLabel}
            {snapshot.customerName ? ` · ${snapshot.customerName}` : null}
          </p>
        ) : null}
        <p className="text-muted-foreground pt-2 text-center text-[10px] lg:text-xs">
          {RECEIPT_VENDOR_FOOTER}
        </p>
      </div>
    </div>
  );
}

function CartPanel({
  snapshot,
  processing,
}: {
  snapshot: CustomerDisplaySnapshot;
  processing: boolean;
}) {
  const displayItems = snapshot.items.slice().reverse();

  return (
    <div className="customer-display-glass flex min-h-0 flex-1 flex-col rounded-2xl">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit]">
        <div className="border-border/40 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 lg:px-5 lg:py-4">
          <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Your order</h2>
          {processing ? (
            <span className="customer-display-glass customer-display-shimmer text-primary rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              <span className="relative z-[1]">Processing</span>
            </span>
          ) : (
            <span className="text-muted-foreground text-sm tabular-nums lg:text-base">
              {snapshot.itemCount} item{snapshot.itemCount === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {snapshot.customerName ? (
          <p className="text-muted-foreground shrink-0 px-4 pt-3 text-sm lg:px-5 lg:text-base">
            Customer · <span className="text-foreground font-medium">{snapshot.customerName}</span>
          </p>
        ) : null}

        <ul
          className={cn(
            "min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 lg:px-5 lg:py-4",
            snapshot.customerName ? "pt-2" : "",
          )}
        >
          {displayItems.map((item, index) => (
            <li
              key={`${item.productId}-${item.quantity}-${item.lineTotal}`}
              className="customer-display-item-in customer-display-glass customer-display-glass--nested rounded-xl p-3 lg:p-4"
              style={{ animationDelay: `${Math.min(index, 10) * 50}ms` }}
            >
              <div className="flex gap-3 lg:gap-4">
                <div className="bg-muted/50 relative h-14 w-14 shrink-0 overflow-hidden rounded-lg lg:h-16 lg:w-16">
                  <ProductImage
                    productId={item.productId}
                    remoteUrl={item.imageUrl}
                    alt=""
                    sizes="64px"
                    fallback={
                      <div className="text-muted-foreground flex h-full w-full items-center justify-center">
                        <Package className="h-5 w-5 lg:h-6 lg:w-6" aria-hidden />
                      </div>
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold lg:text-base">{item.name}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs tabular-nums lg:text-sm">
                    {formatCurrency(item.unitPrice)} × {item.quantity}
                  </p>
                  {item.discount > 0 ? (
                    <p className="text-success mt-0.5 text-xs tabular-nums lg:text-sm">
                      −{formatCurrency(item.discount)} discount
                    </p>
                  ) : null}
                </div>
                <p className="text-primary shrink-0 text-sm font-bold tabular-nums lg:text-base">
                  {formatCurrency(item.lineTotal)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TotalsPanel({
  snapshot,
  processing,
}: {
  snapshot: CustomerDisplaySnapshot;
  processing: boolean;
}) {
  const showDiscount = snapshot.discount > 0.001;

  return (
    <div className="customer-display-glass shrink-0 rounded-2xl p-5 lg:sticky lg:top-4 lg:p-6">
      <h2 className="text-lg font-semibold tracking-tight lg:text-xl">Summary</h2>

      <dl className="mt-4 space-y-2.5 text-sm lg:mt-5 lg:space-y-3 lg:text-base">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="font-medium tabular-nums">{formatCurrency(snapshot.subtotal)}</dd>
        </div>
        {showDiscount ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">
              Discount
              {snapshot.discountMode === "percent" && snapshot.discountField > 0
                ? ` (${snapshot.discountField}%)`
                : null}
            </dt>
            <dd className="text-success font-medium tabular-nums">
              −{formatCurrency(snapshot.discount)}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="border-border/40 my-4 border-t lg:my-5" />

      <div>
        <div className="flex items-end justify-between gap-4">
          <p className="text-base font-medium lg:text-lg">Total</p>
          <p
            key={`${snapshot.total}-${snapshot.updatedAt}`}
            className="customer-display-total-pop text-primary text-2xl font-bold tabular-nums lg:text-4xl"
          >
            {formatCurrency(snapshot.total)}
          </p>
        </div>
        {processing ? (
          <p className="text-warning mt-3 text-sm font-medium lg:text-base">
            Please wait while we finalize your order…
          </p>
        ) : snapshot.paymentMethod ? (
          <p className="text-muted-foreground mt-3 text-sm capitalize lg:text-base">
            Paid · {snapshot.paymentMethod.replace(/_/g, " ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
