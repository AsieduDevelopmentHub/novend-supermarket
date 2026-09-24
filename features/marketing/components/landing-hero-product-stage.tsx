import Image from "next/image";
import { BRANDING } from "@/constants/branding";

/**
 * Hero stage — POS all-in-one monitor shell with soft aura.
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

      <div className="absolute bottom-4 left-2 z-10 sm:bottom-8 sm:left-4">
        <div className="inline-flex items-center gap-2.5 rounded-[16px] border border-white/60 bg-white/90 px-3.5 py-2.5 shadow-[0_16px_40px_-20px_rgba(11,18,32,0.45)] backdrop-blur-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <div className="min-w-0 text-left">
            <p className="text-[12px] font-semibold tracking-tight text-[#0B1220]">Offline mode</p>
            <p className="text-[11px] text-[#526174]">Changes ready to sync after setup</p>
          </div>
        </div>
      </div>
    </div>
  );
}
