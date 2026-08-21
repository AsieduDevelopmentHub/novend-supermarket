import { landingCopy } from "@/features/marketing/content";

/** Numbered timeline — open layout, no card chrome. */
export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-white px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="max-w-2xl">
          <p className="text-primary text-sm font-semibold tracking-wide">
            {landingCopy.howItWorks.eyebrow}
          </p>
          <h2 className="text-foreground mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {landingCopy.howItWorks.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base text-pretty sm:text-lg">
            {landingCopy.howItWorks.subtitle}
          </p>
        </div>

        <ol className="mt-16 space-y-0 border-t border-slate-200/80">
          {landingCopy.howItWorks.steps.map((item) => (
            <li
              key={item.step}
              data-reveal
              className="grid gap-3 border-b border-slate-200/80 py-7 sm:grid-cols-[5.5rem_1fr_1.2fr] sm:items-baseline sm:gap-8"
            >
              <p className="text-primary text-xs font-bold tracking-[0.16em] uppercase">
                Step {item.step}
              </p>
              <h3 className="text-foreground text-lg font-semibold">{item.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
                {item.detail}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
