import { landingCopy } from "@/features/marketing/content";
import { LandingAmbient } from "@/features/marketing/components/landing-ambient";

/** Four featured capabilities with scroll 3D panels. */
export function LandingFeatures() {
  return (
    <section
      id="platform"
      className="landing-features relative scroll-mt-24 overflow-hidden border-t border-slate-100 px-4 py-24 sm:px-6 sm:py-28 lg:px-8"
    >
      <LandingAmbient variant="light" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <div data-reveal className="max-w-2xl">
          <p className="text-primary text-sm font-semibold tracking-wide">
            {landingCopy.features.eyebrow}
          </p>
          <h2 className="text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {landingCopy.features.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base text-pretty sm:text-lg">
            {landingCopy.features.subtitle}
          </p>
        </div>

        <div className="landing-perspective mt-16 grid gap-6 md:grid-cols-2">
          {landingCopy.features.items.map((item, index) => (
            <article
              key={item.title}
              data-depth-panel
              className="landing-feature-panel landing-depth-preserve rounded-[1.75rem] border border-white/70 bg-white/80 p-7 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur-md sm:p-8"
            >
              <p className="text-primary/80 text-xs font-bold tracking-[0.18em] uppercase">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="text-foreground mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
                {item.title}
              </h3>
              <p className="text-muted-foreground mt-3 max-w-md text-sm leading-relaxed sm:text-base">
                {item.detail}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
