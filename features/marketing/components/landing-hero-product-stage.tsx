"use client";

import { useRef } from "react";
import Image from "next/image";
import { BRANDING } from "@/constants/branding";
import { useLandingHeroParallax } from "@/features/marketing/hooks/use-landing-hero-parallax";

/**
 * Hero stage — transparent POS shell with a cast shadow (right + base).
 */
export function LandingHeroProductStage() {
  const parallaxRef = useRef<HTMLDivElement>(null);
  useLandingHeroParallax(parallaxRef);

  return (
    <div className="landing-v2-stage-scene">
      <div className="landing-v2-stage-aura" aria-hidden />

      <div className="landing-v2-perspective">
        <div ref={parallaxRef} className="landing-v2-parallax">
          <div className="landing-v2-stage">
            <div className="landing-v2-device">
              <span className="landing-v2-device-shadow" aria-hidden />
              <div className="landing-v2-device-main">
                <Image
                  src={BRANDING.landingHeroMonitor}
                  alt="Novend POS all-in-one display"
                  width={1024}
                  height={1024}
                  priority
                  className="landing-v2-device-img h-auto w-full object-contain"
                  sizes="(max-width: 768px) 92vw, 560px"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
