import Image from "next/image";
import Link from "next/link";
import { BRANDING } from "@/constants/branding";
import { LANDING_CONTACT_EMAIL, landingCopy } from "@/features/marketing/content";

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-[#111827] text-slate-300">
      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
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
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Product</p>
          <ul className="mt-3 space-y-2 text-sm">
            {landingCopy.footer.product.map((item) => (
              <li key={item.href}>
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
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Company</p>
          <ul className="mt-3 space-y-2 text-sm">
            {landingCopy.footer.company.map((item) => (
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
      <p
        className="pointer-events-none absolute right-0 bottom-[-0.35em] left-0 select-none text-center text-[18vw] leading-none font-bold tracking-tight text-white/[0.04]"
        aria-hidden
      >
        NOVEND
      </p>
    </footer>
  );
}
