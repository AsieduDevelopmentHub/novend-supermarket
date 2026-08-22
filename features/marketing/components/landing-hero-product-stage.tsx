"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import {
  Boxes,
  Cloud,
  Package,
  Receipt,
  ScanBarcode,
  WifiOff,
} from "lucide-react";
import { BRANDING } from "@/constants/branding";
import { formatCurrency } from "@/lib/currency";
import { useLandingHeroParallax } from "@/features/marketing/hooks/use-landing-hero-parallax";

type OrbitProps = {
  className: string;
  delay?: string;
  children: ReactNode;
};

function OrbitChip({ className, delay, children }: OrbitProps) {
  return (
    <div
      className={`landing-v2-orbit ${className}`}
      style={delay ? { animationDelay: delay } : undefined}
    >
      {children}
    </div>
  );
}

/** 3D isometric product stage — dashboard monitor with orbiting commerce elements. */
export function LandingHeroProductStage() {
  const parallaxRef = useRef<HTMLDivElement>(null);
  useLandingHeroParallax(parallaxRef);

  useEffect(() => {
    const line = parallaxRef.current?.querySelector<SVGPathElement>("[data-hero-chart-line]");
    if (!line || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const length = line.getTotalLength();
    line.style.strokeDasharray = `${length}`;
    line.style.strokeDashoffset = `${length}`;
    requestAnimationFrame(() => {
      line.style.transition = "stroke-dashoffset 1.4s ease-out";
      line.style.strokeDashoffset = "0";
    });
  }, []);

  return (
    <div className="landing-v2-stage-scene">
      <div className="landing-v2-commerce-grid" aria-hidden />

      <div className="landing-v2-perspective">
        <div ref={parallaxRef} className="landing-v2-parallax">
          <div className="landing-v2-stage">
            <div className="landing-v2-monitor">
              <div className="landing-v2-monitor-screen">
                <Image
                  src={BRANDING.dashboardHero}
                  alt="Novend POS dashboard with KPI cards, sales chart, and analytics"
                  width={1280}
                  height={800}
                  priority
                  className="h-full w-full object-cover object-left-top"
                  sizes="(max-width: 768px) 90vw, 520px"
                />
                <svg
                  className="landing-v2-chart-overlay pointer-events-none absolute inset-0 h-full w-full"
                  viewBox="0 0 400 120"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    data-hero-chart-line
                    d="M0,90 L40,75 L80,82 L120,55 L160,60 L200,35 L240,42 L280,22 L320,30 L360,12 L400,18"
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="landing-v2-monitor-chin" aria-hidden />
              <div className="landing-v2-monitor-stand" aria-hidden />
            </div>

            <OrbitChip className="landing-v2-orbit-receipt" delay="0s">
              <Receipt className="text-[#111827] h-4 w-4" aria-hidden />
              <div>
                <p className="text-[10px] font-semibold">INV-1035</p>
                <p className="text-muted-foreground text-[9px]">{formatCurrency(280)}</p>
              </div>
            </OrbitChip>

            <OrbitChip className="landing-v2-orbit-scanner" delay="-1.2s">
              <ScanBarcode className="text-primary h-4 w-4" aria-hidden />
              <span className="text-[10px] font-medium">Scan ready</span>
            </OrbitChip>

            <OrbitChip className="landing-v2-orbit-product" delay="-2.4s">
              <Package className="text-[#111827] h-4 w-4" aria-hidden />
              <div>
                <p className="text-[10px] font-semibold">Peeva 500ml</p>
                <p className="text-primary text-[9px] font-semibold">75 units</p>
              </div>
            </OrbitChip>

            <OrbitChip className="landing-v2-orbit-inventory" delay="-0.6s">
              <Boxes className="text-[#111827] h-4 w-4" aria-hidden />
              <span className="text-[10px] font-medium">Warehouse</span>
            </OrbitChip>

            <OrbitChip className="landing-v2-orbit-sync landing-v2-kpi-glow" delay="-1.8s">
              <Cloud className="text-primary h-3.5 w-3.5" aria-hidden />
              <span className="text-[10px] font-semibold text-emerald-600">Synced</span>
            </OrbitChip>

            <div
              className="landing-v2-orbit landing-v2-orbit-kpi landing-v2-kpi-glow"
              style={{ animationDelay: "-3s" }}
            >
              <WifiOff className="text-primary h-3.5 w-3.5" aria-hidden />
              <div>
                <p className="text-muted-foreground text-[9px]">Today</p>
                <p className="text-[11px] font-semibold tabular-nums">{formatCurrency(18010)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
