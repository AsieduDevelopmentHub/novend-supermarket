"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode, type RefObject, forwardRef } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BRANDING } from "@/constants/branding";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { landingCopy } from "@/features/marketing/content";
import { postLoginPath } from "@/lib/auth/post-login-path";

type Props = {
  scrollRootRef: RefObject<HTMLElement | null>;
};

const NavHref = forwardRef<
  HTMLAnchorElement,
  {
    href: string;
    className?: string;
    onClick?: () => void;
    children: ReactNode;
  }
>(function NavHref({ href, className, onClick, children }, ref) {
  const isHash = href.includes("#");
  if (isHash) {
    return (
      <a ref={ref} href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link ref={ref} href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
});

const linkClass =
  "text-slate-600 hover:text-[#0F172A] rounded-full px-3 py-2 text-sm font-medium transition-colors";

function NavDropdown({
  label,
  items,
}: {
  label: string;
  items: ReadonlyArray<{ href: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={cn(linkClass, "inline-flex items-center gap-1 outline-none")}>
        {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[12.5rem]"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {items.map((item) => (
          <DropdownMenuItem
            key={`${item.label}-${item.href}`}
            onSelect={(event) => {
              event.preventDefault();
              setOpen(false);
              window.setTimeout(() => {
                window.location.assign(item.href);
              }, 0);
            }}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Compact sticky marketing header — Product / Industries / Pricing / Resources / Download. */
export function LandingNav({ scrollRootRef }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const signInHref = isAuthenticated && me != null ? postLoginPath(me) : "/login";
  const { nav } = landingCopy;

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;
    const onScroll = () => setScrolled((root.scrollTop ?? 0) > 24);
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [scrollRootRef]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div
        className={cn(
          "pointer-events-auto mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-3 py-2 transition-all duration-200 md:px-4",
          scrolled
            ? "rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl"
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
          <span className="text-sm font-semibold tracking-tight text-[#0F172A]">
            {landingCopy.brand}
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          <NavDropdown label={nav.product.label} items={nav.product.items} />
          <NavDropdown label={nav.industries.label} items={nav.industries.items} />
          <NavHref href={nav.pricing.href} className={linkClass}>
            {nav.pricing.label}
          </NavHref>
          <NavDropdown label={nav.resources.label} items={nav.resources.items} />
          <NavHref href={nav.desktop.href} className={linkClass}>
            {nav.desktop.label}
          </NavHref>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden h-9 rounded-full px-4 text-sm font-medium text-slate-700 sm:inline-flex"
          >
            <Link href={signInHref}>Sign in</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="hidden h-9 rounded-full px-4 text-sm font-semibold sm:inline-flex"
          >
            <Link href="/signup">{landingCopy.navTrialCta}</Link>
          </Button>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex h-dvh w-[min(100%,22rem)] flex-col gap-0 overflow-hidden p-0"
            >
              <SheetHeader className="border-border shrink-0 border-b px-6 py-4 pr-12 text-left">
                <SheetTitle className="text-left">{landingCopy.brand}</SheetTitle>
              </SheetHeader>
              <nav
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
                aria-label="Mobile"
              >
                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="product" className="border-border border-b-0">
                    <AccordionTrigger className="text-foreground hover:bg-muted rounded-lg px-3 py-3 text-sm font-medium hover:no-underline">
                      {nav.product.label}
                    </AccordionTrigger>
                    <AccordionContent className="pb-2">
                      <ul className="space-y-0.5 pl-1">
                        {nav.product.items.map((item) => (
                          <li key={`${item.label}-${item.href}`}>
                            <NavHref
                              href={item.href}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted block rounded-lg px-3 py-2.5 text-sm font-medium"
                              onClick={() => setMenuOpen(false)}
                            >
                              {item.label}
                            </NavHref>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="industries" className="border-border border-b-0">
                    <AccordionTrigger className="text-foreground hover:bg-muted rounded-lg px-3 py-3 text-sm font-medium hover:no-underline">
                      {nav.industries.label}
                    </AccordionTrigger>
                    <AccordionContent className="pb-2">
                      <ul className="space-y-0.5 pl-1">
                        {nav.industries.items.map((item) => (
                          <li key={item.label}>
                            <NavHref
                              href={item.href}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted block rounded-lg px-3 py-2.5 text-sm font-medium"
                              onClick={() => setMenuOpen(false)}
                            >
                              {item.label}
                            </NavHref>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <NavHref
                    href={nav.pricing.href}
                    className="text-foreground hover:bg-muted block rounded-lg px-3 py-3 text-sm font-medium"
                    onClick={() => setMenuOpen(false)}
                  >
                    {nav.pricing.label}
                  </NavHref>

                  <AccordionItem value="resources" className="border-border border-b-0">
                    <AccordionTrigger className="text-foreground hover:bg-muted rounded-lg px-3 py-3 text-sm font-medium hover:no-underline">
                      {nav.resources.label}
                    </AccordionTrigger>
                    <AccordionContent className="pb-2">
                      <ul className="space-y-0.5 pl-1">
                        {nav.resources.items.map((item) => (
                          <li key={item.label}>
                            <NavHref
                              href={item.href}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted block rounded-lg px-3 py-2.5 text-sm font-medium"
                              onClick={() => setMenuOpen(false)}
                            >
                              {item.label}
                            </NavHref>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <NavHref
                    href={nav.desktop.href}
                    className="text-foreground hover:bg-muted block rounded-lg px-3 py-3 text-sm font-medium"
                    onClick={() => setMenuOpen(false)}
                  >
                    {nav.desktop.label}
                  </NavHref>
                </Accordion>
              </nav>
              <div className="border-border bg-card shrink-0 space-y-2 border-t px-4 py-4">
                <Button asChild variant="outline" className="w-full">
                  <Link href={signInHref} onClick={() => setMenuOpen(false)}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild className="w-full">
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
