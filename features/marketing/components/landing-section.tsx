import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SurfaceTone = "default" | "soft" | "mist" | "pearl" | "sky";

type LandingSectionProps = {
  id?: string;
  tone?: SurfaceTone;
  className?: string;
  children: ReactNode;
  "aria-labelledby"?: string;
};

const TONE_CLASS: Record<SurfaceTone, string> = {
  default: "bg-[#F8FAFC]",
  soft: "bg-[#F1F5F9]/60",
  mist: "bg-[#EFF6FF]/70",
  pearl: "bg-white",
  sky: "bg-gradient-to-b from-[#F0F9FF] to-[#F8FAFC]",
};

/**
 * Marketing section shell — tonal surfaces and spacing only.
 * No decorative blobs; product screenshots carry visual weight.
 */
export function LandingSection({
  id,
  tone = "default",
  className,
  children,
  "aria-labelledby": labelledBy,
}: LandingSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn("relative scroll-mt-24", TONE_CLASS[tone], className)}
    >
      {children}
    </section>
  );
}
