import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { landingCopy } from "@/features/marketing/content";

/** Apps & downloads promo — anchors nav / hero secondary CTA to #desktop. */
export function LandingDesktop() {
  const { desktop } = landingCopy;

  return (
    <section
      id={desktop.id}
      className="scroll-mt-24 border-t border-border bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8"
    >
      <div
        data-reveal
        className="mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-3xl border border-slate-200/80 bg-white px-6 py-10 text-center sm:px-10 sm:py-12 lg:flex-row lg:text-left"
      >
        <div className="bg-primary/12 text-primary flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
          <MonitorSmartphone className="h-7 w-7" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
            {desktop.badge}
          </p>
          <h2 className="text-[#111827] mt-2 text-2xl font-semibold tracking-tight">
            {desktop.title}
          </h2>
          <p className="text-slate-600 mt-2 text-sm leading-relaxed sm:text-base">
            {desktop.detail}
          </p>
        </div>
        <Button asChild className="shrink-0 font-semibold">
          <Link href={desktop.href}>{desktop.cta}</Link>
        </Button>
      </div>
    </section>
  );
}
