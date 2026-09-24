"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";

/**
 * Hero entrance only — never hides core content behind observers.
 * Scroll reveals were removed so the page stays complete when JS/motion fails.
 */
export function useLandingHeroIntro(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const copy = root.querySelectorAll<HTMLElement>("[data-hero-copy] > *");
    const visual = root.querySelector<HTMLElement>("[data-hero-visual]");
    if (copy.length === 0 && !visual) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      if (copy.length > 0) {
        tl.from(copy, {
          opacity: 0.35,
          y: 16,
          duration: 0.55,
          stagger: 0.06,
          clearProps: "opacity,transform",
        });
      }
      if (visual) {
        tl.from(
          visual,
          {
            opacity: 0.4,
            y: 20,
            duration: 0.6,
            clearProps: "opacity,transform",
          },
          "-=0.35",
        );
      }
    }, root);

    return () => ctx.revert();
  }, [rootRef]);
}

/** @deprecated Prefer no scroll-hiding reveals. Kept as no-op for stray imports. */
export function useLandingReveal(
  _rootRef: RefObject<HTMLElement | null>,
  _options: {
    scroller: RefObject<HTMLElement | null>;
    targets?: string;
    y?: number;
    duration?: number;
    start?: string;
  },
) {
  // Intentionally empty — content must remain visible without observers.
}

/** @deprecated Depth/parallax removed for performance and content visibility. */
export function useLandingDepth(
  _rootRef: RefObject<HTMLElement | null>,
  _scroller: RefObject<HTMLElement | null>,
) {
  // Intentionally empty.
}
