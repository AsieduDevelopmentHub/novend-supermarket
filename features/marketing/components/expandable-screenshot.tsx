"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { Expand } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  children: ReactNode;
  className?: string;
};

/** Click-to-expand marketing screenshot (journey, features — not hero). */
export function ExpandableScreenshot({ src, alt, children, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "landing-expandable-shot group/shot relative block w-full cursor-zoom-in text-left",
          className,
        )}
        aria-label={`View larger: ${alt}`}
      >
        {children}
        <span className="landing-expandable-hint" aria-hidden>
          <Expand className="h-3.5 w-3.5" />
          <span>Expand</span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            "landing-screenshot-lightbox border-white/10 bg-[#0f172a] p-0 text-white sm:rounded-2xl",
            "fixed top-1/2 left-1/2 z-50 max-h-[92dvh] w-[min(96vw,1120px)] max-w-[min(96vw,1120px)]",
            "-translate-x-1/2 -translate-y-1/2 gap-0 overflow-hidden shadow-2xl",
          )}
        >
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <div className="max-h-[92dvh] overflow-auto bg-[#0f172a]">
            <Image
              src={src}
              alt={alt}
              width={1920}
              height={1080}
              quality={100}
              unoptimized
              className="h-auto w-full object-contain"
              sizes="96vw"
              priority
              draggable={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
