export type TrustedOriginPolicy = Readonly<{
  appOrigin: string;
  localFileUrls: ReadonlySet<string>;
}>;

export type IpcSenderEvent = {
  senderFrame?: { url?: string } | null;
  sender: { getURL: () => string };
};

const AUTH_SHELL_PATHS = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);
const SAFE_EXTERNAL_PROTOCOLS = new Set(["https:", "mailto:"]);

function parseAbsoluteUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeLocalFileUrl(value: string): string | null {
  const url = parseAbsoluteUrl(value);
  if (!url || url.protocol !== "file:" || url.username || url.password) return null;
  url.search = "";
  url.hash = "";
  return url.href;
}

export function normalizeConfiguredAppOrigin(appUrl: string): string {
  const url = parseAbsoluteUrl(appUrl.trim());
  if (
    !url ||
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password
  ) {
    throw new Error("NOVEND_APP_URL must be an absolute HTTP(S) URL without credentials.");
  }
  return url.origin;
}

export function createTrustedOriginPolicy(
  appUrl: string,
  localFileUrls: readonly string[] = [],
): TrustedOriginPolicy {
  const normalizedLocalFiles = localFileUrls.map(normalizeLocalFileUrl);
  if (normalizedLocalFiles.some((url) => url == null)) {
    throw new Error("Trusted local entries must be absolute file: URLs.");
  }
  return {
    appOrigin: normalizeConfiguredAppOrigin(appUrl),
    localFileUrls: new Set(normalizedLocalFiles as string[]),
  };
}

export function isTrustedRendererUrl(policy: TrustedOriginPolicy, candidate: string): boolean {
  const url = parseAbsoluteUrl(candidate);
  if (!url) return false;

  if (url.protocol === "http:" || url.protocol === "https:") {
    return url.origin === policy.appOrigin;
  }

  const localFileUrl = normalizeLocalFileUrl(candidate);
  return localFileUrl != null && policy.localFileUrls.has(localFileUrl);
}

export function getIpcSenderUrl(event: IpcSenderEvent): string {
  return event.senderFrame?.url || event.sender.getURL();
}

export function isTrustedIpcSender(policy: TrustedOriginPolicy, event: IpcSenderEvent): boolean {
  return isTrustedRendererUrl(policy, getIpcSenderUrl(event));
}

export function assertTrustedIpcSender(policy: TrustedOriginPolicy, event: IpcSenderEvent): void {
  if (!isTrustedIpcSender(policy, event)) {
    throw new Error("Unauthorized IPC sender.");
  }
}

export function isAllowedExternalUrl(candidate: string): boolean {
  const url = parseAbsoluteUrl(candidate);
  return url != null && SAFE_EXTERNAL_PROTOCOLS.has(url.protocol) && !url.username && !url.password;
}

function hasEncodedExternalTarget(value: string): boolean {
  let decoded = value;
  for (let index = 0; index < 3; index += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return true;
    }
    if (next.startsWith("//") || next.includes("\\") || /^\/[a-z][a-z\d+.-]*:/i.test(next)) {
      return true;
    }
    if (next === decoded) return false;
    decoded = next;
  }
  return decoded.includes("%");
}

export function validateAuthShellEntry(candidate: string): string | null {
  const entry = candidate.trim();
  if (
    entry.length === 0 ||
    entry.length > 2_048 ||
    !entry.startsWith("/") ||
    entry.startsWith("//") ||
    entry.includes("\\") ||
    hasEncodedExternalTarget(entry)
  ) {
    return null;
  }

  const internalBase = "https://novend.invalid";
  const url = new URL(entry, internalBase);
  if (url.origin !== internalBase || !AUTH_SHELL_PATHS.has(url.pathname) || url.hash) {
    return null;
  }

  if (url.pathname === "/login") {
    const parameters = [...url.searchParams.entries()];
    if (
      parameters.length > 1 ||
      (parameters.length === 1 && (parameters[0]![0] !== "signedOut" || parameters[0]![1] !== "1"))
    ) {
      return null;
    }
  } else if (url.search) {
    return null;
  }

  return `${url.pathname}${url.search}`;
}

export function isAllowedMediaPermission(
  policy: TrustedOriginPolicy,
  permission: string,
  requestingUrl: string,
): boolean {
  return (
    (permission === "media" || permission === "mediaKeySystem") &&
    isTrustedRendererUrl(policy, requestingUrl) &&
    parseAbsoluteUrl(requestingUrl)?.origin === policy.appOrigin
  );
}
