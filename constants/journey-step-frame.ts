import type { JOURNEY_STEP_SCREENS } from "@/constants/marketing-ui-screens";

export type JourneyStepId = keyof typeof JOURNEY_STEP_SCREENS;

export type JourneyStepFrame = {
  /**
   * `contain` — full modal or card visible (letterboxed). Best for dialog screenshots.
   * `cover` — gentle crop on full-page shots; position only, never zoom scale.
   */
  fit: "contain" | "cover";
  objectPosition?: string;
};

/** One framing rule per step — predictable, no CSS scale hacks. */
export const JOURNEY_STEP_FRAME: Record<JourneyStepId, JourneyStepFrame> = {
  receive: { fit: "contain" },
  warehouse: { fit: "cover", objectPosition: "50% 12%" },
  transfer: { fit: "contain" },
  sell: { fit: "cover", objectPosition: "38% 50%" },
  local: { fit: "cover", objectPosition: "50% 14%" },
  sync: { fit: "contain" },
};
