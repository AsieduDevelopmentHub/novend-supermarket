import Link from "next/link";
import { LANDING_CONTACT_EMAIL, landingCopy } from "@/features/marketing/content";

export function LandingCta() {
  return (
    <section id="contact" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8">
      <div
        data-reveal
        className="landing-cta-band mx-auto max-w-6xl overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-12"
      >
        <h2 className="text-foreground text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {landingCopy.cta.title}
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base text-pretty sm:text-lg">
          {landingCopy.cta.subtitle}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login" className="landing-pill-btn landing-pill-btn-primary">
            {landingCopy.cta.primary}
          </Link>
          <a
            href={`mailto:${LANDING_CONTACT_EMAIL}?subject=Novend%20sales`}
            className="landing-pill-btn landing-pill-btn-outline"
          >
            {landingCopy.cta.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}
