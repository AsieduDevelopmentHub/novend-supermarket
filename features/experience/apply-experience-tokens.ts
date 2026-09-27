/**
 * Maps resolved organization experience tokens onto CSS custom properties.
 * Pure DOM helper — safe to call from layout boot before React paint completes.
 */

import {
  DEFAULT_NOVEND_EXPERIENCE,
  deriveChartPalette,
  type ExperienceRadiusScale,
  type ResolvedExperienceTokens,
} from "@/convex/shared/experience";

const RADIUS_BY_SCALE: Record<ExperienceRadiusScale, string> = {
  compact: "0.5rem",
  default: "0.75rem",
  soft: "1rem",
};

export function applyExperienceTokens(
  tokens: ResolvedExperienceTokens,
  options?: { version?: number; target?: HTMLElement },
): void {
  if (typeof document === "undefined") return;
  const root = options?.target ?? document.documentElement;
  const charts = deriveChartPalette(tokens.accent);
  root.style.setProperty("--primary", tokens.accent);
  root.style.setProperty("--primary-foreground", tokens.accentForeground);
  // Focus chrome follows brand accent (org overrides historically left focusRing on Candy Blue).
  root.style.setProperty("--ring", tokens.accent);
  root.style.setProperty("--chart-1", charts.chart1);
  root.style.setProperty("--chart-2", charts.chart2);
  root.style.setProperty("--chart-3", charts.chart3);
  root.style.setProperty("--chart-4", charts.chart4);
  root.style.setProperty("--chart-5", charts.chart5);
  root.style.setProperty("--sidebar", tokens.sidebarBackground);
  root.style.setProperty("--sidebar-foreground", tokens.sidebarForeground);
  root.style.setProperty("--sidebar-accent", tokens.sidebarAccent);
  root.style.setProperty("--sidebar-accent-foreground", tokens.sidebarAccentForeground);
  root.style.setProperty("--sidebar-primary", tokens.accent);
  root.style.setProperty("--sidebar-primary-foreground", tokens.accentForeground);
  root.style.setProperty("--destructive", tokens.danger);
  root.style.setProperty("--success", tokens.success);
  root.style.setProperty("--warning", tokens.warning);
  root.style.setProperty("--radius", RADIUS_BY_SCALE[tokens.radiusScale] ?? RADIUS_BY_SCALE.default);

  if (options?.version !== undefined) {
    root.setAttribute("data-experience-version", String(options.version));
  }
}

export function applyDefaultExperienceTokens(options?: { target?: HTMLElement }): void {
  applyExperienceTokens(DEFAULT_NOVEND_EXPERIENCE, {
    version: 0,
    target: options?.target,
  });
}

export function clearExperienceTokenOverrides(options?: { target?: HTMLElement }): void {
  if (typeof document === "undefined") return;
  const root = options?.target ?? document.documentElement;
  const keys = [
    "--primary",
    "--primary-foreground",
    "--ring",
    "--chart-1",
    "--chart-2",
    "--chart-3",
    "--chart-4",
    "--chart-5",
    "--sidebar",
    "--sidebar-foreground",
    "--sidebar-accent",
    "--sidebar-accent-foreground",
    "--sidebar-primary",
    "--sidebar-primary-foreground",
    "--destructive",
    "--success",
    "--warning",
    "--radius",
  ];
  for (const key of keys) {
    root.style.removeProperty(key);
  }
  root.removeAttribute("data-experience-version");
}
