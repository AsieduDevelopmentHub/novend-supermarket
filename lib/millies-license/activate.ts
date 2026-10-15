import { formatLicenseKeyForDisplay, verifyLicenseKey } from "./crypto";
import {
  readPersistedLicenseState,
  resolveMachineId,
  writePersistedLicenseState,
} from "./storage";
import type { LicensePersistedState } from "./types";
import { getLicenseStatus } from "./status";

/** Start the offline trial clock (once). No network. */
export async function startLicenseTrial(): Promise<LicensePersistedState> {
  const existing = await readPersistedLicenseState();
  if (existing.trialStartedAt > 0) return existing;
  return writePersistedLicenseState({
    ...existing,
    version: 1,
    trialStartedAt: Date.now(),
  });
}

export async function activateLicenseKey(rawKey: string): Promise<LicensePersistedState> {
  const machineId = await resolveMachineId();
  const payload = await verifyLicenseKey(rawKey);

  if (payload.m && payload.m !== machineId) {
    throw new Error(
      "This license key is locked to a different machine. Ask for a key for this PC.",
    );
  }

  const existing = await readPersistedLicenseState();
  const next: LicensePersistedState = {
    ...existing,
    version: 1,
    licenseKey: formatLicenseKeyForDisplay(rawKey),
    customer: payload.c,
    issuedAt: payload.i,
    licenseExpiresAt: payload.e ?? null,
    boundMachineId: machineId,
    activatedAt: Date.now(),
  };

  const saved = await writePersistedLicenseState(next);
  const status = await getLicenseStatus();
  if (!status.allowed || status.mode !== "licensed") {
    throw new Error(status.reason ?? "License could not be activated on this machine");
  }
  return saved;
}
