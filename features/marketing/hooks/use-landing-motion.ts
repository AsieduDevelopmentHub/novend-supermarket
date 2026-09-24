"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Hero entrance only — never hides core content behind observers.
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

type RevealOptions = {
  scroller: RefObject<HTMLElement | null>;
  targets?: string;
  y?: number;
  duration?: number;
  start?: string;
};

/**
 * Soft on-scroll reveals (GSAP ScrollTrigger).
 *
 * Critical: CSS keeps `[data-reveal]` at opacity 1. Animation only starts from a
 * mild fade via GSAP, with `clearProps`, so a failed/missing observer never
 * blanks the page (that bug previously forced scroll reveals off).
 */
export function useLandingReveal(
  rootRef: RefObject<HTMLElement | null>,
  options: RevealOptions,
) {
  const { scroller, targets = "[data-reveal]", y = 28, duration = 0.65, start = "top 88%" } =
    options;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scrollRoot = scroller.current ?? undefined;

    const ctx = gsap.context(() => {
      root.querySelectorAll<HTMLElement>("[data-reveal-stagger]").forEach((group) => {
        const kids = Array.from(group.children) as HTMLElement[];
        if (kids.length === 0) return;
        gsap.from(kids, {
          opacity: 0.2,
          y,
          duration,
          ease: "power2.out",
          stagger: 0.07,
          clearProps: "opacity,transform",
          scrollTrigger: {
            trigger: group,
            scroller: scrollRoot,
            start,
            once: true,
            invalidateOnRefresh: true,
          },
        });
      });

      root.querySelectorAll<HTMLElement>("[data-reveal-pair]").forEach((pair) => {
        const kids = Array.from(pair.children) as HTMLElement[];
        if (kids.length === 0) return;
        gsap.from(kids, {
          opacity: 0.2,
          y: 24,
          duration,
          ease: "power2.out",
          stagger: 0.12,
          clearProps: "opacity,transform",
          scrollTrigger: {
            trigger: pair,
            scroller: scrollRoot,
            start,
            once: true,
            invalidateOnRefresh: true,
          },
        });
      });

      const nodes = Array.from(root.querySelectorAll<HTMLElement>(targets));
      for (const el of nodes) {
        if (el.closest("[data-reveal-stagger]")) continue;
        if (el.closest("[data-reveal-pair]")) continue;
        if (el.closest("[data-hero-copy], [data-hero-visual]")) continue;

        const direction = el.getAttribute("data-reveal");
        const fromX = direction === "left" ? -20 : direction === "right" ? 20 : 0;

        gsap.from(el, {
          opacity: 0.2,
          y: fromX === 0 ? y : 18,
          x: fromX,
          duration,
          ease: "power2.out",
          clearProps: "opacity,transform",
          scrollTrigger: {
            trigger: el,
            scroller: scrollRoot,
            start,
            once: true,
            invalidateOnRefresh: true,
          },
        });
      }
    }, root);

    const refresh = () => ScrollTrigger.refresh();
    const timer = window.setTimeout(refresh, 350);
    window.addEventListener("load", refresh);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("load", refresh);
      ctx.revert();
    };
  }, [rootRef, scroller, targets, y, duration, start]);
}

/** @deprecated Depth/parallax removed for performance and content visibility. */
export function useLandingDepth(
  _rootRef: RefObject<HTMLElement | null>,
  _scroller: RefObject<HTMLElement | null>,
) {
  // Intentionally empty.
}
