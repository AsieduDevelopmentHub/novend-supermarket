"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useNativeShell } from "@/hooks/use-native-shell";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  /** Desktop dialog width classes */
  dialogClassName?: string;
  /** Prefer drawer on Capacitor; dialog elsewhere (and always on large screens if forceDialog). */
  forceDialog?: boolean;
};

/**
 * Capacitor / phone: bottom sheet with drag-to-dismiss.
 * Desktop / Electron: centered dialog.
 */
export function ResponsiveFormSurface({
  open,
  onOpenChange,
  title,
  children,
  dialogClassName,
  forceDialog = false,
}: Props) {
  const native = useNativeShell();
  const useSheet = native && !forceDialog;

  if (useSheet) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent
          className={cn(
            "max-h-[92dvh] rounded-t-[22px]",
            "pb-[max(1rem,env(safe-area-inset-bottom))]",
          )}
        >
          <DrawerHeader className="border-border border-b text-left">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto", dialogClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
