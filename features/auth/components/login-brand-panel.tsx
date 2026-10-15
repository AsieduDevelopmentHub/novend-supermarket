import Image from "next/image";
import { APP_BRAND, APP_TAGLINE } from "@/constants/app";
import { BRANDING } from "@/constants/branding";
import { cn } from "@/lib/utils";

type Props = {
  /** Mobile: shorter hero under overlapping form; desktop: full brand rail. */
  variant?: "desktop" | "mobile";
  /** Millie's: solid brand rail without chart dots / radial circle washes. */
  plain?: boolean;
  className?: string;
};

/** Brand rail for the sign-in sheet. */
export function LoginBrandPanel({ variant = "desktop", plain = false, className }: Props) {
  const isMobile = variant === "mobile";

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#0b1220] text-white",
        !isMobile && "min-h-full",
        className,
      )}
    >
      {!plain ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            aria-hidden
            style={{
              background: isMobile
                ? "radial-gradient(ellipse 90% 70% at 50% 100%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 10%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 50%)"
                : "radial-gradient(ellipse 80% 60% at 20% 90%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 10%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 50%)",
            }}
          />
          <div className="login-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        </>
      ) : (
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "linear-gradient(160deg, color-mix(in oklab, var(--primary) 18%, #0b1220) 0%, #0b1220 55%)",
          }}
        />
      )}

      <div
        className={cn(
          "relative z-10 flex h-full flex-col",
          isMobile ? "justify-between p-6 pb-14" : "p-8 lg:p-10",
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("relative shrink-0", isMobile ? "h-10 w-10" : "h-12 w-12")}>
            <Image
              src={BRANDING.brandmark}
              alt=""
              fill
              sizes="48px"
              unoptimized
              className="object-contain"
            />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.28em] uppercase">{APP_BRAND}</p>
            <p className="text-xs text-white/55">{APP_TAGLINE}</p>
          </div>
        </div>

        {isMobile ? (
          <div>
            <p className="text-xl font-semibold tracking-tight">Built for the counter.</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/65">
              {plain
                ? "Fast checkout and live stock on this till — no cloud required."
                : "Fast checkout, live stock, and sync when you reconnect."}
            </p>
          </div>
        ) : (
          <div className="mt-8 flex flex-1 flex-col justify-center">
            <p className="text-3xl font-semibold tracking-tight lg:text-4xl">
              Built for the counter.
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">
              {plain
                ? "Fast checkout, live stock, and receipts — all on this machine."
                : "Fast checkout, live stock, and a warehouse that feeds every branch."}
            </p>
            {!plain ? <CommerceChart className="mt-8 h-40" /> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function CommerceChart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 140" className={cn("login-chart w-full", className)} aria-hidden>
      <defs>
        <linearGradient id="novendChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        className="login-chart-fill"
        d="M8 118 L48 102 L92 108 L132 78 L172 86 L214 48 L258 56 L312 22 L312 132 L8 132 Z"
        fill="url(#novendChartFill)"
      />
      <path
        className="login-chart-line"
        d="M8 118 L48 102 L92 108 L132 78 L172 86 L214 48 L258 56 L312 22"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="login-chart-dot" cx="214" cy="48" r="4" fill="var(--primary)" />
      <circle
        className="login-chart-dot login-chart-dot-delay"
        cx="312"
        cy="22"
        r="4.5"
        fill="color-mix(in oklab, var(--primary) 55%, white)"
      />
    </svg>
  );
}
