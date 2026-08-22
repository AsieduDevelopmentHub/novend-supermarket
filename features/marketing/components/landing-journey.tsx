"use client";

import { useRef, type RefObject } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { JOURNEY_STEP_SCREENS } from "@/constants/marketing-ui-screens";
import { landingCopy } from "@/features/marketing/content";
import { useLandingJourneyScroll } from "@/features/marketing/hooks/use-landing-journey-scroll";
import { LandingJourneyStage } from "@/features/marketing/components/landing-journey-stage";

type Props = {
  scrollRootRef: RefObject<HTMLElement | null>;
};

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

  return (
    <section
      id="journey"
      className="landing-journey-v2 scroll-mt-24 border-t border-border bg-[#F8FAFC] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <header className="mx-auto max-w-[620px]">
          <p className="text-primary text-[13px] font-semibold tracking-wide">
            {landingCopy.journey.badge}
          </p>
          <h2 className="text-[#111827] mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            {landingCopy.journey.title}
          </h2>
          <p className="text-slate-600 mt-4 text-base leading-relaxed text-pretty sm:text-lg">
            {landingCopy.journey.subtitle}
          </p>
        </header>

        <div className="mt-16 lg:mt-20 lg:grid lg:grid-cols-2 lg:gap-14 xl:gap-20">
          <div className="landing-journey-v2-sticky hidden lg:block">
            <LandingJourneyStage activeIndex={activeIndex} stepIds={stepIds} />
          </div>

          <div className="landing-journey-v2-steps">
            <div>
              {landingCopy.journey.steps.map((step, index) => {
                const state =
                  index === activeIndex ? "active" : index < activeIndex ? "past" : "upcoming";
                const isLast = index === landingCopy.journey.steps.length - 1;

                return (
                  <article
                    key={step.id}
                    ref={(node) => {
                      stepRefs.current[index] = node;
                    }}
                    className={cn("landing-journey-v2-step", `landing-journey-v2-step-${state}`)}
                    aria-current={index === activeIndex ? "step" : undefined}
                  >
                    <div className="landing-journey-v2-step-row">
                      <div className="landing-journey-v2-step-rail" aria-hidden>
                        <span
                          className={cn(
                            "landing-journey-v2-rail-dot",
                            index === activeIndex && "landing-journey-v2-rail-dot-active",
                            index < activeIndex && "landing-journey-v2-rail-dot-complete",
                          )}
                        />
                        {!isLast ? <span className="landing-journey-v2-rail-line" /> : null}
                        <span className="landing-journey-v2-rail-label">{step.railLabel}</span>
                      </div>

                      <div className="landing-journey-v2-step-body">
                        <div className="landing-journey-v2-mobile-stage mb-8 lg:hidden">
                          <div className="landing-journey-v2-stage-frame">
                            <Image
                              src={JOURNEY_STEP_SCREENS[step.id]}
                              alt={STEP_ALT[step.id]}
                              width={1280}
                              height={800}
                              loading="lazy"
                              className="h-full w-full object-cover object-left-top"
                              sizes="90vw"
                            />
                          </div>
                        </div>

                        <div className="landing-journey-v2-step-accent" aria-hidden />

                        <h3 className="text-[#111827] text-2xl font-semibold tracking-tight sm:text-3xl">
                          {step.title}
                        </h3>
                        <p className="text-slate-600 mt-4 max-w-lg text-base leading-relaxed">
                          {step.detail}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
