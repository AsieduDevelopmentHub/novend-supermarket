"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Props = {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
};

/**
 * Light pull-to-refresh for list pages on touch devices.
 */
export function PullToRefresh({ onRefresh, children, className, disabled }: Props) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const finish = useCallback(async () => {
    if (pull < 64 || refreshing || disabled) {
      setPull(0);
      return;
    }
    setRefreshing(true);
    setPull(56);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  }, [disabled, onRefresh, pull, refreshing]);

  return (
    <div
      ref={scrollerRef}
      className={cn("relative", className)}
      onTouchStart={(e) => {
        if (disabled || refreshing) return;
        const el = scrollerRef.current;
        const scrollParent = el?.closest("main") ?? el;
        if (scrollParent && "scrollTop" in scrollParent && (scrollParent as HTMLElement).scrollTop > 0) {
          startY.current = null;
          return;
        }
        startY.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchMove={(e) => {
        if (startY.current == null || disabled || refreshing) return;
        const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
        if (dy > 0) setPull(Math.min(96, dy * 0.45));
      }}
      onTouchEnd={() => {
        void finish();
        startY.current = null;
      }}
    >
      <div
        className="pointer-events-none flex items-center justify-center overflow-hidden transition-[height] duration-150"
        style={{ height: pull || (refreshing ? 40 : 0) }}
        aria-hidden
      >
        {refreshing || pull > 40 ? (
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        ) : null}
      </div>
      {children}
    </div>
  );
}
