export const APPROVED_MOBILE_HOSTS: readonly string[];

export function isDevelopmentMobileHost(hostname: string): boolean;

/**
 * Loose env bag so both `process.env` (NodeJS.ProcessEnv) and plain objects
 * type-check. Keep `NODE_ENV` as `string` — not a narrow literal union — so
 * callers are not blocked by ProcessEnv's development|production|test typing.
 */
export type MobileOriginEnvironment = {
  NODE_ENV?: string;
  NOVEND_APP_URL?: string;
  NOVEND_MOBILE_BUILD?: string;
  [key: string]: string | undefined;
};

export function isProductionMobileBuild(env?: MobileOriginEnvironment): boolean;

export function resolveMobileAppOrigin(
  env?: MobileOriginEnvironment,
  options?: { production?: boolean },
): {
  origin: string;
  hostname: string;
  liveReload: boolean;
  production: boolean;
};

export function mobileNavigationHosts(appHostname: string): string[];
