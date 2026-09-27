"use client";

import { useEffect, useState, type RefObject } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  /** Brandmark (or other logo) shown before playback. */
  poster: string;
  videoRef?: RefObject<HTMLVideoElement | null>;
  className?: string;
  frameClassName?: string;
};

/**
 * 16:9 marketing video frame with Novend logo poster overlay.
 * Native `poster` alone stretches a square brandmark across the frame;
 * the overlay keeps the logo centered on the navy stage until play.
 */
export function DemoVideoFrame({ src, poster, videoRef, className, frameClassName }: Props) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlaying(false);
  }, [src]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-[#071426] p-1.5 shadow-[0_24px_48px_-28px_rgba(7,20,38,0.55)] sm:rounded-[28px] sm:p-3",
        className,
      )}
    >
      <div
        className={cn(
          "relative aspect-video overflow-hidden rounded-[14px] bg-[#071426] sm:rounded-[22px]",
          frameClassName,
        )}
      >
        {!playing ? (
          <div
            className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-[#071426]"
            aria-hidden
          >
            <Image
              src={poster}
              alt=""
              width={160}
              height={160}
              unoptimized
              className="h-16 w-16 object-contain opacity-95 sm:h-24 sm:w-24"
              sizes="96px"
            />
          </div>
        ) : null}
        <video
          key={src}
          ref={videoRef}
          className="relative z-[2] h-full w-full object-contain"
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          poster={poster}
          onPlay={() => setPlaying(true)}
          onPause={(event) => {
            if (event.currentTarget.currentTime < 0.35) setPlaying(false);
          }}
          onEnded={() => setPlaying(false)}
        >
          <source src={src} type="video/mp4" />
          Your browser does not support embedded video.
        </video>
      </div>
    </div>
  );
}
