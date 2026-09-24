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
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      if (copy.length > 0) {
        tl.fromTo(
          copy,
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.07,
            clearProps: "transform",
          },
        );
      }
      if (visual) {
        tl.fromTo(
          visual,
          { opacity: 0, x: 36 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            clearProps: "transform",
          },
          "-=0.45",
        );
      }
    }, root);

    return () => ctx.revert();
  }, [rootRef]);
}

type RevealOptions = {
  scroller: RefObject<HTMLElement | null>;
  targets?: string;
  duration?: number;
  /** When the trigger top hits this scroller point — keep below fold to avoid flash. */
  start?: string;
};

type Offset = { x: number; y: number };

function offsetForReveal(el: HTMLElement, fallbackIndex = 0): Offset {
  const raw = (el.getAttribute("data-reveal") || "").trim().toLowerCase();
  if (raw === "left") return { x: -48, y: 12 };
  if (raw === "right") return { x: 48, y: 12 };
  if (raw === "up" || raw === "true" || raw === "") {
    // Plain markers: alternate horizontal so the page isn't all bottom-up.
    return fallbackIndex % 2 === 0 ? { x: -36, y: 20 } : { x: 36, y: 20 };
  }
  return fallbackIndex % 2 === 0 ? { x: -36, y: 20 } : { x: 36, y: 20 };
}

function playReveal(
  el: HTMLElement | HTMLElement[],
  offset: Offset | Offset[],
  duration: number,
) {
  const targets = Array.isArray(el) ? el : [el];
  const offsets = Array.isArray(offset) ? offset : targets.map(() => offset);

  targets.forEach((node, i) => {
    const from = offsets[i] ?? offsets[0]!;
    gsap.fromTo(
      node,
      {
        autoAlpha: 0,
        x: from.x,
        y: from.y,
        force3D: true,
      },
      {
        autoAlpha: 1,
        x: 0,
        y: 0,
        duration,
        ease: "power3.out",
        overwrite: "auto",
        clearProps: "transform",
        // Leave visibility/opacity clean; autoAlpha restores visibility:visible
        onComplete: () => {
          gsap.set(node, { clearProps: "visibility,opacity" });
        },
      },
    );
  });
}

/**
 * On-scroll reveals via ScrollTrigger.
 *
 * Starts while the block is still below the fold (`top bottom`) so the
 * from-state is never painted mid-viewport (that caused the flicker).
 * Horizontal offsets honor `data-reveal="left|right"`; plain markers alternate.
 *
 * CSS keeps markers at opacity 1 until JS runs — if motion never attaches,
 * content stays fully visible.
 */
export function useLandingReveal(
  rootRef: RefObject<HTMLElement | null>,
  options: RevealOptions,
) {
  const { scroller, targets = "[data-reveal]", duration = 0.85, start = "top bottom" } = options;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scrollRoot = scroller.current ?? undefined;
    const triggers: ScrollTrigger[] = [];

    const ctx = gsap.context(() => {
      const watched = new Set<HTMLElement>();

      const arm = (el: HTMLElement, run: () => void) => {
        if (watched.has(el)) return;
        watched.add(el);

        // Already in view at load — leave as-is (no flash).
        const rect = el.getBoundingClientRect();
        const viewH = scrollRoot?.clientHeight ?? window.innerHeight;
        if (rect.top < viewH * 0.88 && rect.bottom > 40) {
          return;
        }

        triggers.push(
          ScrollTrigger.create({
            trigger: el,
            scroller: scrollRoot,
            start,
            once: true,
            onEnter: run,
          }),
        );
      };

      root.querySelectorAll<HTMLElement>("[data-reveal-stagger]").forEach((group) => {
        const kids = Array.from(group.children) as HTMLElement[];
        if (kids.length === 0) return;
        kids.forEach((k) => watched.add(k));
        arm(group, () => {
          playReveal(
            kids,
            kids.map((kid, i) => offsetForReveal(kid, i)),
            duration,
          );
        });
      });

      root.querySelectorAll<HTMLElement>("[data-reveal-pair]").forEach((pair) => {
        const kids = Array.from(pair.children) as HTMLElement[];
        if (kids.length === 0) return;
        kids.forEach((k) => watched.add(k));
        // Prefer explicit left/right on each column.
        const offsets = kids.map((kid, i) => {
          const explicit = (kid.getAttribute("data-reveal") || "").trim().toLowerCase();
          if (explicit === "left" || explicit === "right") return offsetForReveal(kid, i);
          // First column from left, second from right when unmarked.
          return i === 0 ? { x: -52, y: 16 } : { x: 52, y: 16 };
        });
        arm(pair, () => playReveal(kids, offsets, duration));
      });

      const nodes = Array.from(root.querySelectorAll<HTMLElement>(targets));
      let index = 0;
      for (const el of nodes) {
        if (el.closest("[data-reveal-stagger]")) continue;
        if (el.closest("[data-reveal-pair]")) continue;
        if (el.closest("[data-hero-copy], [data-hero-visual]")) continue;
        if (watched.has(el)) continue;
        const i = index++;
        arm(el, () => playReveal(el, offsetForReveal(el, i), duration));
      }
    }, root);

    const refresh = () => ScrollTrigger.refresh();
    const timer = window.setTimeout(refresh, 200);
    window.addEventListener("load", refresh);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("load", refresh);
      triggers.forEach((t) => t.kill());
      ctx.revert();
    };
  }, [rootRef, scroller, targets, duration, start]);
}

/** @deprecated Depth/parallax removed for performance and content visibility. */
export function useLandingDepth(
  _rootRef: RefObject<HTMLElement | null>,
  _scroller: RefObject<HTMLElement | null>,
) {
  // Intentionally empty.
}
