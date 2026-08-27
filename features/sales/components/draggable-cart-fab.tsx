"use client";

import { useEffect, useRef, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerLightHaptic } from "@/lib/haptics";

const STORAGE_KEY = "novend.cartFab.position";
const DRAG_THRESHOLD_PX = 8;
const FAB_SIZE_PX = 56;
const EDGE_PAD_PX = 12;

type FabPosition = { x: number; y: number };

function clampPosition(x: number, y: number): FabPosition {
  if (typeof window === "undefined") return { x, y };
  const maxX = Math.max(EDGE_PAD_PX, window.innerWidth - FAB_SIZE_PX - EDGE_PAD_PX);
  const maxY = Math.max(EDGE_PAD_PX, window.innerHeight - FAB_SIZE_PX - EDGE_PAD_PX);
  return {
    x: Math.min(maxX, Math.max(EDGE_PAD_PX, x)),
    y: Math.min(maxY, Math.max(EDGE_PAD_PX, y)),
  };
}

function defaultPosition(bottomInsetPx: number): FabPosition {
  if (typeof window === "undefined") return { x: EDGE_PAD_PX, y: EDGE_PAD_PX };
  return clampPosition(
    window.innerWidth - FAB_SIZE_PX - 16,
    window.innerHeight - FAB_SIZE_PX - bottomInsetPx,
  );
}

function readStoredPosition(bottomInsetPx: number): FabPosition {
  if (typeof window === "undefined") return defaultPosition(bottomInsetPx);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPosition(bottomInsetPx);
    const parsed = JSON.parse(raw) as Partial<FabPosition>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
      return defaultPosition(bottomInsetPx);
    }
    return clampPosition(parsed.x, parsed.y);
  } catch {
    return defaultPosition(bottomInsetPx);
  }
}

type DraggableCartFabProps = {
  itemCount: number;
  totalLabel: string;
  bottomInsetPx: number;
  onOpen: () => void;
};

/**
 * Floating sales cart control — candy-blue, drag to reposition, tap to open checkout.
 */
export function DraggableCartFab({
  itemCount,
  totalLabel,
  bottomInsetPx,
  onOpen,
}: DraggableCartFabProps) {
  const [position, setPosition] = useState<FabPosition>(() => defaultPosition(bottomInsetPx));
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setPosition(readStoredPosition(bottomInsetPx));
    });
  }, [bottomInsetPx]);

  useEffect(() => {
    const onResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <button
      type="button"
      className={cn(
        "novend-cart-fab fixed z-30 flex size-14 touch-none items-center justify-center rounded-full",
        "text-slate-950 shadow-[0_8px_28px_rgba(14,165,233,0.55),0_0_0_1px_rgba(186,230,253,0.45)]",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        dragging ? "cursor-grabbing scale-[1.04]" : "cursor-grab active:scale-[0.98]",
      )}
      style={{ left: position.x, top: position.y }}
      aria-label={
        itemCount > 0 ? `Open cart, ${itemCount} items, ${totalLabel}` : "Open cart"
      }
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: position.x,
          originY: position.y,
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        drag.moved = true;
        setDragging(true);
        setPosition(clampPosition(drag.originX + dx, drag.originY + dy));
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          /* already released */
        }
        dragRef.current = null;
        setDragging(false);
        if (drag.moved) {
          setPosition((prev) => {
            const next = clampPosition(prev.x, prev.y);
            try {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
              /* ignore quota / private mode */
            }
            return next;
          });
          return;
        }
        void triggerLightHaptic();
        onOpen();
      }}
      onPointerCancel={() => {
        dragRef.current = null;
        setDragging(false);
      }}
    >
      <ShoppingCart className="relative z-10 size-6" aria-hidden />
      <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-950 px-1 text-[11px] font-semibold text-sky-100 tabular-nums shadow-sm">
        {itemCount > 99 ? "99+" : itemCount}
      </span>
    </button>
  );
}
