"use client";

import { useRef } from "react";
import Image from "next/image";
import { BRANDING } from "@/constants/branding";
import { useLandingHeroParallax } from "@/features/marketing/hooks/use-landing-hero-parallax";

/** 3D floating render of the real Novend dashboard — signature hero visual. */
export function LandingDashboardStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  useLandingHeroParallax(stageRef);

  return (
    <div
      data-depth-stage
      className="landing-dashboard-stage landing-depth-preserve relative mx-auto w-full max-w-[720px]"
    >
      <div className="landing-dashboard-glow" aria-hidden />
      <div
        ref={stageRef}
        className="landing-dashboard-frame landing-shadow-mock border-border bg-background relative z-10 overflow-hidden rounded-[1.25rem] border transition-transform duration-200 ease-out will-change-transform"
      >
        <Image
          src={BRANDING.dashboardHero}
          alt="Novend POS dashboard showing sales KPIs, charts, and recent orders"
          width={1440}
          height={900}
          priority
          className="h-auto w-full object-cover object-left-top"
          sizes="(max-width: 768px) 100vw, 720px"
        />
      </div>
      <div
        data-kpi
        className="landing-float-kpi landing-shadow-float border-border bg-card absolute top-[8%] right-0 z-20 hidden rounded-xl border px-3.5 py-2.5 lg:block lg:translate-x-[18%]"
      >
        <p className="text-muted-foreground text-[9px]">Total sales</p>
        <p className="text-foreground text-sm font-semibold tabular-nums">GH₵18,010</p>
      </div>
      <div
        data-kpi
        className="landing-float-kpi landing-shadow-float border-border bg-card absolute bottom-[12%] left-0 z-20 hidden rounded-xl border px-3.5 py-2.5 lg:block lg:-translate-x-[16%]"
      >
        <p className="text-muted-foreground text-[9px]">Orders today</p>
        <p className="text-foreground text-sm font-semibold tabular-nums">35</p>
      </div>
    </div>
  );
}
