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

/** Floating glass nav — transparent until 40px scroll. */
export function LandingNav({ scrollRootRef }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const workspaceHref = isAuthenticated && me != null ? postLoginPath(me) : "/login";

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;
    function onScroll() {
      setScrolled((root?.scrollTop ?? 0) > 40);
    }
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [scrollRootRef]);

  return (
    <header className="pointer-events-none sticky top-0 z-40 px-4 pt-4 sm:px-6 lg:px-8">
      <div
        className={cn(
          "pointer-events-auto mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-2xl px-3 py-2 transition-all duration-300",
          scrolled
            ? "landing-nav-glass border-border border shadow-sm backdrop-blur-xl"
            : "border border-transparent bg-transparent",
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
          className="hidden items-center gap-0.5 md:flex"
          aria-label="Primary"
        >
          {landingCopy.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-foreground/80 hover:text-foreground hover:bg-muted/80 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors"
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
            <Link href={workspaceHref}>Sign In</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="landing-shadow-cta-primary h-9 shrink-0 font-semibold transition-[box-shadow,transform] hover:-translate-y-0.5"
          >
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
