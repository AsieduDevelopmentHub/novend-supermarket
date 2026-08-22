import Image from "next/image";
import { BRANDING } from "@/constants/branding";

/**
 * Hero stage — transparent POS shell with cast shadow and a calm float.
 */
export function LandingHeroProductStage() {
  return (
    <div className="landing-v2-stage-scene">
      <div className="landing-v2-stage-aura" aria-hidden />

      <div className="landing-v2-perspective">
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
  );
}
