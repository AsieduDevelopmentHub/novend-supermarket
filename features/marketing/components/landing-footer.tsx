import Image from "next/image";
import Link from "next/link";
import { BRANDING } from "@/constants/branding";
import { LANDING_CONTACT_EMAIL, landingCopy } from "@/features/marketing/content";

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-[#111827] text-slate-300">
      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-5 lg:px-8">
        <div className="lg:col-span-2">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Image
              src={BRANDING.brandmark}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
            <span className="text-sm font-bold tracking-[0.08em] text-white uppercase">
              {landingCopy.brand}
            </span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            {landingCopy.footer.description}
          </p>
        </div>
        <FooterColumn title="Product" links={landingCopy.footer.product} />
        <FooterColumn title="Resources" links={landingCopy.footer.resources} />
        <div>
          <FooterColumn title="Company" links={landingCopy.footer.company} />
          <p className="mt-6 text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Socials
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {landingCopy.footer.socials.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="hover:text-white">
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <a href={`mailto:${LANDING_CONTACT_EMAIL}`} className="hover:text-white">
                {LANDING_CONTACT_EMAIL}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="relative z-10 border-white/10 border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-slate-500">
            © {year} {landingCopy.brand}. All rights reserved.
          </p>
          <p className="text-slate-500">{landingCopy.footer.builtBy}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((item) => (
          <li key={item.href + item.label}>
            {item.href.startsWith("/") ? (
              <Link href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ) : (
              <a href={item.href} className="hover:text-white">
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
