"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useNativeShell } from "@/hooks/use-native-shell";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  /** Count of advanced filters that differ from defaults (search excluded). */
  activeCount?: number;
  onReset?: () => void;
  defaultOpen?: boolean;
  /**
   * Search (or other primary control) — rendered on the same row as the Filters
   * button, which stays on the right.
   */
  leading?: ReactNode;
  className?: string;
};

/** Search stays outside the panel. Filters trigger sits inline on the right. */
export function CollapsibleFilters({
  children,
  activeCount = 0,
  onReset,
  defaultOpen = false,
  leading,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const native = useNativeShell();

  const trigger = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <ListFilter className="size-4" />
        Filters
        {!native ? (
          open ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )
        ) : null}
        {activeCount > 0 ? (
          <Badge variant="secondary" className="ml-1">
            {activeCount}
          </Badge>
        ) : null}
      </Button>
      {open && onReset && !native ? (
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
      ) : null}
    </div>
  );

  const toolbar = leading ? (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 w-full flex-1 sm:max-w-md">{leading}</div>
      <div className="flex w-full shrink-0 justify-end sm:w-auto">{trigger}</div>
    </div>
  ) : (
    <div className="flex justify-end">{trigger}</div>
  );

  if (native) {
    return (
      <div className={cn("space-y-3", className)}>
        {toolbar}
        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
          <DrawerContent className="rounded-t-[22px] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="border-border flex flex-row items-center justify-between border-b text-left">
              <DrawerTitle>Filters</DrawerTitle>
              {onReset ? (
                <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                  Reset
                </Button>
              ) : null}
            </DrawerHeader>
            <div className="flex flex-col gap-3 px-4 py-4">{children}</div>
            <div className="border-border border-t px-4 py-3">
              <Button type="button" className="min-h-12 w-full" onClick={() => setOpen(false)}>
                Apply
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {toolbar}
      {open ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">{children}</div>
      ) : null}
    </div>
  );
}
