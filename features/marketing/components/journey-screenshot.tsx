"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { JourneyStepFrame } from "@/constants/journey-step-frame";

type Props = {
  alt: string;
  src: string;
  priority?: boolean;
  frame: JourneyStepFrame;
};

/** Sharp screenshot with contain (modals) or cover (full pages) — no transform zoom. */
export function JourneyScreenshot({ alt, src, priority = false, frame }: Props) {
  const isCover = frame.fit === "cover";

  return (
    <div
      className={cn(
        "landing-journey-v2-shot",
        isCover ? "landing-journey-v2-shot-cover" : "landing-journey-v2-shot-contain",
      )}
      style={
        isCover && frame.objectPosition
          ? ({ "--journey-object-position": frame.objectPosition } as CSSProperties)
          : undefined
      }
    >
      <Image
        src={src}
        alt={alt}
        width={1920}
        height={1080}
        quality={100}
        unoptimized
        priority={priority}
        className="landing-journey-v2-shot-image"
        sizes="(max-width: 1024px) 100vw, 640px"
        draggable={false}
      />
    </div>
  );
}
