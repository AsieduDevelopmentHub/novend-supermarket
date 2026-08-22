"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BRANDING } from "@/constants/branding";
import { landingCopy } from "@/features/marketing/content";

function useCountUp(target: number, active: boolean, durationMs = 1200) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;

    let frame = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      setValue(Math.round(target * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target, durationMs]);

  return value;
}

/** Analytics section — reuses the real dashboard screenshot managers recognize. */
export function LandingAnalyticsShowcase() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const orders = useCountUp(35, visible);
  const skus = useCountUp(128, visible);

  return (
    <section
      ref={ref}
      id="analytics"
      className="scroll-mt-24 border-t border-border bg-[#F8FAFC] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div data-reveal>
            <p className="text-primary text-sm font-semibold tracking-wide">
              {landingCopy.analytics.eyebrow}
            </p>
            <h2 className="text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {landingCopy.analytics.title}
            </h2>
            <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
              {landingCopy.analytics.subtitle}
            </p>
            <dl className="mt-8 grid grid-cols-2 gap-4">
              <div className="landing-shadow-card border-border bg-card rounded-2xl border p-4">
                <dt className="text-muted-foreground text-xs">Orders</dt>
                <dd className="text-foreground mt-1 text-2xl font-semibold tabular-nums">{orders}</dd>
              </div>
              <div className="landing-shadow-card border-border bg-card rounded-2xl border p-4">
                <dt className="text-muted-foreground text-xs">Active SKUs</dt>
                <dd className="text-foreground mt-1 text-2xl font-semibold tabular-nums">{skus}</dd>
              </div>
            </dl>
          </div>
          <div data-reveal className="landing-perspective">
            <div className="landing-shadow-mock overflow-hidden rounded-[1.25rem] border border-border bg-background">
              <Image
                src={BRANDING.dashboardHero}
                alt="Novend analytics dashboard with KPI cards and sales charts"
                width={1440}
                height={900}
                className="h-auto w-full object-cover object-left-top"
                sizes="(max-width: 1024px) 100vw, 560px"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
