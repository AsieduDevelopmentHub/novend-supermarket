"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { BRANDING } from "@/constants/branding";
import { APP_BRAND } from "@/constants/app";
import { cn } from "@/lib/utils";

type Props = {
  /** Optional status line under the logo (screen-reader friendly). */
  label?: string;
  /** Show `label` visibly under the tagline (not sr-only). */
  showLabel?: boolean;
  /** Fade-out state while transitioning away. */
  exiting?: boolean;
  /** Escape / recovery actions under the splash (e.g. stuck sign-out). */
  footer?: ReactNode;
  className?: string;
};

/** Soft brand-colored fragments that burst on logo impact. */
const PARTICLES = [
  { x: -72, y: -28, delay: "0ms", size: 5 },
  { x: -48, y: 18, delay: "20ms", size: 4 },
  { x: -28, y: -42, delay: "40ms", size: 3 },
  { x: 18, y: -48, delay: "10ms", size: 4 },
  { x: 42, y: -22, delay: "30ms", size: 5 },
  { x: 68, y: 12, delay: "50ms", size: 3 },
  { x: 52, y: 36, delay: "15ms", size: 4 },
  { x: -8, y: 44, delay: "35ms", size: 3 },
  { x: -58, y: -8, delay: "55ms", size: 4 },
  { x: 8, y: -56, delay: "25ms", size: 3 },
  { x: 78, y: -8, delay: "45ms", size: 4 },
  { x: -36, y: 40, delay: "5ms", size: 3 },
] as const;

/** Full-viewport branded splash used during app startup / auth bootstrap. */
export function AppSplash({
  label = "Loading…",
  showLabel = false,
  exiting = false,
  footer,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "bg-sidebar fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden",
        exiting ? "animate-splash-out pointer-events-none" : null,
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy={!exiting}
    >
      <div className="relative flex flex-col items-center">
        <div className="relative flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40">
          <div className="animate-splash-impact absolute inset-0 rounded-full" aria-hidden />

          <div className="animate-splash-fall relative z-10 h-full w-full">
            <Image
              src={BRANDING.brandmark}
              alt={APP_BRAND}
              fill
              unoptimized
              sizes="160px"
              className="object-contain drop-shadow-sm"
            />
          </div>

          <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
            {PARTICLES.map((particle, index) => (
              <span
                key={index}
                className="animate-splash-particle absolute top-1/2 left-1/2 rounded-full bg-[color:var(--primary)]"
                style={{
                  width: particle.size,
                  height: particle.size,
                  marginLeft: -particle.size / 2,
                  marginTop: -particle.size / 2,
                  // Custom properties drive the scatter keyframes
                  ["--px" as string]: `${particle.x}px`,
                  ["--py" as string]: `${particle.y}px`,
                  animationDelay: particle.delay,
                  opacity: 0.85,
                }}
              />
            ))}
          </div>
        </div>

        <p className="animate-splash-caption mt-8 text-sm tracking-[0.18em] text-white/70 uppercase">
          Smart POS. Strong business.
        </p>
        {showLabel ? (
          <p className="mt-4 text-sm font-medium text-white/90">{label}</p>
        ) : (
          <p className="sr-only">{label}</p>
        )}
        {footer ? <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}
