"use client";

import {
  BarChart3,
  CloudUpload,
  Database,
  Laptop,
  RefreshCw,
  Shield,
  ShoppingCart,
  Split,
  WifiOff,
} from "lucide-react";
import { landingCopy } from "@/features/marketing/content";
import {
  architectureActiveNode,
  useArchitectureSyncCycle,
  type ArchitectureSyncPhase,
} from "@/features/marketing/hooks/use-architecture-sync-cycle";
import { LandingSection } from "@/features/marketing/components/landing-section";
import { cn } from "@/lib/utils";

const GUARANTEE_ICONS = {
  selling: WifiOff,
  ownership: Shield,
  backup: CloudUpload,
  branches: Split,
} as const;

const FLOW_NODE_ICONS = {
  device: ShoppingCart,
  local: Database,
  sync: RefreshCw,
  dashboard: BarChart3,
} as const;

/**
 * Offline trust section — light canvas matching the rest of the landing page,
 * with a how-it-works-style flow diagram instead of dark plan-style cards.
 */
export function LandingArchitecture() {
  const { phase } = useArchitectureSyncCycle();
  const activeNode = architectureActiveNode(phase);
  const copy = landingCopy.architecture;

  return (
    <LandingSection
      id="architecture"
      tone="mist"
      className="landing-arch-section px-4 text-[#111827] sm:px-6 lg:px-8"
      aria-labelledby="architecture-heading"
    >
      <div className="mx-auto max-w-6xl">
        <header data-reveal className="mx-auto max-w-[680px] text-center">
          <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
            {copy.badge}
          </p>
          <h2
            id="architecture-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#111827] sm:text-4xl lg:text-[2.75rem] lg:leading-tight"
          >
            {copy.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-pretty text-slate-600 sm:text-lg">
            {copy.subtitle}
          </p>
        </header>

        <div data-reveal className="mt-10 sm:mt-12">
          <SyncStatusBar phase={phase} />
        </div>

        <div data-reveal className="mt-8 sm:mt-10">
          <OfflineFlowDiagram phase={phase} activeNode={activeNode} />
        </div>

        <ul
          data-reveal
          className="mt-10 grid gap-3 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4"
        >
          {copy.guarantees.map((item) => {
            const Icon = GUARANTEE_ICONS[item.id as keyof typeof GUARANTEE_ICONS] ?? Shield;
            return (
              <li
                key={item.id}
                className="landing-surface-card rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur-sm"
              >
                <div className="bg-primary/12 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <h3 className="mt-3 text-sm font-semibold tracking-tight text-[#111827]">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
                  {item.detail}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </LandingSection>
  );
}

function SyncStatusBar({ phase }: { phase: ArchitectureSyncPhase }) {
  const labels = landingCopy.architecture.syncCycle;
  const { message, badge, tone } = statusForPhase(phase, labels);

  return (
    <div
      className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.35)] sm:px-5"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("landing-arch-status-dot", `landing-arch-status-dot-${tone}`)} />
        <p className="truncate text-sm text-slate-700">{message}</p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] uppercase",
          tone === "ok" && "border-emerald-500/25 bg-emerald-50 text-emerald-700",
          tone === "warn" && "border-amber-500/25 bg-amber-50 text-amber-800",
          tone === "info" && "border-primary/25 bg-primary/10 text-primary",
          tone === "idle" && "border-slate-200 bg-slate-50 text-slate-600",
        )}
      >
        {badge}
      </span>
    </div>
  );
}

/**
 * Single diagram composition (how-it-works style): connected nodes, not a
 * row of marketing plan cards.
 */
function OfflineFlowDiagram({
  phase,
  activeNode,
}: {
  phase: ArchitectureSyncPhase;
  activeNode: ReturnType<typeof architectureActiveNode>;
}) {
  const flow = landingCopy.architecture.flow;

  return (
    <div
      className="landing-offline-diagram landing-surface-card relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/80 px-4 py-8 backdrop-blur-sm sm:px-8 sm:py-10"
      aria-label="How Novend keeps your store running"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 20%, rgba(13,148,136,0.12), transparent 42%), radial-gradient(circle at 82% 70%, rgba(56,189,248,0.10), transparent 40%)",
        }}
      />

      <ol className="landing-offline-flow relative z-[1]">
        {flow.map((node, index) => {
          const Icon = FLOW_NODE_ICONS[node.id as keyof typeof FLOW_NODE_ICONS] ?? Laptop;
          const isActive = activeNode === node.id;
          const isLit = phase === "dashboard" && node.id === "dashboard";

          return (
            <li key={node.id} className="landing-offline-flow-item">
              <article
                className={cn(
                  "landing-offline-node",
                  isActive && "landing-offline-node-active",
                  isLit && "landing-offline-node-lit",
                )}
              >
                <span
                  className={cn(
                    "landing-offline-node-icon",
                    isActive && "landing-offline-node-icon-active",
                    node.id === "sync" &&
                      (phase === "syncing" || phase === "reconnect") &&
                      "landing-arch-spin",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-primary text-[10px] font-bold tracking-[0.14em] uppercase">
                  {node.label}
                </p>
                <h3 className="mt-1 text-sm font-semibold tracking-tight text-[#111827] sm:text-base">
                  {node.title}
                </h3>
                <p className="mt-1 hidden text-xs leading-relaxed text-slate-600 sm:block">
                  {node.detail}
                </p>
              </article>

              {index < flow.length - 1 ? (
                <div
                  className={cn(
                    "landing-offline-connector",
                    shouldPulseConnector(phase, index) && "landing-offline-connector-active",
                  )}
                  aria-hidden
                >
                  <span className="landing-offline-connector-line" />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <p className="relative z-[1] mt-6 text-center text-xs text-slate-500 sm:hidden">
        {flow.find((node) => node.id === activeNode)?.detail ??
          "Sell on device first, then sync when you reconnect."}
      </p>
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
