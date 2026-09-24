"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { BRANDING } from "@/constants/branding";
import { landingCopy } from "@/features/marketing/content";
import { openCookiePreferences } from "@/lib/cookies/consent";
import { cn } from "@/lib/utils";

/** Four-column marketing footer: Product, Industries, Resources, Legal. */
export function LandingFooter() {
  const year = new Date().getFullYear();
  const { footer } = landingCopy;
  const { contact } = footer;

  return (
    <footer className="bg-[#0B1220] text-slate-300">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between lg:gap-12">
          <div className="max-w-sm space-y-4">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src={BRANDING.logoHorizontalLight}
                alt="Novend"
                width={140}
                height={32}
                className="h-7 w-auto object-contain"
              />
            </Link>
            <p className="text-sm font-medium tracking-tight text-white">{footer.brandTitle}</p>
            <p className="text-sm leading-relaxed text-slate-400">{footer.description}</p>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-4">
            <FooterColumn title="Product" links={footer.product} />
            <FooterColumn title="Industries" links={footer.industries} />
            <FooterColumn title="Resources" links={footer.resources} />
            <FooterColumn title="Legal" links={footer.legal} />
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
            {contact.title}
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            <ContactItem
              icon={Mail}
              label={contact.email.label}
              value={contact.email.value}
              href={contact.email.href}
            />
            <ContactItem
              icon={MessageCircle}
              label={contact.international.label}
              value={contact.international.value}
              href={contact.international.href}
            />
            <ContactItem
              icon={Phone}
              label={contact.local.label}
              value={contact.local.value}
              href={contact.local.href}
              secondaryHref="https://wa.me/233555257482"
              secondaryLabel="WhatsApp"
            />
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-5 text-center text-xs text-slate-500 sm:flex-row sm:justify-between sm:px-6 sm:text-left lg:px-8">
          <p>
            © {year} {footer.copyright}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-end">
            <button
              type="button"
              onClick={() => openCookiePreferences()}
              className="font-medium text-slate-400 transition-colors hover:text-[#38BDF8] focus-visible:text-[#38BDF8] focus-visible:outline-none"
            >
              Cookie settings
            </button>
            <p className="font-medium text-slate-400">{footer.builtBy}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  className,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
        {title}
      </p>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={`${title}-${link.label}`}>
            <FooterLink href={link.href}>{link.label}</FooterLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  const className =
    "text-sm text-slate-400 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none";
  if (href.startsWith("mailto:") || href.startsWith("http") || href.startsWith("tel:")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  if (href.includes("#")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function ContactItem({
  icon: Icon,
  label,
  value,
  href,
  secondaryHref,
  secondaryLabel,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <li className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{label}</p>
        {href ? (
          <a
            href={href}
            className="mt-0.5 block text-sm text-slate-300 transition-colors hover:text-white"
          >
            {value}
          </a>
        ) : (
          <p className="mt-0.5 text-sm text-slate-300">{value}</p>
        )}
        {secondaryHref && secondaryLabel ? (
          <a
            href={secondaryHref}
            className={cn(
              "mt-1 inline-block text-xs font-medium text-slate-400 transition-colors hover:text-[#38BDF8]",
            )}
          >
            {secondaryLabel}
          </a>
        ) : null}
      </div>
    </li>
  );
}
