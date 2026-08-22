"use client";

import { useEffect, type RefObject } from "react";

/** Subtle mouse parallax on the hero dashboard — GPU transforms only. */
export function useLandingHeroParallax(stageRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      stage.style.transform = `rotateY(${x * 3}deg) rotateX(${-y * 2}deg) translateZ(0)`;
    };

    const onLeave = () => {
      stage.style.transform = "rotateY(0deg) rotateX(0deg) translateZ(0)";
    };

    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    return () => {
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, [stageRef]);
}
