"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { Menu } from "lucide-react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BRANDING } from "@/constants/branding";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { landingCopy } from "@/features/marketing/content";
import { postLoginPath } from "@/lib/auth/post-login-path";

type Props = {
  scrollRootRef: RefObject<HTMLElement | null>;
};

function NavHref({
  href,
  className,
  onClick,
  children,
}: {
  href: string;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const isHash = href.includes("#");
  if (isHash) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

/** Floating pill nav — transparent until 40px scroll, then glass (Linear / Stripe style). */
export function LandingNav({ scrollRootRef }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const signInHref = isAuthenticated && me != null ? postLoginPath(me) : "/login";

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;
    const onScroll = () => setScrolled((root.scrollTop ?? 0) > 40);
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [scrollRootRef]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <div
        className={cn(
          "pointer-events-auto mx-auto flex w-full max-w-[92%] items-center justify-between gap-3 px-3 py-2.5 transition-all duration-300 md:px-5",
          scrolled
            ? "landing-v2-nav-glass rounded-full border border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl"
            : "border border-transparent bg-transparent",
        )}
      >
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image
            src={BRANDING.brandmark}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            priority
          />
          <span className="text-[#111827] text-sm font-semibold tracking-tight">
            {landingCopy.brand}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {landingCopy.nav.map((item) => (
            <NavHref
              key={item.href}
              href={item.href}
              className="text-slate-600 hover:text-[#111827] rounded-full px-3.5 py-2 text-sm font-medium transition-colors"
            >
              {item.label}
            </NavHref>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden h-9 text-sm font-semibold sm:inline-flex"
          >
            <Link href="/docs/help">Help</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden h-9 text-sm font-semibold sm:inline-flex"
          >
            <Link href={signInHref}>Sign In</Link>
          </Button>
          <Button asChild size="sm" className="hidden h-9 text-sm font-semibold sm:inline-flex">
            <Link href="/signup">{landingCopy.navTrialCta}</Link>
          </Button>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100%,20rem)]">
              <SheetHeader>
                <SheetTitle className="text-left">{landingCopy.brand}</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile">
                <p className="text-muted-foreground px-3 pb-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
                  Product
                </p>
                {landingCopy.nav.map((item) => (
                  <NavHref
                    key={item.href}
                    href={item.href}
                    className="text-foreground rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </NavHref>
                ))}
                <p className="text-muted-foreground mt-4 px-3 pb-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
                  Resources
                </p>
                {landingCopy.navResources.map((item) => (
                  <NavHref
                    key={item.href}
                    href={item.href}
                    className="text-foreground rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </NavHref>
                ))}
              </nav>
              <div className="mt-6 flex flex-col gap-2">
                <Button asChild variant="outline">
                  <Link href={signInHref} onClick={() => setMenuOpen(false)}>
                    Sign In
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/signup" onClick={() => setMenuOpen(false)}>
                    {landingCopy.navTrialCta}
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
