export type LicensePayload = {
  v: 1;
  /** Customer / store label for support. */
  c: string;
  /** Issued at (unix ms). */
  i: number;
  /** License expiry (unix ms). null/omit = perpetual. */
  e?: number | null;
  /** Optional machine bind at issue time. */
  m?: string | null;
};

export type LicensePersistedState = {
  version: 1;
  trialStartedAt: number;
  licenseKey: string | null;
  customer: string | null;
  issuedAt: number | null;
  licenseExpiresAt: number | null;
  boundMachineId: string | null;
  activatedAt: number | null;
};

export type LicenseAccessMode = "dev" | "licensed" | "trial" | "blocked";

export type LicenseStatus = {
  mode: LicenseAccessMode;
  allowed: boolean;
  machineId: string;
  customer: string | null;
  trialStartedAt: number;
  trialEndsAt: number;
  trialDaysRemaining: number;
  licenseExpiresAt: number | null;
  boundMachineId: string | null;
  reason: string | null;
};
