import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LANDING_CONTACT_EMAIL, landingCopy } from "@/features/marketing/content";

export function LandingCta() {
  return (
    <section id="contact" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8">
      <div
        data-reveal
        className="landing-cta-band border-border bg-card mx-auto max-w-6xl overflow-hidden rounded-2xl border px-6 py-16 text-center shadow-[0_20px_50px_rgba(15,23,42,0.08)] sm:px-12"
      >
        <h2 className="text-foreground text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {landingCopy.cta.title}
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base text-pretty sm:text-lg">
          {landingCopy.cta.subtitle}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-11 px-6 text-[15px] font-semibold">
            <Link href="/login">{landingCopy.cta.primary}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 px-6 text-[15px] font-semibold">
            <a href={`mailto:${LANDING_CONTACT_EMAIL}?subject=Novend%20sales`}>
              {landingCopy.cta.secondary}
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
