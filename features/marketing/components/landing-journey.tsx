import { landingCopy } from "@/features/marketing/content";
import { JOURNEY_STEP_FRAME } from "@/constants/journey-step-frame";
import { JOURNEY_STEP_SCREENS } from "@/constants/marketing-ui-screens";
import { JourneyScreenshot } from "@/features/marketing/components/journey-screenshot";

const STEP_ALT: Record<(typeof landingCopy.journey.steps)[number]["id"], string> = {
  receive: "Record supplier purchase in Novend wholesale inventory",
  warehouse: "Novend wholesale warehouse with stock quantities and valuation",
  transfer: "Issue warehouse stock to a branch in Novend",
  sell: "Novend POS checkout with barcode-ready product grid and cart",
  local: "Novend orders list showing completed sales saved on this device",
  sync: "Novend sync center showing recent uploads to the cloud",
};

/** Alternating sticky steps — open editorial layout, no stacked cards. */
export function LandingJourney() {
  return (
    <section
      id="journey"
      className="landing-journey-stack-section scroll-mt-24 border-t border-border bg-[#F8FAFC] px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header data-reveal className="mx-auto max-w-[620px] text-center lg:text-left">
          <p className="text-primary text-[13px] font-semibold tracking-wide">
            {landingCopy.journey.badge}
          </p>
          <h2 className="text-[#111827] mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {landingCopy.journey.title}
          </h2>
          <p className="text-slate-600 mt-4 text-base leading-relaxed text-pretty sm:text-lg">
            {landingCopy.journey.subtitle}
          </p>
        </header>
      </div>

      <div className="landing-journey-stack mx-auto mt-12 max-w-6xl sm:mt-16">
        {landingCopy.journey.steps.map((step, index) => {
          const reverse = index % 2 === 1;
          const stepNumber = String(index + 1).padStart(2, "0");
          const isLast = index === landingCopy.journey.steps.length - 1;

          return (
            <div
              key={step.id}
              className={`landing-journey-stack-item${isLast ? " landing-journey-stack-item-last" : ""}`}
            >
              <article
                className="landing-journey-stack-panel"
                style={{
                  zIndex: index + 1,
                  top: `calc(var(--landing-stack-base-top) + ${index} * var(--landing-stack-step-offset))`,
                }}
              >
                <div
                  className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-14 xl:gap-16 ${
                    reverse ? "lg:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  <div data-reveal className="landing-journey-copy max-w-lg">
                    <div className="landing-journey-step-meta">
                      <span className="landing-journey-step-index" aria-hidden>
                        {stepNumber}
                      </span>
                      <span className="landing-journey-step-rail">{step.railLabel}</span>
                    </div>
                    <h3 className="text-[#111827] mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
                      {step.title}
                    </h3>
                    <p className="text-slate-600 mt-4 text-base leading-relaxed">{step.detail}</p>
                  </div>

                  <div data-depth-panel className="landing-depth-preserve">
                    <div className="landing-journey-panel">
                      <div className="landing-journey-panel-frame">
                        <JourneyScreenshot
                          src={JOURNEY_STEP_SCREENS[step.id]}
                          alt={STEP_ALT[step.id]}
                          frame={JOURNEY_STEP_FRAME[step.id]}
                          priority={index === 0}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          );
        })}
      </div>
    </section>
  );
}
