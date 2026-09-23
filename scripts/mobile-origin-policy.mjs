const DEFAULT_MOBILE_APP_ORIGIN = "https://novend-pos.vercel.app";

/**
 * Exact Novend-controlled hosts that may run inside the Capacitor WebView.
 * Additions require ownership verification and a matching documentation update.
 */
export const APPROVED_MOBILE_HOSTS = Object.freeze(["novend-pos.vercel.app"]);

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "10.0.2.2"]);

function isPrivateIpv4(hostname) {
  const octets = hostname.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

export function isDevelopmentMobileHost(hostname) {
  const normalized = hostname.toLowerCase();
  return LOCAL_HOSTNAMES.has(normalized) || isPrivateIpv4(normalized);
}

export function isProductionMobileBuild(env = process.env) {
  return env.NOVEND_MOBILE_BUILD === "production" || env.NODE_ENV === "production";
}

export function resolveMobileAppOrigin(
  env = process.env,
  { production = isProductionMobileBuild(env) } = {},
) {
  const configured = env.NOVEND_APP_URL?.trim();
  if (production && !configured) {
    throw new Error("NOVEND_APP_URL is required for a production mobile build.");
  }

  const raw = configured || DEFAULT_MOBILE_APP_ORIGIN;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("NOVEND_APP_URL must be a valid absolute URL.");
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      "NOVEND_APP_URL must be an origin only, without credentials, path, query, or hash.",
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  if (production) {
    if (parsed.protocol !== "https:") {
      throw new Error("Production NOVEND_APP_URL must use HTTPS.");
    }
    if (parsed.port && parsed.port !== "443") {
      throw new Error("Production NOVEND_APP_URL must use the standard HTTPS port.");
    }
    if (!APPROVED_MOBILE_HOSTS.includes(hostname)) {
      throw new Error(
        `Production NOVEND_APP_URL hostname is not approved: ${hostname || "(empty)"}.`,
      );
    }
  } else if (parsed.protocol === "http:") {
    if (!isDevelopmentMobileHost(hostname)) {
      throw new Error(
        "HTTP NOVEND_APP_URL is allowed only for localhost, emulator, or private LAN development.",
      );
    }
  } else if (parsed.protocol !== "https:") {
    throw new Error("NOVEND_APP_URL must use HTTPS, or HTTP for local development.");
  }

  return {
    origin: parsed.origin,
    hostname,
    liveReload: parsed.protocol === "http:",
    production,
  };
}

export function mobileNavigationHosts(appHostname) {
  return [...new Set([appHostname.toLowerCase(), ...APPROVED_MOBILE_HOSTS])];
}
