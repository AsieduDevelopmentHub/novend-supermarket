"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useNativeShell } from "@/hooks/use-native-shell";

type Props = {
  children: ReactNode;
  /** Count of advanced filters that differ from defaults (search excluded). */
  activeCount?: number;
  onReset?: () => void;
  defaultOpen?: boolean;
};

/** Search stays outside. Advanced filters collapse — bottom sheet on Capacitor. */
export function CollapsibleFilters({
  children,
  activeCount = 0,
  onReset,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const native = useNativeShell();

  const trigger = (
    <div className="flex flex-wrap items-center gap-2">
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

  if (native) {
    return (
      <div className="space-y-3">
        {trigger}
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
    <div className="space-y-3">
      {trigger}
      {open ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">{children}</div>
      ) : null}
    </div>
  );
}
