"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Sticky journey pin — active step enlarges; previous steps rise, shrink, dim;
 * matching visual crossfades. Uses the landing scroll container as scroller.
 */
export function useLandingJourneyPin(
  pinRef: RefObject<HTMLElement | null>,
  scroller: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const pin = pinRef.current;
    const scrollEl = scroller.current;
    if (!pin || !scrollEl) return;

    const steps = gsap.utils.toArray<HTMLElement>(pin.querySelectorAll("[data-journey-step]"));
    const visuals = gsap.utils.toArray<HTMLElement>(pin.querySelectorAll("[data-journey-visual]"));
    if (!steps.length) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      steps.forEach((step, index) => {
        step.style.opacity = index === 0 ? "1" : "0.45";
        step.style.display = index === 0 ? "block" : "none";
      });
      visuals.forEach((visual, index) => {
        visual.style.opacity = index === 0 ? "1" : "0";
        visual.style.pointerEvents = index === 0 ? "auto" : "none";
      });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(steps, { transformOrigin: "center top" });
      gsap.set(visuals, { autoAlpha: 0, rotateY: -8, z: -30 });
      gsap.set(visuals[0], { autoAlpha: 1, rotateY: 0, z: 0 });
      gsap.set(steps[0], { autoAlpha: 1, scale: 1, y: 0, zIndex: 20 });
      steps.slice(1).forEach((step, i) => {
        gsap.set(step, {
          autoAlpha: 0.35,
          scale: 0.94,
          y: 28 + i * 10,
          zIndex: 10 - i,
        });
      });

      const applyStep = (active: number) => {
        steps.forEach((step, index) => {
          if (index === active) {
            gsap.to(step, {
              autoAlpha: 1,
              scale: 1.03,
              y: 0,
              zIndex: 30,
              duration: 0.45,
              ease: "power3.out",
              overwrite: "auto",
            });
          } else if (index < active) {
            gsap.to(step, {
              autoAlpha: 0.2,
              scale: 0.9,
              y: -36 - (active - index) * 10,
              zIndex: 5,
              duration: 0.45,
              ease: "power3.out",
              overwrite: "auto",
            });
          } else {
            gsap.to(step, {
              autoAlpha: 0.32,
              scale: 0.94,
              y: 32 + (index - active) * 12,
              zIndex: 10 - (index - active),
              duration: 0.45,
              ease: "power3.out",
              overwrite: "auto",
            });
          }
        });

        visuals.forEach((visual, index) => {
          if (index === active) {
            gsap.to(visual, {
              autoAlpha: 1,
              rotateY: 0,
              z: 0,
              duration: 0.5,
              ease: "power3.out",
              overwrite: "auto",
            });
          } else {
            gsap.to(visual, {
              autoAlpha: 0,
              rotateY: index < active ? 10 : -10,
              z: -40,
              duration: 0.4,
              ease: "power2.inOut",
              overwrite: "auto",
            });
          }
        });
      };

      let current = 0;
      applyStep(0);

      ScrollTrigger.create({
        trigger: pin,
        scroller: scrollEl,
        start: "top top+=72",
        end: () => `+=${Math.max(steps.length, 1) * window.innerHeight * 0.72}`,
        pin: true,
        pinSpacing: true,
        scrub: 0.65,
        anticipatePin: 1,
        onUpdate: (self) => {
          const next = Math.min(
            steps.length - 1,
            Math.max(0, Math.floor(self.progress * steps.length)),
          );
          if (next !== current) {
            current = next;
            applyStep(current);
          }
        },
      });
    }, pin);

    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [pinRef, scroller]);
}
