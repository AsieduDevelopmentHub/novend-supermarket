"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/date";
import { Hardware } from "@novend/hardware";

type SalesTillClockProps = {
  /** Show Fix date & time CTA (offline / no reliable server clock). */
  showFixCta: boolean;
};

/** Live till clock on checkout — receipts use this device time until sync. */
export function SalesTillClock({ showFixCta }: SalesTillClockProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function onFixDateTime() {
    const result = await Hardware.app.openDateTimeSettings();
    if (!result.ok) {
      toast.message(result.message ?? "Open your device Date & Time settings.");
      return;
    }
    if (result.message) {
      toast.message(result.message);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="text-muted-foreground flex min-w-0 items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Till clock · <span className="text-foreground tabular-nums">{formatDateTime(now)}</span>
        </span>
      </p>
      {showFixCta ? (
        <Button type="button" variant="link" className="h-auto shrink-0 px-0 text-xs" onClick={() => void onFixDateTime()}>
          Fix date & time
        </Button>
      ) : null}
    </div>
  );
}
