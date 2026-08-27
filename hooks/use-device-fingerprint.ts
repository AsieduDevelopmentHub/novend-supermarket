"use client";

import { useEffect, useState } from "react";
import { getDeviceFingerprint } from "@/lib/device";

/** Client-only fingerprint. Avoids caching an empty SSR value in useMemo. */
export function useDeviceFingerprint() {
  const [fingerprint, setFingerprint] = useState("");
  useEffect(() => {
    setFingerprint(getDeviceFingerprint());
  }, []);
  return fingerprint;
}
