"use client";

import { CloudUpload, MonitorSmartphone, WifiOff } from "lucide-react";
import { landingCopy } from "@/features/marketing/content";
import {
  useOfflineFlowCycle,
  type OfflineFlowPhase,
} from "@/features/marketing/hooks/use-offline-flow-cycle";
import { cn } from "@/lib/utils";

/** Dark offline-first technical story panel with cinematic sync cycle. */
export function LandingOfflineFlow() {
  const { offlineFlow } = landingCopy;
  const { phase } = useOfflineFlowCycle();

  return (
    <section
      id="offline-sync"
      className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-[1240px]">
        <div
          className="landing-ofs-panel relative overflow-hidden rounded-[24px] bg-[#071426] px-4 py-12 text-white sm:rounded-[32px] sm:px-10 sm:py-20 lg:px-14 lg:py-24"
          data-phase={phase}
        >
          <div className="landing-ofs-grid" aria-hidden />
          <div className="landing-ofs-glow landing-ofs-glow-left" aria-hidden />
          <div className="landing-ofs-glow landing-ofs-glow-center" aria-hidden />
          <div className="landing-ofs-glow landing-ofs-glow-right" aria-hidden />

          <header data-reveal className="relative z-[1] mx-auto max-w-2xl text-center">
            <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
              {offlineFlow.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
              {offlineFlow.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-pretty text-slate-300 sm:text-lg">
              {offlineFlow.detail}
            </p>
          </header>

          <div
            data-reveal
            className="relative z-[1] mt-10 sm:mt-14"
            role="img"
            aria-label="Offline detection, local engine, and automatic reconnection"
          >
            <OfflineSyncScene phase={phase} />
          </div>

          <div
            data-reveal
            className="relative z-[1] mt-8 flex flex-col items-stretch gap-2 rounded-[16px] border border-white/10 bg-[#0A1628]/80 px-3.5 py-3 text-center text-xs text-slate-300 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-5 sm:gap-y-2 sm:px-4 sm:text-left sm:text-sm"
            role="status"
            aria-live="polite"
          >
            <span className="inline-flex items-center justify-center gap-2 sm:justify-start">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  phase === "offline" ? "bg-rose-400" : "bg-emerald-400",
                )}
                aria-hidden
              />
              {phase === "offline"
                ? offlineFlow.scene.offline.status
                : offlineFlow.statusStrip.operational}
            </span>
            <span className="hidden h-3 w-px bg-white/15 sm:block" aria-hidden />
            <span className="text-slate-400 sm:text-slate-300">
              {phase === "local"
                ? offlineFlow.scene.local.processing
                : offlineFlow.statusStrip.queue}
            </span>
            <span className="hidden h-3 w-px bg-white/15 sm:block" aria-hidden />
            <span className="text-slate-400 sm:text-slate-300">
              {phase === "reconnect"
                ? offlineFlow.scene.reconnect.status
                : offlineFlow.statusStrip.connected}
            </span>
          </div>

          <p
            data-reveal
            className="relative z-[1] mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-slate-500"
          >
            {offlineFlow.qualification}
          </p>
        </div>
      </div>
    </section>
  );
}

function OfflineSyncScene({ phase }: { phase: OfflineFlowPhase }) {
  const { scene } = landingCopy.offlineFlow;

  return (
    <div className="landing-ofs-scene">
      <article
        className={cn(
          "landing-ofs-card landing-ofs-card-offline",
          phase === "offline" && "landing-ofs-card-active",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "landing-ofs-icon landing-ofs-icon-offline",
              phase === "offline" && "landing-ofs-icon-live",
            )}
          >
            <WifiOff className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-rose-400/90 uppercase">
            {scene.offline.stateLabel}
          </span>
        </div>
        <h3 className="mt-4 text-base font-semibold tracking-tight text-white sm:mt-5 sm:text-xl">
          {scene.offline.title}
        </h3>
        <p className="mt-2 inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.12em] text-rose-300/90 uppercase sm:text-[11px]">
          <span className="landing-ofs-status-dot landing-ofs-status-dot-offline" aria-hidden />
          {scene.offline.status}
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-slate-400 sm:mt-3 sm:text-sm">
          {scene.offline.detail}
        </p>
      </article>

      <div
        className={cn(
          "landing-ofs-hub",
          phase === "local" && "landing-ofs-hub-active",
          phase === "reconnect" && "landing-ofs-hub-syncing",
        )}
      >
        <div className="landing-ofs-hub-rings" aria-hidden>
          <span className="landing-ofs-ring landing-ofs-ring-outer" />
          <span className="landing-ofs-ring landing-ofs-ring-mid" />
          <span className="landing-ofs-ring landing-ofs-ring-inner" />
        </div>
        <div className="landing-ofs-hub-core">
          <span className="landing-ofs-hub-icon">
            <MonitorSmartphone className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
          </span>
          <h3 className="mt-3 text-center text-base font-semibold tracking-tight text-white sm:mt-4 sm:text-xl">
            {scene.local.title}
          </h3>
          <p className="mt-2 max-w-[17rem] text-center text-[13px] leading-relaxed text-slate-400 sm:max-w-[16rem] sm:text-sm">
            {scene.local.detail}
          </p>
          <span className="landing-ofs-processing mt-4 sm:mt-5">
            <span className="landing-ofs-eq" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="font-mono text-[10px] font-bold tracking-[0.18em]">
              {scene.local.processing}
            </span>
          </span>
        </div>
      </div>

      <article
        className={cn(
          "landing-ofs-card landing-ofs-card-reconnect",
          phase === "reconnect" && "landing-ofs-card-active",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-sky-400/90 uppercase">
            {scene.reconnect.stateLabel}
          </span>
          <span
            className={cn(
              "landing-ofs-icon landing-ofs-icon-reconnect",
              phase === "reconnect" && "landing-ofs-icon-live",
            )}
          >
            <CloudUpload
              className={cn("h-5 w-5", phase === "reconnect" && "landing-ofs-spin")}
              aria-hidden
            />
          </span>
        </div>
        <h3 className="mt-4 text-base font-semibold tracking-tight text-white sm:mt-5 sm:text-xl">
          {scene.reconnect.title}
        </h3>
        <p className="mt-2 inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.12em] text-sky-300/90 uppercase sm:text-[11px]">
          <span className="landing-ofs-status-dot landing-ofs-status-dot-reconnect" aria-hidden />
          {scene.reconnect.status}
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-slate-400 sm:mt-3 sm:text-sm">
          {scene.reconnect.detail}
        </p>
      </article>
    </div>
  );
}
