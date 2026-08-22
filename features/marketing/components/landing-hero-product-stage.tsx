"use client";

import { useRef, type ReactNode } from "react";
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

/**
 * Hero stage — commercial POS all-in-one terminal with full dashboard
 * (object-contain so nothing is cropped) + 3D / orbit motion.
 */
export function LandingHeroProductStage() {
  const parallaxRef = useRef<HTMLDivElement>(null);
  useLandingHeroParallax(parallaxRef);

  return (
    <div className="landing-v2-stage-scene">
      <div
        className="pointer-events-none absolute inset-x-[14%] bottom-[2%] h-[24%] rounded-full bg-[#38BDF8]/22 blur-3xl"
        aria-hidden
      />

      <div className="landing-v2-perspective">
        <div ref={parallaxRef} className="landing-v2-parallax">
          <div className="landing-v2-stage">
            <div className="landing-pos-terminal">
              {/* Top bar / camera strip */}
              <div className="landing-pos-terminal-top" aria-hidden>
                <span className="landing-pos-terminal-cam" />
                <span className="landing-pos-terminal-led" />
              </div>

              <div className="landing-pos-terminal-bezel">
                <div className="landing-pos-terminal-screen">
                  <Image
                    src={BRANDING.dashboardHero}
                    alt="Novend POS dashboard — Newton Test Stall"
                    width={1920}
                    height={1080}
                    priority
                    className="h-full w-full object-contain object-left-top"
                    sizes="(max-width: 768px) 92vw, 560px"
                  />
                </div>
              </div>

              {/* Bottom chin with soft keys / brand strip */}
              <div className="landing-pos-terminal-chin" aria-hidden>
                <span className="landing-pos-terminal-brand">novend</span>
                <span className="landing-pos-terminal-keys">
                  <i />
                  <i />
                  <i />
                </span>
              </div>

              {/* Stand — commercial POS foot */}
              <div className="landing-pos-terminal-neck" aria-hidden />
              <div className="landing-pos-terminal-base" aria-hidden />
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
