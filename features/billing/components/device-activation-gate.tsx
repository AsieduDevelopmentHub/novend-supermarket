"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { useDeviceActivation } from "@/hooks/use-device-activation";

/**
 * Registers this terminal and, if the plan has no activation slot left, tells
 * the user how to fix it. The rest of the app stays usable behind the dialog so
 * a cashier is never locked out of a shift by a licensing message.
 */
export function DeviceActivationGate({ enabled }: { enabled: boolean }) {
  const { status, message } = useDeviceActivation(enabled);
  const { isAdmin } = usePermissions();
  const [dismissed, setDismissed] = useState(false);

  return (
    <Dialog open={status === "blocked" && !dismissed} onOpenChange={() => setDismissed(true)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Device limit reached</DialogTitle>
          <DialogDescription>
            {message ??
              "This device could not be activated because your plan has no activation slots left."}
          </DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          {isAdmin
            ? "Deactivate a terminal you no longer use, or upgrade your plan to add more."
            : "Ask an administrator to free a device slot or upgrade the plan."}
        </p>
        <DialogFooter>
          {isAdmin ? (
            <Button asChild>
              <Link href="/settings?section=devices">Manage devices</Link>
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setDismissed(true)}>
            Continue anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
