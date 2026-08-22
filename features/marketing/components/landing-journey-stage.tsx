"use client";

import { cn } from "@/lib/utils";
import { JOURNEY_STEP_SCREENS } from "@/constants/marketing-ui-screens";
import { JourneyScreenshot } from "@/features/marketing/components/journey-screenshot";

type StepId = keyof typeof JOURNEY_STEP_SCREENS;

const STEP_ALT: Record<StepId, string> = {
  receive: "Record supplier purchase in Novend wholesale inventory",
  warehouse: "Novend wholesale warehouse with stock quantities and valuation",
  transfer: "Issue warehouse stock to a branch in Novend",
  sell: "Novend POS checkout with barcode-ready product grid and cart",
  local: "Novend local database backup on this terminal",
  sync: "Novend cloud dashboard after automatic synchronization",
};

type Props = {
  activeIndex: number;
  stepIds: StepId[];
};

/** Sticky stage — real Novend screens crossfade without decorative overlays. */
export function LandingJourneyStage({ activeIndex, stepIds }: Props) {
  return (
    <div className="landing-journey-v2-stage">
      <div className="landing-journey-v2-stage-frame">
        {stepIds.map((id, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={id}
              className={cn(
                "landing-journey-v2-screen",
                isActive && "landing-journey-v2-screen-active",
              )}
              aria-hidden={!isActive}
            >
              <JourneyScreenshot
                src={JOURNEY_STEP_SCREENS[id]}
                alt={STEP_ALT[id]}
                priority={index === 0}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
