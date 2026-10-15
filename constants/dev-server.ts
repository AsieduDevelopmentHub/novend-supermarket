/**
 * Fixed loopback ports for Millie's local Next + Electron.
 *
 * IndexedDB / Dexie is origin-scoped (`http://127.0.0.1:<port>`). A random
 * packaged port each launch wiped the till account and sent cashiers back to
 * “create account”. Keep both ports stable — never allocate ephemeral ports.
 */
export const MILLIES_DEV_PORT = 3737;
/** Packaged Electron standalone server (distinct from dev so both can coexist). */
export const MILLIES_PACKAGED_PORT = 4737;

export const MILLIES_DEV_ORIGIN = `http://127.0.0.1:${MILLIES_DEV_PORT}`;
export const MILLIES_PACKAGED_ORIGIN = `http://127.0.0.1:${MILLIES_PACKAGED_PORT}`;
