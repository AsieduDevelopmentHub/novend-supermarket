import { landingCopy } from "@/features/marketing/content";

/** Industry grid with hover hints. */
export function LandingIndustries() {
  return (
    <section
      id="industries"
      className="landing-industries scroll-mt-24 border-t border-border bg-card px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
            {landingCopy.industriesIntro.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base text-pretty sm:text-lg">
            {landingCopy.industriesIntro.subtitle}
          </p>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {landingCopy.industries.map((item) => (
            <li
              key={item.name}
              data-depth-card
              className="landing-shadow-card group border-border bg-background rounded-[1.25rem] border p-6 transition-[box-shadow,transform] duration-300 hover:-translate-y-1"
            >
              <h3 className="text-foreground text-lg font-semibold">{item.name}</h3>
              <p className="text-muted-foreground mt-2 text-sm opacity-80 transition-opacity group-hover:opacity-100">
                {item.hint}
              </p>
              <p className="text-primary mt-4 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                See how Novend fits this business →
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
