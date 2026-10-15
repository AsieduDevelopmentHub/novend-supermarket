import type { LicensePersistedState } from "./types";

const BROWSER_STORAGE_KEY = "millies.licenseState";
const MACHINE_ID_KEY = "millies.browserMachineId";

/** trialStartedAt === 0 means the user has not started the trial yet (gate shows). */
function defaultState(): LicensePersistedState {
  return {
    version: 1,
    trialStartedAt: 0,
    licenseKey: null,
    customer: null,
    issuedAt: null,
    licenseExpiresAt: null,
    boundMachineId: null,
    activatedAt: null,
  };
}

function readBrowserState(): LicensePersistedState {
  try {
    const raw = localStorage.getItem(BROWSER_STORAGE_KEY);
    if (!raw) {
      const initial = defaultState();
      localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<LicensePersistedState>;
    return {
      ...defaultState(),
      ...parsed,
      version: 1,
      trialStartedAt:
        typeof parsed.trialStartedAt === "number" && Number.isFinite(parsed.trialStartedAt)
          ? parsed.trialStartedAt
          : 0,
    };
  } catch {
    const initial = defaultState();
    try {
      localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(initial));
    } catch {
      /* private mode */
    }
    return initial;
  }
}

function writeBrowserState(state: LicensePersistedState): LicensePersistedState {
  const next = { ...state, version: 1 as const };
  try {
    localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode — still return in-memory next for this session */
  }
  return next;
}

export async function readPersistedLicenseState(): Promise<LicensePersistedState> {
  return readBrowserState();
}

export async function writePersistedLicenseState(
  state: LicensePersistedState,
): Promise<LicensePersistedState> {
  return writeBrowserState(state);
}

export async function resolveMachineId(): Promise<string> {
  try {
    let id = localStorage.getItem(MACHINE_ID_KEY);
    if (!id) {
      id = `browser-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
      localStorage.setItem(MACHINE_ID_KEY, id);
    }
    return id;
  } catch {
    return `browser-ephemeral-${Date.now().toString(36)}`;
  }
}

/**
 * Optional local bypass — set NEXT_PUBLIC_MILLIES_LICENSE_DEV_BYPASS=1.
 * Off by default so the activation gate is visible during normal testing.
 */
export async function isLicenseDevBypass(): Promise<boolean> {
  return process.env.NEXT_PUBLIC_MILLIES_LICENSE_DEV_BYPASS === "1";
}
