"use client";

import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  CloudUpload,
  Database,
  Laptop,
  Monitor,
  Package,
  Receipt,
  RefreshCw,
  Shield,
  ShoppingCart,
  Split,
  Tablet,
  WifiOff,
} from "lucide-react";
import { landingCopy } from "@/features/marketing/content";
import {
  architectureActiveNode,
  useArchitectureSyncCycle,
  type ArchitectureSyncPhase,
} from "@/features/marketing/hooks/use-architecture-sync-cycle";
import { cn } from "@/lib/utils";

const FLOW_VISUALS = {
  device: DeviceVisual,
  local: LocalVisual,
  sync: SyncVisual,
  dashboard: DashboardVisual,
} as const;

const GUARANTEE_ICONS = {
  selling: WifiOff,
  ownership: Shield,
  backup: CloudUpload,
  branches: Split,
} as const;

/** Section 3 — offline trust & differentiation on Novend Onyx. */
export function LandingArchitecture() {
  const { phase, cycle } = useArchitectureSyncCycle();
  const activeNode = architectureActiveNode(phase);
  const copy = landingCopy.architecture;

  return (
    <section
      id="architecture"
      className="landing-arch-section scroll-mt-24 bg-[#111827] px-4 text-white sm:px-6 lg:px-8"
      aria-labelledby="architecture-heading"
    >
      <div className="mx-auto max-w-6xl">
        <header data-reveal className="mx-auto max-w-[680px] text-center">
          <p className="text-[#38BDF8] text-[13px] font-semibold tracking-[0.14em] uppercase">
            {copy.badge}
          </p>
          <h2
            id="architecture-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-tight"
          >
            {copy.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300 text-pretty sm:text-lg">
            {copy.subtitle}
          </p>
        </header>

        <div data-reveal className="mt-12 sm:mt-16">
          <SyncStatusBar phase={phase} />
        </div>

        <ol
          data-reveal
          className="landing-arch-flow mt-8 sm:mt-10"
          aria-label="How Novend keeps your store running"
        >
          {copy.flow.map((node, index) => {
            const Visual = FLOW_VISUALS[node.id as keyof typeof FLOW_VISUALS];
            const isActive = activeNode === node.id;
            const isLit = phase === "dashboard" && node.id === "dashboard";

            return (
              <li key={node.id} className="landing-arch-flow-item">
                <article
                  className={cn(
                    "landing-arch-flow-card landing-shadow-onyx",
                    isActive && "landing-arch-flow-card-active",
                    isLit && "landing-arch-flow-card-lit",
                  )}
                  data-active={isActive || undefined}
                >
                  <div className="landing-arch-flow-visual" aria-hidden>
                    <Visual phase={phase} cycle={cycle} active={isActive} />
                  </div>
                  <p className="text-[#38BDF8] text-[11px] font-bold tracking-[0.16em] uppercase">
                    {node.label}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-white">
                    {node.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{node.detail}</p>
                </article>

                {index < copy.flow.length - 1 ? (
                  <div
                    className={cn(
                      "landing-arch-connector",
                      shouldPulseConnector(phase, index) && "landing-arch-connector-active",
                    )}
                    aria-hidden
                  >
                    <span className="landing-arch-connector-line" />
                    <ChevronDown className="landing-arch-connector-chevron landing-arch-connector-chevron-mobile" />
                    <ChevronRight className="landing-arch-connector-chevron landing-arch-connector-chevron-desktop" />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>

        <ul
          data-reveal
          className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5"
        >
          {copy.guarantees.map((item) => {
            const Icon = GUARANTEE_ICONS[item.id as keyof typeof GUARANTEE_ICONS] ?? Receipt;
            return (
              <li
                key={item.id}
                className="landing-arch-kpi landing-shadow-onyx rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#38BDF8]/12 text-[#38BDF8]">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-4 text-base font-semibold tracking-tight text-white">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{item.detail}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function SyncStatusBar({ phase }: { phase: ArchitectureSyncPhase }) {
  const labels = landingCopy.architecture.syncCycle;
  const { message, badge, tone } = statusForPhase(phase, labels);

  return (
    <div
      className="landing-arch-status mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 sm:px-5"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("landing-arch-status-dot", `landing-arch-status-dot-${tone}`)} />
        <p className="truncate text-sm text-slate-200">{message}</p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] uppercase",
          tone === "ok" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
          tone === "warn" && "border-amber-400/30 bg-amber-400/10 text-amber-200",
          tone === "info" && "border-[#38BDF8]/30 bg-[#38BDF8]/10 text-[#7DD3FC]",
          tone === "idle" && "border-white/15 bg-white/5 text-slate-300",
        )}
      >
        {badge}
      </span>
    </div>
  );
}

function statusForPhase(
  phase: ArchitectureSyncPhase,
  labels: (typeof landingCopy.architecture)["syncCycle"],
): { message: string; badge: string; tone: "idle" | "info" | "warn" | "ok" } {
  switch (phase) {
    case "sale":
      return { message: labels.sale, badge: labels.offline, tone: "info" };
    case "local":
      return { message: "Written to this device", badge: labels.offline, tone: "info" };
    case "pending":
      return { message: "Waiting for a connection", badge: labels.pending, tone: "warn" };
    case "reconnect":
      return { message: labels.reconnect, badge: labels.pending, tone: "info" };
    case "syncing":
      return { message: labels.uploading, badge: labels.pending, tone: "info" };
    case "synced":
      return { message: "All changes secure in the cloud", badge: labels.synced, tone: "ok" };
    case "dashboard":
      return { message: labels.dashboard, badge: labels.synced, tone: "ok" };
    default:
      return {
        message: "Never lose a completed sale — continue working during outages.",
        badge: "Ready",
        tone: "idle",
      };
  }
}

function shouldPulseConnector(phase: ArchitectureSyncPhase, index: number) {
  if (index === 0) return phase === "sale" || phase === "local";
  if (index === 1) return phase === "pending" || phase === "reconnect";
  if (index === 2) return phase === "syncing" || phase === "synced" || phase === "dashboard";
  return false;
}

type SceneProps = {
  phase: ArchitectureSyncPhase;
  cycle: number;
  active: boolean;
};

function DeviceVisual({ active }: SceneProps) {
  return (
    <div className={cn("landing-arch-scene", active && "landing-arch-scene-active")}>
      <Monitor className="landing-arch-scene-icon landing-arch-scene-icon-lg" />
      <Laptop className="landing-arch-scene-icon landing-arch-scene-icon-md" />
      <Tablet className="landing-arch-scene-icon landing-arch-scene-icon-sm" />
      <ShoppingCart className="landing-arch-scene-badge" />
    </div>
  );
}

function LocalVisual({ phase, active }: SceneProps) {
  const flowing = phase === "local" || phase === "sale";
  return (
    <div className={cn("landing-arch-scene", active && "landing-arch-scene-active")}>
      <Database className="landing-arch-scene-icon landing-arch-scene-icon-lg" />
      <Receipt className="landing-arch-scene-icon landing-arch-scene-icon-md" />
      <Package className="landing-arch-scene-icon landing-arch-scene-icon-sm" />
      <span className={cn("landing-arch-particles", flowing && "landing-arch-particles-on")} />
    </div>
  );
}

function SyncVisual({ phase, cycle, active }: SceneProps) {
  const spinning = phase === "syncing" || phase === "reconnect";
  return (
    <div className={cn("landing-arch-scene", active && "landing-arch-scene-active")}>
      <RefreshCw
        className={cn(
          "landing-arch-scene-icon landing-arch-scene-icon-lg",
          spinning && "landing-arch-spin",
        )}
      />
      <span
        className={cn(
          "landing-arch-pulse-ring",
          (phase === "reconnect" || phase === "syncing") && "landing-arch-pulse-ring-on",
        )}
      />
      {phase === "syncing" ? (
        <span key={cycle} className="landing-arch-progress landing-arch-progress-on" />
      ) : (
        <span className="landing-arch-progress" />
      )}
    </div>
  );
}

function DashboardVisual({ phase, active }: SceneProps) {
  const lit = phase === "dashboard" || phase === "synced";
  return (
    <div
      className={cn(
        "landing-arch-scene",
        active && "landing-arch-scene-active",
        lit && "landing-arch-scene-lit",
      )}
    >
      <BarChart3 className="landing-arch-scene-icon landing-arch-scene-icon-lg" />
      <Building2 className="landing-arch-scene-icon landing-arch-scene-icon-md" />
      <span className="landing-arch-chart-bars" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
