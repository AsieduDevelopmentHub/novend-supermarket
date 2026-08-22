"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type RefObject } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BRANDING } from "@/constants/branding";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { landingCopy } from "@/features/marketing/content";
import { postLoginPath } from "@/lib/auth/post-login-path";

type Props = {
  scrollRootRef: RefObject<HTMLElement | null>;
};

/** Product-aligned sticky nav — same CTA language as login. */
export function LandingNav({ scrollRootRef }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const workspaceHref = isAuthenticated && me != null ? postLoginPath(me) : "/login";

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
          scrolled && "drop-shadow-md",
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
          <span className="text-foreground text-sm font-semibold tracking-tight">
            {landingCopy.brand}
          </span>
        </Link>

        <nav
          className="landing-shadow-nav border-border bg-card/95 hidden items-center gap-0.5 rounded-xl border px-1.5 py-1 backdrop-blur-md md:flex"
          aria-label="Primary"
        >
          {landingCopy.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-foreground/80 hover:text-foreground hover:bg-muted rounded-lg px-3.5 py-2 text-sm font-medium transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden h-9 font-semibold sm:inline-flex"
          >
            <Link href="/signup">Start trial</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="landing-shadow-cta-outline h-9 shrink-0 font-semibold transition-[box-shadow,transform] hover:-translate-y-0.5"
          >
            <Link href={workspaceHref}>{isAuthenticated ? "Open workspace" : "Login"}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
