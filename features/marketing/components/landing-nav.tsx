"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type RefObject } from "react";
import { BRANDING } from "@/constants/branding";
import { cn } from "@/lib/utils";
import { landingCopy } from "@/features/marketing/content";

type Props = {
  scrollRootRef: RefObject<HTMLElement | null>;
};

/** Vital-Go-style floating pill nav — Novend palette. */
export function LandingNav({ scrollRootRef }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;
    function onScroll() {
      setScrolled((root?.scrollTop ?? 0) > 12);
    }
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [scrollRootRef]);

  return (
    <header className="pointer-events-none sticky top-0 z-40 px-4 pt-4 sm:px-6 lg:px-8">
      <div
        className={cn(
          "pointer-events-auto mx-auto flex max-w-6xl items-center justify-between gap-3 transition-all",
          scrolled && "drop-shadow-sm",
        )}
      >
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image
            src={BRANDING.brandmark}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
            priority
          />
          <span className="text-foreground text-sm font-bold tracking-[0.08em] uppercase">
            {landingCopy.brand}
          </span>
        </Link>

        <nav
          className="border-border/70 bg-white/90 hidden items-center gap-1 rounded-full border px-2 py-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-md md:flex"
          aria-label="Primary"
        >
          {landingCopy.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-foreground/80 hover:text-foreground hover:bg-muted rounded-full px-4 py-2 text-sm font-medium transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <Link href="/login" className="landing-pill-btn landing-pill-btn-outline shrink-0">
          Login
        </Link>
      </div>
    </header>
  );
}
