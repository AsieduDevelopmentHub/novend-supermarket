/**
 * Fixed loopback port for Millie's local Next + Electron desktop:dev.
 * Avoids the crowded :3000 range. Packaged Electron still uses an ephemeral port.
 */
export const MILLIES_DEV_PORT = 3737;

export const MILLIES_DEV_ORIGIN = `http://127.0.0.1:${MILLIES_DEV_PORT}`;
