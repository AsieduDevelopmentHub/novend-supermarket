"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { JOURNEY_STEP_SCREENS } from "@/constants/marketing-ui-screens";

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

/** Sticky 3D product stage — real Novend screens crossfade per workflow step. */
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
              <Image
                src={JOURNEY_STEP_SCREENS[id]}
                alt={STEP_ALT[id]}
                width={1280}
                height={800}
                loading={index === 0 ? "eager" : "lazy"}
                className="h-full w-full object-cover object-left-top"
                sizes="(max-width: 1024px) 90vw, 540px"
              />
              <JourneyStepOverlay id={id} active={isActive} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JourneyStepOverlay({ id, active }: { id: StepId; active: boolean }) {
  if (!active) return null;

  switch (id) {
    case "receive":
      return (
        <div className="landing-journey-v2-overlay landing-journey-v2-overlay-receive" aria-hidden>
          <span className="landing-journey-v2-box landing-journey-v2-box-a" />
          <span className="landing-journey-v2-box landing-journey-v2-box-b" />
          <span className="landing-journey-v2-box landing-journey-v2-box-c" />
        </div>
      );
    case "warehouse":
      return (
        <div className="landing-journey-v2-overlay landing-journey-v2-overlay-warehouse" aria-hidden>
          <span className="landing-journey-v2-glow" />
        </div>
      );
    case "transfer":
      return (
        <div className="landing-journey-v2-overlay landing-journey-v2-overlay-transfer" aria-hidden>
          <span className="landing-journey-v2-arrow" />
        </div>
      );
    case "sell":
      return (
        <div className="landing-journey-v2-overlay landing-journey-v2-overlay-sell" aria-hidden>
          <span className="landing-journey-v2-scan-line" />
        </div>
      );
    case "local":
      return (
        <div className="landing-journey-v2-overlay landing-journey-v2-overlay-local" aria-hidden>
          <span className="landing-journey-v2-stream landing-journey-v2-stream-a" />
          <span className="landing-journey-v2-stream landing-journey-v2-stream-b" />
          <span className="landing-journey-v2-stream landing-journey-v2-stream-c" />
        </div>
      );
    case "sync":
      return (
        <div className="landing-journey-v2-overlay landing-journey-v2-overlay-sync" aria-hidden>
          <span className="landing-journey-v2-sync-line" />
          <span className="landing-journey-v2-sync-pulse" />
        </div>
      );
    default:
      return null;
  }
}
