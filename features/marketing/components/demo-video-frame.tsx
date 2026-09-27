"use client";

import { useEffect, useState, type RefObject } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  /** Brandmark shown as a soft watermark before playback. */
  poster: string;
  videoRef?: RefObject<HTMLVideoElement | null>;
  className?: string;
  frameClassName?: string;
};

/**
 * 16:9 marketing video frame with a book-style Novend watermark.
 * Soft opacity on the navy stage — not a hard opaque thumbnail collage.
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
        <video
          key={src}
          ref={videoRef}
          className="h-full w-full object-contain"
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          onPlay={() => setPlaying(true)}
          onPause={(event) => {
            if (event.currentTarget.currentTime < 0.35) setPlaying(false);
          }}
          onEnded={() => setPlaying(false)}
        >
          <source src={src} type="video/mp4" />
          Your browser does not support embedded video.
        </video>

        {!playing ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#071426]"
            aria-hidden
          >
            <Image
              src={poster}
              alt=""
              width={200}
              height={200}
              unoptimized
              className="h-20 w-20 object-contain opacity-[0.28] sm:h-28 sm:w-28 sm:opacity-[0.32]"
              sizes="112px"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
