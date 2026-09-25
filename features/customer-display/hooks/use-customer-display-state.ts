"use client";

import { useEffect, useState } from "react";
import {
  idleCustomerDisplaySnapshot,
  readCustomerDisplaySnapshot,
  subscribeCustomerDisplaySnapshot,
  type CustomerDisplayBranding,
  type CustomerDisplaySnapshot,
} from "@/lib/sales/customer-display";
import { loadPrintSnapshotMeta } from "@/lib/offline/ui-cache";
import { loadShellProfile } from "@/lib/offline/shell-profile";
import { loadLicenseSnapshot } from "@/lib/offline/license";
import { DEFAULT_NOVEND_EXPERIENCE } from "@/convex/shared/experience";

function mergeBranding(
  snapshot: CustomerDisplaySnapshot,
  fallback: CustomerDisplayBranding,
): CustomerDisplaySnapshot {
  const tradeName =
    snapshot.branding.tradeName && snapshot.branding.tradeName !== "Novend POS"
      ? snapshot.branding.tradeName
      : fallback.tradeName;
  return {
    ...snapshot,
    branding: {
      tradeName,
      branchName: snapshot.branding.branchName ?? fallback.branchName,
      thankYouLine: snapshot.branding.thankYouLine ?? fallback.thankYouLine,
      accent: snapshot.branding.accent ?? fallback.accent ?? null,
      accentForeground:
        snapshot.branding.accentForeground ?? fallback.accentForeground ?? null,
    },
  };
}

/** Subscribe to live cart snapshots for the customer-facing screen. */
export function useCustomerDisplayState() {
  const [fallbackBranding, setFallbackBranding] = useState<CustomerDisplayBranding>({
    tradeName: "Novend POS",
    branchName: null,
    thankYouLine: null,
  });

  const [snapshot, setSnapshot] = useState<CustomerDisplaySnapshot>(() => {
    if (typeof window === "undefined") {
      return idleCustomerDisplaySnapshot();
    }
    return readCustomerDisplaySnapshot() ?? idleCustomerDisplaySnapshot();
  });

  useEffect(() => {
    void (async () => {
      const [printSnapshot, shell, license] = await Promise.all([
        loadPrintSnapshotMeta(),
        loadShellProfile(),
        loadLicenseSnapshot(),
      ]);
      setFallbackBranding({
        tradeName:
          printSnapshot?.business.tradeName ||
          printSnapshot?.business.legalName ||
          shell?.organizationName ||
          "Novend POS",
        branchName: shell?.branchName ?? null,
        thankYouLine: printSnapshot?.template.thankYouLine ?? null,
        accent: license?.experience?.accent ?? DEFAULT_NOVEND_EXPERIENCE.accent,
        accentForeground:
          license?.experience?.accentForeground ?? DEFAULT_NOVEND_EXPERIENCE.accentForeground,
      });
    })();
  }, []);

  useEffect(
    () =>
      subscribeCustomerDisplaySnapshot((next) => {
        setSnapshot(mergeBranding(next, fallbackBranding));
      }),
    [fallbackBranding],
  );

  useEffect(() => {
    queueMicrotask(() => {
      setSnapshot((current) => mergeBranding(current, fallbackBranding));
    });
  }, [fallbackBranding]);

  return snapshot;
}
