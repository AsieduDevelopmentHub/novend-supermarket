import Image from "next/image";
import { BRANDING } from "@/constants/branding";

/**
 * V3 hero product visual — reference-style all-in-one monitor with soft blue base glow.
 * Uses the marketing render (not orbiting chips).
 */
export function LandingHeroProductStage() {
  return (
    <div className="landing-v3-hero-stage relative mx-auto w-full max-w-[560px] lg:max-w-none">
      <div
        className="landing-v3-hero-glow pointer-events-none absolute inset-x-[12%] bottom-[4%] h-[28%] rounded-full bg-[#38BDF8]/35 blur-3xl"
        aria-hidden
      />
      <Image
        src={BRANDING.landingHeroMonitor}
        alt="Novend POS dashboard on a desktop monitor"
        width={1024}
        height={1024}
        priority
        className="relative z-10 h-auto w-full object-contain drop-shadow-[0_28px_60px_rgba(15,23,42,0.18)]"
        sizes="(max-width: 1024px) 90vw, 540px"
      />
    </div>
  );
}
