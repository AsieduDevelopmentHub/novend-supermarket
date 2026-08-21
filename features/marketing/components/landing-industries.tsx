import { landingCopy } from "@/features/marketing/content";

const ROW_TOP = landingCopy.industries.filter((_, i) => i % 2 === 0);
const ROW_BOTTOM = landingCopy.industries.filter((_, i) => i % 2 === 1);

/** Dual-row infinite client marquee — top ← left, bottom → right. */
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
          <p className="text-muted-foreground mt-3 text-base text-pretty sm:text-lg">
            {landingCopy.industriesIntro.subtitle}
          </p>
        </div>

        <ul className="sr-only">
          {landingCopy.industries.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>

        {/* Custom track length (52rem), centered */}
        <div
          data-reveal
          className="landing-marquee-shell mx-auto mt-12 max-w-[52rem]"
          aria-hidden
        >
          <MarqueeRow items={ROW_TOP} direction="left" />
          <MarqueeRow items={ROW_BOTTOM} direction="right" />
        </div>
      </div>
    </section>
  );
}

function MarqueeRow({
  items,
  direction,
}: {
  items: readonly string[];
  direction: "left" | "right";
}) {
  const loop = [...items, ...items, ...items];

  return (
    <div className="landing-marquee-row" data-direction={direction}>
      <ul className="landing-marquee-track">
        {loop.map((name, index) => (
          <li key={`${direction}-${name}-${index}`} className="landing-marquee-chip">
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}
