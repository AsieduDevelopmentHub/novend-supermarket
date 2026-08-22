"use client";

import { useRef } from "react";
import Image from "next/image";
import { BRANDING } from "@/constants/branding";
import { useLandingHeroParallax } from "@/features/marketing/hooks/use-landing-hero-parallax";

/**
 * Hero stage — realistic POS shell (glow baked into the asset) with the live
 * dashboard composited on the screen.
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
              <Image
                src={BRANDING.landingHeroMonitor}
                alt="Novend POS on an all-in-one display"
                width={1536}
                height={1024}
                priority
                className="landing-v2-device-img h-auto w-full object-contain"
                sizes="(max-width: 768px) 92vw, 560px"
              />

              <div className="landing-v2-device-reflection" aria-hidden>
                <Image
                  src={BRANDING.landingHeroMonitor}
                  alt=""
                  width={1536}
                  height={1024}
                  className="h-auto w-full object-contain"
                  sizes="(max-width: 768px) 70vw, 420px"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
