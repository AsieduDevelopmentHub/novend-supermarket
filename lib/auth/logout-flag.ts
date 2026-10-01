const LOGOUT_FLAG = "novend.auth.signedOut";

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
  return flagged;
}
