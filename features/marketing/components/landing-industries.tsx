import { landingCopy } from "@/features/marketing/content";

/** Industry chips — no card grid. */
export function LandingIndustries() {
  return (
    <section id="industries" className="scroll-mt-24 bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="max-w-2xl">
          <h2 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
            {landingCopy.industriesIntro.title}
          </h2>
          <p className="text-muted-foreground mt-3 text-base text-pretty sm:text-lg">
            {landingCopy.industriesIntro.subtitle}
          </p>
        </div>
        <ul data-reveal className="mt-10 flex flex-wrap gap-3">
          {landingCopy.industries.map((name) => (
            <li
              key={name}
              className="text-foreground rounded-full border border-slate-200/90 bg-[#F8FAFC] px-5 py-2.5 text-sm font-medium"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
