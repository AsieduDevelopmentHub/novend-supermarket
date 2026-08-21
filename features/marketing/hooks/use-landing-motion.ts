"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Options = {
  /** Scroll container (landing uses overflow-y on a div, not window). */
  scroller: RefObject<HTMLElement | null>;
  /** CSS selector relative to the root element. */
  targets?: string;
  y?: number;
  duration?: number;
  start?: string;
};

/**
 * Vital-Go-like scroll reveals via GSAP ScrollTrigger.
 * Respects prefers-reduced-motion.
 */
export function useLandingReveal(
  rootRef: RefObject<HTMLElement | null>,
  {
    scroller,
    targets = "[data-reveal]",
    y = 40,
    duration = 1,
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

/** Hero entrance — runs once on mount (not scroll). */
export function useLandingHeroIntro(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from("[data-hero-brand]", { autoAlpha: 0, y: 16, duration: 0.7 })
        .from("[data-hero-copy] > *", { autoAlpha: 0, y: 28, duration: 0.8, stagger: 0.1 }, "-=0.35")
        .from("[data-hero-visual]", { autoAlpha: 0, y: 44, scale: 0.96, duration: 1.05 }, "-=0.55")
        .from(
          "[data-hero-orb]",
          { autoAlpha: 0, scale: 0.82, duration: 1.15, stagger: 0.12, ease: "power2.out" },
          "-=0.95",
        );
    }, root);

    return () => ctx.revert();
  }, [rootRef]);
}

/**
 * Scroll-linked 3D depth — product stage, feature panels, pricing cards.
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
          { rotateY: -18, rotateX: 10, z: -80 },
          {
            rotateY: 8,
            rotateX: -4,
            z: 0,
            ease: "none",
            scrollTrigger: {
              trigger: stage,
              scroller: scrollEl,
              start: "top 80%",
              end: "bottom 20%",
              scrub: 1.1,
            },
          },
        );
      }

      gsap.utils.toArray<HTMLElement>("[data-depth-panel]").forEach((panel, index) => {
        const fromY = index % 2 === 0 ? 48 : 64;
        gsap.fromTo(
          panel,
          { autoAlpha: 0, y: fromY, rotateX: 14, z: -60 },
          {
            autoAlpha: 1,
            y: 0,
            rotateX: 0,
            z: 0,
            duration: 1.05,
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
          { autoAlpha: 0, y: 56, rotateY: index % 2 === 0 ? -12 : 12, z: -40 },
          {
            autoAlpha: 1,
            y: 0,
            rotateY: 0,
            z: 0,
            duration: 0.95,
            ease: "power3.out",
            delay: index * 0.05,
            scrollTrigger: {
              trigger: card,
              scroller: scrollEl,
              start: "top 90%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((layer) => {
        const speed = Number(layer.dataset.parallaxSpeed || 40);
        gsap.to(layer, {
          y: speed,
          ease: "none",
          scrollTrigger: {
            trigger: layer.parentElement || layer,
            scroller: scrollEl,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      });

      const iso = root.querySelector<HTMLElement>("[data-iso-device]");
      if (iso) {
        gsap.fromTo(
          iso,
          { rotateY: -22, rotateX: 16, z: -50, autoAlpha: 0.7 },
          {
            rotateY: 10,
            rotateX: -6,
            z: 0,
            autoAlpha: 1,
            ease: "none",
            scrollTrigger: {
              trigger: iso,
              scroller: scrollEl,
              start: "top 85%",
              end: "bottom 25%",
              scrub: 1.2,
            },
          },
        );
      }

      gsap.utils.toArray<HTMLElement>("[data-kpi]").forEach((kpi, index) => {
        gsap.fromTo(
          kpi,
          { autoAlpha: 0, y: 36, z: -30 },
          {
            autoAlpha: 1,
            y: 0,
            z: 0,
            duration: 0.9,
            ease: "power3.out",
            delay: index * 0.08,
            scrollTrigger: {
              trigger: kpi,
              scroller: scrollEl,
              start: "top 92%",
              toggleActions: "play none none none",
            },
          },
        );
        gsap.to(kpi, {
          y: index % 2 === 0 ? -18 : 14,
          ease: "none",
          scrollTrigger: {
            trigger: kpi.parentElement || kpi,
            scroller: scrollEl,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      });

      const boxes = gsap.utils.toArray<HTMLElement>("[data-inventory-box]");
      if (boxes.length) {
        boxes.forEach((box, index) => {
          gsap.fromTo(
            box,
            { y: 48 + index * 12, rotateX: 24, autoAlpha: 0 },
            {
              y: -index * 18,
              rotateX: 0,
              autoAlpha: 1,
              duration: 1,
              ease: "power3.out",
              delay: index * 0.1,
              scrollTrigger: {
                trigger: box.parentElement || box,
                scroller: scrollEl,
                start: "top 88%",
                toggleActions: "play none none none",
              },
            },
          );
        });
      }
    }, root);

    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [rootRef, scroller]);
}
