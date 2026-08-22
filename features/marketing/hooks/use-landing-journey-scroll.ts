"use client";

import { useEffect, useState, type RefObject } from "react";

/** Picks the workflow step nearest the scroll anchor inside the landing scroller. */
export function useLandingJourneyScroll(
  stepRefs: RefObject<(HTMLElement | null)[]>,
  scrollerRef: RefObject<HTMLElement | null>,
) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onScroll = () => {
      const steps = stepRefs.current.filter((node): node is HTMLElement => node != null);
      if (steps.length === 0) return;

      const scrollerRect = scroller.getBoundingClientRect();
      const anchor = scrollerRect.top + scrollerRect.height * 0.44;

      let bestIndex = 0;
      let bestDistance = Infinity;

      steps.forEach((step, index) => {
        const rect = step.getBoundingClientRect();
        const focal = rect.top + rect.height * 0.32;
        const distance = Math.abs(focal - anchor);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });

      setActiveIndex(bestIndex);
    };

    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [stepRefs, scrollerRef]);

  return activeIndex;
}
