/**
 * Millie's Supermarket runs as a fully offline till.
 * Dexie + PBKDF2 are the authority — Convex is never required at runtime.
 */
export const FULLY_OFFLINE = true;

/** Stable synthetic org id for the single-store Dexie replica (never sent to cloud). */
export const MILLIES_LOCAL_ORG_ID = "millies-local";

/** Stable synthetic branch id for the single store. */
export const MILLIES_LOCAL_BRANCH_ID = "millies-main";

export const MILLIES_LOCAL_BRANCH_NAME = "Main Store";
