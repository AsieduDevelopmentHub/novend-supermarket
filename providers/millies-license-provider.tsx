"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  activateLicenseKey,
  getLicenseStatus,
  startLicenseTrial,
  type LicenseStatus,
} from "@/lib/millies-license";

type MilliesLicenseContextValue = {
  ready: boolean;
  status: LicenseStatus | null;
  refresh: () => Promise<void>;
  activate: (key: string) => Promise<void>;
  startTrial: () => Promise<void>;
};

const MilliesLicenseContext = createContext<MilliesLicenseContextValue | null>(null);

export function MilliesLicenseProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<LicenseStatus | null>(null);

  const refresh = useCallback(async () => {
    const next = await getLicenseStatus();
    setStatus(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await getLicenseStatus();
        if (!cancelled) setStatus(next);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activate = useCallback(
    async (key: string) => {
      await activateLicenseKey(key);
      await refresh();
    },
    [refresh],
  );

  const startTrial = useCallback(async () => {
    await startLicenseTrial();
    await refresh();
  }, [refresh]);

  return (
    <MilliesLicenseContext.Provider
      value={{ ready, status, refresh, activate, startTrial }}
    >
      {children}
    </MilliesLicenseContext.Provider>
  );
}

export function useMilliesLicense(): MilliesLicenseContextValue {
  const ctx = useContext(MilliesLicenseContext);
  if (!ctx) throw new Error("useMilliesLicense must be used within MilliesLicenseProvider");
  return ctx;
}
