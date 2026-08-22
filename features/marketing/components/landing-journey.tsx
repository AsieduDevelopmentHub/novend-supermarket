"use client";

import { useRef, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { JOURNEY_STEP_SCREENS } from "@/constants/marketing-ui-screens";
import { landingCopy } from "@/features/marketing/content";
import { useLandingJourneyScroll } from "@/features/marketing/hooks/use-landing-journey-scroll";
import { LandingJourneyStage } from "@/features/marketing/components/landing-journey-stage";
import { JourneyScreenshot } from "@/features/marketing/components/journey-screenshot";

type Props = {
  scrollRootRef: RefObject<HTMLElement | null>;
};

const STEP_COUNT = landingCopy.journey.steps.length;

const STEP_ALT: Record<(typeof landingCopy.journey.steps)[number]["id"], string> = {
  receive: "Record supplier purchase in Novend wholesale inventory",
  warehouse: "Novend wholesale warehouse with stock quantities and valuation",
  transfer: "Issue warehouse stock to a branch in Novend",
  sell: "Novend POS checkout with barcode-ready product grid and cart",
  local: "Novend local database backup on this terminal",
  sync: "Novend cloud dashboard after automatic synchronization",
};

/** Sticky scrollytelling — supplier delivery through cloud sync. */
export function LandingJourney({ scrollRootRef }: Props) {
  const stepRefs = useRef<(HTMLElement | null)[]>([]);
  const activeIndex = useLandingJourneyScroll(stepRefs, scrollRootRef);
  const stepIds = landingCopy.journey.steps.map((step) => step.id);
  const activeStep = landingCopy.journey.steps[activeIndex];

  return (
    <section
      id="journey"
      className="landing-journey-v2 scroll-mt-24 border-t border-border bg-[#F8FAFC] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <header className="mx-auto max-w-[620px] text-center lg:text-left">
          <p className="text-primary text-[13px] font-semibold tracking-wide">
            {landingCopy.journey.badge}
          </p>
          <h2 className="text-[#111827] mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            {landingCopy.journey.title}
          </h2>
          <p className="text-slate-600 mt-4 text-base leading-relaxed text-pretty sm:text-lg">
            {landingCopy.journey.subtitle}
          </p>
        </header>

        {/* Mobile / tablet — compact sticky progress */}
        <div
          className="border-border bg-card/95 sticky top-[4.25rem] z-20 mt-10 rounded-2xl border p-4 shadow-sm backdrop-blur-sm lg:hidden"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3 text-xs font-medium">
            <span className="text-primary">{activeStep?.railLabel}</span>
            <span className="text-muted-foreground tabular-nums">
              {activeIndex + 1} / {STEP_COUNT}
            </span>
          </div>
          <div className="bg-muted mt-3 h-1 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${((activeIndex + 1) / STEP_COUNT) * 100}%` }}
            />
          </div>
        </div>

        <div className="mt-10 lg:mt-16 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-12 xl:gap-16">
          <div className="landing-journey-v2-sticky hidden lg:block">
            <LandingJourneyStage activeIndex={activeIndex} stepIds={stepIds} />
          </div>

          <ol className="landing-journey-v2-steps list-none">
            {landingCopy.journey.steps.map((step, index) => {
              const isActive = index === activeIndex;
              const isComplete = index < activeIndex;

              return (
                <li
                  key={step.id}
                  ref={(node) => {
                    stepRefs.current[index] = node;
                  }}
                  className={cn(
                    "landing-journey-v2-step",
                    isActive && "landing-journey-v2-step-active",
                    isComplete && "landing-journey-v2-step-complete",
                    !isActive && !isComplete && "landing-journey-v2-step-upcoming",
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  <div className="landing-journey-v2-step-marker" aria-hidden>
                    <span
                      className={cn(
                        "landing-journey-v2-rail-dot",
                        isActive && "landing-journey-v2-rail-dot-active",
                        isComplete && "landing-journey-v2-rail-dot-complete",
                      )}
                    />
                    {index < STEP_COUNT - 1 ? (
                      <span
                        className={cn(
                          "landing-journey-v2-rail-line",
                          isComplete && "landing-journey-v2-rail-line-complete",
                        )}
                      />
                    ) : null}
                  </div>

                  <article className="landing-journey-v2-step-content">
                    <p
                      className={cn(
                        "text-xs font-semibold tracking-[0.14em] uppercase",
                        isActive ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {step.railLabel}
                    </p>

                    <div className="landing-journey-v2-mobile-stage mt-4 lg:hidden">
                      <div className="landing-journey-v2-stage-frame">
                        <JourneyScreenshot
                          src={JOURNEY_STEP_SCREENS[step.id]}
                          alt={STEP_ALT[step.id]}
                          priority={index === 0}
                        />
                      </div>
                    </div>

                    <h3
                      className={cn(
                        "text-[#111827] mt-3 text-xl font-semibold tracking-tight sm:text-2xl",
                        isActive && "lg:text-[1.75rem]",
                      )}
                    >
                      {step.title}
                    </h3>
                    <p
                      className={cn(
                        "mt-3 max-w-xl text-[15px] leading-relaxed sm:text-base",
                        isActive ? "text-slate-600" : "text-muted-foreground",
                      )}
                    >
                      {step.detail}
                    </p>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
