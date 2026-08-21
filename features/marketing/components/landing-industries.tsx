import { landingCopy } from "@/features/marketing/content";

/** Industry list — product chips, not marketing pills. */
export function LandingIndustries() {
  return (
    <section id="industries" className="scroll-mt-24 border-t border-border bg-card px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="max-w-2xl">
          <h2 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
            {landingCopy.industriesIntro.title}
          </h2>
          <p className="text-muted-foreground mt-3 text-base text-pretty sm:text-lg">
            {landingCopy.industriesIntro.subtitle}
          </p>
        </div>
        <ul data-reveal className="mt-10 flex flex-wrap gap-2.5">
          {landingCopy.industries.map((name) => (
            <li
              key={name}
              className="text-foreground border-border bg-background rounded-md border px-4 py-2 text-sm font-medium"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
