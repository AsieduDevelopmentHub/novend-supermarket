"use client";

import { useRef, type ReactNode } from "react";
import { LandingNav } from "@/features/marketing/components/landing-nav";
import { LandingFooter } from "@/features/marketing/components/landing-footer";

/** Shared public marketing chrome for docs/legal pages (matches landing scroll + footer). */
export function MarketingSiteShell({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={scrollRef}
      className="marketing-forced-light bg-[#F8FAFC] text-foreground h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain"
    >
      <LandingNav scrollRootRef={scrollRef} />
      <main className="min-h-[70dvh] pt-24 pb-4 sm:pt-28">{children}</main>
      <LandingFooter />
    </div>
  );
}
