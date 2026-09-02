"use client";

import { useEffect, useRef } from "react";
import {
  idleCustomerDisplaySnapshot,
  publishCustomerDisplaySnapshot,
  readCustomerDisplaySnapshot,
} from "@/lib/sales/customer-display";
import { loadPrintSnapshotMeta } from "@/lib/offline/ui-cache";
import { loadShellProfile } from "@/lib/offline/shell-profile";

/** Push org branding to the bundled customer display before the cashier opens Sales. */
export function useCustomerDisplayBrandingSeed(enabled: boolean) {
  const seededRef = useRef(false);

  useEffect(() => {
    if (!enabled || seededRef.current) return;

    void (async () => {
      const existing = readCustomerDisplaySnapshot();
      if (existing && existing.phase !== "idle") {
        seededRef.current = true;
        return;
      }

      const [printSnapshot, shell] = await Promise.all([
        loadPrintSnapshotMeta(),
        loadShellProfile(),
      ]);

      const branding = {
        tradeName:
          printSnapshot?.business.tradeName ||
          printSnapshot?.business.legalName ||
          shell?.organizationName ||
          "Novend POS",
        branchName: shell?.branchName ?? null,
        thankYouLine: printSnapshot?.template.thankYouLine ?? null,
      };

      publishCustomerDisplaySnapshot(idleCustomerDisplaySnapshot(branding));
      seededRef.current = true;
    })();
  }, [enabled]);
}
