const LOGOUT_FLAG = "novend.auth.signedOut";
/** Session-only — drives the “Signing out…” splash for this leave, not reloads. */
const SIGNING_OUT_UI = "novend.auth.signingOutUi";

function availableStorages(): Storage[] {
  const stores: Storage[] = [];
  try {
    if (typeof localStorage !== "undefined") stores.push(localStorage);
  } catch {
    /* unavailable storage */
  }
  try {
    if (typeof sessionStorage !== "undefined" && !stores.includes(sessionStorage)) {
      stores.push(sessionStorage);
    }
  } catch {
    /* unavailable storage */
  }
  return stores;
}

/**
 * Persist an explicit sign-out across native app restarts. The local marker is
 * a security barrier while an offline device cannot revoke its cloud session.
 */
export function markExplicitLogout(): void {
  for (const storage of availableStorages()) {
    try {
      storage.setItem(LOGOUT_FLAG, "1");
    } catch {
      /* private browsing */
    }
  }
  markSigningOutUi();
}

/**
 * True only for the in-flight leave that set the barrier in this tab.
 * Hard reloads / later app-shell mounts keep the security flag but must not
 * paint “Signing out…” on every Preparing workspace splash.
 */
export function markSigningOutUi(): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SIGNING_OUT_UI, "1");
    }
  } catch {
    /* private browsing */
  }
}

export function clearSigningOutUi(): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(SIGNING_OUT_UI);
    }
  } catch {
    /* private browsing */
  }
}

export function isSigningOutUi(): boolean {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(SIGNING_OUT_UI) === "1";
  } catch {
    return false;
  }
}

export function hasExplicitLogout(): boolean {
  for (const storage of availableStorages()) {
    try {
      if (storage.getItem(LOGOUT_FLAG) === "1") return true;
    } catch {
      /* private browsing */
    }
  }
  return false;
}

/** Clear the barrier only after credentials successfully unlock an account. */
export function consumeExplicitLogout(): boolean {
  const flagged = hasExplicitLogout();
  for (const storage of availableStorages()) {
    try {
      storage.removeItem(LOGOUT_FLAG);
    } catch {
      /* private browsing */
    }
  }
  clearSigningOutUi();
  return flagged;
}
