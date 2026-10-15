import { TRIAL_DAYS } from "./constants";
import { verifyLicenseKey } from "./crypto";
import {
  isLicenseDevBypass,
  readPersistedLicenseState,
  resolveMachineId,
} from "./storage";
import type { LicenseStatus } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function getLicenseStatus(now = Date.now()): Promise<LicenseStatus> {
  const [machineId, state, devBypass] = await Promise.all([
    resolveMachineId(),
    readPersistedLicenseState(),
    isLicenseDevBypass(),
  ]);

  const trialStarted = state.trialStartedAt > 0;
  const trialEndsAt = trialStarted ? state.trialStartedAt + TRIAL_DAYS * MS_PER_DAY : 0;
  const trialDaysRemaining = trialStarted
    ? Math.max(0, Math.ceil((trialEndsAt - now) / MS_PER_DAY))
    : TRIAL_DAYS;

  const base = {
    machineId,
    customer: state.customer,
    trialStartedAt: state.trialStartedAt,
    trialEndsAt,
    trialDaysRemaining,
    licenseExpiresAt: state.licenseExpiresAt,
    boundMachineId: state.boundMachineId,
  };

  if (devBypass) {
    return {
      ...base,
      mode: "dev",
      allowed: true,
      reason: null,
    };
  }

  if (state.licenseKey) {
    try {
      const payload = await verifyLicenseKey(state.licenseKey);
      if (payload.m && payload.m !== machineId) {
        return {
          ...base,
          mode: "blocked",
          allowed: false,
          reason: "This license is locked to a different machine.",
        };
      }
      if (state.boundMachineId && state.boundMachineId !== machineId) {
        return {
          ...base,
          mode: "blocked",
          allowed: false,
          reason:
            "This installation is licensed for another PC. Contact support for a transfer.",
        };
      }
      if (payload.e != null && payload.e > 0 && now > payload.e) {
        return {
          ...base,
          mode: "blocked",
          allowed: false,
          reason: "Your license has expired. Request a renewed key.",
        };
      }
      return {
        ...base,
        mode: "licensed",
        allowed: true,
        customer: payload.c,
        licenseExpiresAt: payload.e ?? null,
        reason: null,
      };
    } catch {
      // Fall through to trial / blocked
    }
  }

  if (trialStarted && now <= trialEndsAt) {
    return {
      ...base,
      mode: "trial",
      allowed: true,
      reason: null,
    };
  }

  if (!trialStarted) {
    return {
      ...base,
      mode: "blocked",
      allowed: false,
      reason: `Enter a license key, or start your ${TRIAL_DAYS}-day offline trial.`,
    };
  }

  return {
    ...base,
    mode: "blocked",
    allowed: false,
    reason: `Your ${TRIAL_DAYS}-day trial has ended. Enter a license key to continue.`,
  };
}
