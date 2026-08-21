"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Options = {
  scroller: RefObject<HTMLElement | null>;
  targets?: string;
  y?: number;
  duration?: number;
  start?: string;
};

/** Scroll reveals via GSAP ScrollTrigger. Respects prefers-reduced-motion. */
export function useLandingReveal(
  rootRef: RefObject<HTMLElement | null>,
  {
    scroller,
    targets = "[data-reveal]",
    y = 36,
    duration = 0.9,
    start = "top 88%",
  }: Options,
) {
  useEffect(() => {
    const root = rootRef.current;
    const scrollEl = scroller.current;
    if (!root || !scrollEl) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.querySelectorAll(targets).forEach((node) => {
        (node as HTMLElement).style.opacity = "1";
      });
      return;
    }

    const ctx = gsap.context(() => {
      const nodes = gsap.utils.toArray<HTMLElement>(targets);
      nodes.forEach((node) => {
        gsap.fromTo(
          node,
          { autoAlpha: 0, y },
          {
            autoAlpha: 1,
            y: 0,
            duration,
            ease: "power3.out",
            scrollTrigger: {
              trigger: node,
              scroller: scrollEl,
              start,
              toggleActions: "play none none none",
            },
          },
        );
      });
    }, root);

    const onResize = () => ScrollTrigger.refresh();
    window.addEventListener("resize", onResize);
    ScrollTrigger.refresh();

    return () => {
      window.removeEventListener("resize", onResize);
      ctx.revert();
    };
  }, [rootRef, scroller, targets, y, duration, start]);
}

/** Hero entrance — product stage + copy. */
export function useLandingHeroIntro(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from("[data-hero-brand]", { autoAlpha: 0, y: 14, duration: 0.65 })
        .from("[data-hero-copy] > *:not([data-hero-brand])", {
          autoAlpha: 0,
          y: 24,
          duration: 0.75,
          stagger: 0.08,
        }, "-=0.3")
        .from(
          "[data-hero-visual]",
          { autoAlpha: 0, y: 36, rotateX: 8, duration: 1 },
          "-=0.5",
        );
    }, root);

    return () => ctx.revert();
  }, [rootRef]);
}

/**
 * Product scroll depth — POS stage, journey panels, inventory, scan, receipt, chart.
 */
export function useLandingDepth(
  rootRef: RefObject<HTMLElement | null>,
  scroller: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const root = rootRef.current;
    const scrollEl = scroller.current;
    if (!root || !scrollEl) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const stage = root.querySelector<HTMLElement>("[data-depth-stage]");
      if (stage) {
        gsap.fromTo(
          stage,
          { rotateY: -14, rotateX: 8, z: -40 },
          {
            rotateY: 8,
            rotateX: -3,
            z: 0,
            ease: "none",
            scrollTrigger: {
              trigger: stage,
              scroller: scrollEl,
              start: "top 80%",
              end: "bottom 25%",
              scrub: 1.1,
            },
          },
        );
      }

      gsap.utils.toArray<HTMLElement>("[data-depth-panel]").forEach((panel, index) => {
        gsap.fromTo(
          panel,
          { autoAlpha: 0, y: index % 2 === 0 ? 40 : 52, rotateX: 10, z: -40 },
          {
            autoAlpha: 1,
            y: 0,
            rotateX: 0,
            z: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: panel,
              scroller: scrollEl,
              start: "top 88%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>("[data-depth-card]").forEach((card, index) => {
        gsap.fromTo(
          card,
          { autoAlpha: 0, y: 40, rotateY: index % 2 === 0 ? -8 : 8, z: -24 },
          {
            autoAlpha: 1,
            y: 0,
            rotateY: 0,
            z: 0,
            duration: 0.9,
            ease: "power3.out",
            delay: index * 0.04,
            scrollTrigger: {
              trigger: card,
              scroller: scrollEl,
              start: "top 90%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>("[data-kpi]").forEach((kpi, index) => {
        gsap.fromTo(
          kpi,
          { autoAlpha: 0, y: 20 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            delay: 0.15 + index * 0.08,
            ease: "power3.out",
            scrollTrigger: {
              trigger: kpi,
              scroller: scrollEl,
              start: "top 92%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      const boxes = gsap.utils.toArray<HTMLElement>("[data-inventory-box]");
      boxes.forEach((box, index) => {
        gsap.fromTo(
          box,
          { y: 36 + index * 10, autoAlpha: 0 },
          {
            y: -index * 14,
            autoAlpha: 1,
            duration: 0.95,
            ease: "power3.out",
            delay: index * 0.08,
            scrollTrigger: {
              trigger: box.parentElement || box,
              scroller: scrollEl,
              start: "top 88%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>("[data-scan-line]").forEach((line) => {
        gsap.fromTo(
          line,
          { autoAlpha: 0, x: -24, scaleX: 0.92 },
          {
            autoAlpha: 1,
            x: 0,
            scaleX: 1,
            duration: 0.85,
            ease: "power3.out",
            scrollTrigger: {
              trigger: line,
              scroller: scrollEl,
              start: "top 90%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>("[data-receipt]").forEach((receipt) => {
        gsap.fromTo(
          receipt,
          { autoAlpha: 0, y: -28 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.95,
            ease: "power3.out",
            scrollTrigger: {
              trigger: receipt,
              scroller: scrollEl,
              start: "top 92%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>("[data-outbox-item]").forEach((item, index) => {
        gsap.fromTo(
          item,
          { autoAlpha: 0, x: -12 },
          {
            autoAlpha: 1,
            x: 0,
            duration: 0.55,
            delay: index * 0.1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: item.parentElement || item,
              scroller: scrollEl,
              start: "top 88%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      gsap.utils.toArray<SVGPathElement>("[data-chart-line]").forEach((line) => {
        const length = line.getTotalLength();
        gsap.fromTo(
          line,
          { strokeDasharray: length, strokeDashoffset: length },
          {
            strokeDashoffset: 0,
            duration: 1.2,
            ease: "power2.out",
            scrollTrigger: {
              trigger: line,
              scroller: scrollEl,
              start: "top 90%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>("[data-transfer-dot]").forEach((dot, index) => {
        gsap.fromTo(
          dot,
          { autoAlpha: 0.2, scale: 0.6 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: 0.45,
            delay: index * 0.12,
            ease: "power2.out",
            scrollTrigger: {
              trigger: dot.parentElement || dot,
              scroller: scrollEl,
              start: "top 90%",
              toggleActions: "play none none none",
            },
          },
        );
      });
    }, root);

    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [rootRef, scroller]);
}
