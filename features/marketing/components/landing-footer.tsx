import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Headset, Mail, MapPin, Phone } from "lucide-react";
import { BRANDING } from "@/constants/branding";
import { landingCopy } from "@/features/marketing/content";
import { cn } from "@/lib/utils";

/** Section 8 — premium Onyx footer with real Novend business information. */
export function LandingFooter() {
  const year = new Date().getFullYear();
  const { footer } = landingCopy;
  const { contact } = footer;

  return (
    <footer className="landing-footer bg-[#111827] text-slate-300">
      <div className="landing-footer-grid mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="landing-footer-brand space-y-5">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src={BRANDING.logoHorizontalLight}
              alt="Novend"
              width={160}
              height={36}
              className="h-8 w-auto object-contain"
            />
          </Link>
          <p className="text-sm font-semibold tracking-tight text-white">{footer.brandTitle}</p>
          <p className="max-w-sm text-sm leading-relaxed text-slate-400">{footer.description}</p>
          <ul className="flex flex-wrap gap-2">
            {footer.badges.map((badge) => (
              <li
                key={badge}
                className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-200"
              >
                {badge}
              </li>
            ))}
          </ul>
        </div>

        <FooterColumn title="Product" links={footer.product} className="landing-footer-product" />
        <FooterColumn
          title="Resources"
          links={footer.resources}
          className="landing-footer-resources"
        />
        <FooterColumn title="Legal" links={footer.legal} className="landing-footer-legal" />

        <div className="landing-footer-contact">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
            {contact.title}
          </p>
          <ul className="mt-4 space-y-3.5">
            <ContactItem
              icon={Mail}
              label={contact.email.label}
              value={contact.email.value}
              href={contact.email.href}
            />
            <ContactItem
              icon={Phone}
              label={contact.international.label}
              value={contact.international.value}
              href={contact.international.href}
            />
            <ContactItem
              icon={Headset}
              label={contact.local.label}
              value={contact.local.value}
              href={contact.local.href}
            />
            <ContactItem
              icon={MapPin}
              label={contact.location.label}
              value={contact.location.value}
            />
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-5 text-center text-xs text-slate-500 sm:flex-row sm:justify-between sm:px-6 sm:text-left lg:px-8">
          <p>
            © {year} {footer.copyright}
          </p>
          <p className="font-medium text-slate-400">{footer.builtBy}</p>
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
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((item) => (
          <li key={`${item.href}-${item.label}`}>
            <FooterLink href={item.href}>{item.label}</FooterLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  const className =
    "text-slate-300 transition-colors duration-150 hover:text-[#38BDF8] focus-visible:text-[#38BDF8] focus-visible:outline-none";

  if (
    href.startsWith("http") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("#")
  ) {
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
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/12 text-slate-300 transition-colors duration-150 group-hover:border-[#38BDF8]/40 group-hover:text-[#38BDF8]">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium tracking-wide text-slate-500">{label}</span>
        <span className="mt-0.5 block text-sm text-slate-200 transition-colors duration-150 group-hover:text-white">
          {value}
        </span>
      </span>
    </>
  );

  if (href) {
    return (
      <li>
        <a
          href={href}
          className="group flex cursor-pointer items-start gap-3"
          {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {body}
        </a>
      </li>
    );
  }

  return <li className={cn("group flex items-start gap-3")}>{body}</li>;
}
