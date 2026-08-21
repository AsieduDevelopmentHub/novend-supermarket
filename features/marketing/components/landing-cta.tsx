import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LANDING_CONTACT_EMAIL, landingCopy } from "@/features/marketing/content";

export function LandingCta() {
  return (
    <section id="contact" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div
        data-reveal
        className="landing-cta-band landing-shadow-band border-border bg-card mx-auto max-w-6xl overflow-hidden rounded-2xl border px-5 py-12 text-center sm:px-12 sm:py-16"
      >
        <h2 className="text-foreground text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
          {landingCopy.cta.title}
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base text-pretty sm:text-lg">
          {landingCopy.cta.subtitle}
        </p>
        <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
          <Button
            asChild
            size="lg"
            className="landing-shadow-cta-primary h-11 w-full px-6 text-[15px] font-semibold transition-[box-shadow,transform] hover:-translate-y-0.5 sm:w-auto"
          >
            <Link href="/signup">{landingCopy.cta.primary}</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="landing-shadow-cta-outline h-11 w-full px-6 text-[15px] font-semibold transition-[box-shadow,transform] hover:-translate-y-0.5 sm:w-auto"
          >
            <a href={`mailto:${LANDING_CONTACT_EMAIL}?subject=Novend%20sales`}>
              {landingCopy.cta.secondary}
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
