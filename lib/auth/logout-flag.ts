const LOGOUT_FLAG = "novend.auth.signedOut";

/** Mark an explicit sign-out so the next /login paint does not resume the previous session. */
export function markExplicitLogout(): void {
  try {
    sessionStorage.setItem(LOGOUT_FLAG, "1");
  } catch {
    /* private browsing */
  }
}

export function hasExplicitLogout(): boolean {
  try {
    return sessionStorage.getItem(LOGOUT_FLAG) === "1";
  } catch {
    return false;
  }
}

/** One-shot: login consumed the flag after the form is safe to show. */
export function consumeExplicitLogout(): boolean {
  try {
    const flagged = sessionStorage.getItem(LOGOUT_FLAG) === "1";
    if (flagged) sessionStorage.removeItem(LOGOUT_FLAG);
    return flagged;
  } catch {
    return false;
  }
}
