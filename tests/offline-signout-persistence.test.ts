import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeExplicitLogout,
  hasExplicitLogout,
  markExplicitLogout,
} from "@/lib/auth/logout-flag";

function memoryStorage(store: Map<string, string>): Storage {
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("offline sign-out persistence", () => {
  const local = new Map<string, string>();
  const session = new Map<string, string>();

  beforeEach(() => {
    local.clear();
    session.clear();
    vi.stubGlobal("localStorage", memoryStorage(local));
    vi.stubGlobal("sessionStorage", memoryStorage(session));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the signed-out barrier after the app session closes", () => {
    markExplicitLogout();
    expect(hasExplicitLogout()).toBe(true);

    // Closing Electron/Capacitor clears sessionStorage, not localStorage.
    session.clear();
    expect(hasExplicitLogout()).toBe(true);
  });

  it("clears the persistent barrier only after credential login succeeds", () => {
    markExplicitLogout();
    expect(consumeExplicitLogout()).toBe(true);
    expect(local.has("novend.auth.signedOut")).toBe(false);
    expect(session.has("novend.auth.signedOut")).toBe(false);
    expect(hasExplicitLogout()).toBe(false);
  });

  it("revokes a stale cloud session without removing the local barrier", () => {
    const login = readFileSync(
      resolve(process.cwd(), "features/auth/components/login-form.tsx"),
      "utf8",
    );
    expect(login).toContain("staleCloudLogoutRef");
    expect(login).toContain("hasExplicitLogout()");
    expect(login).toContain("void signOut().catch");
    // Must not key revoke off URL ?signedOut=1 — that survives a successful login.
    const revokeBlock = login.slice(
      login.indexOf("Offline sign-out cannot immediately revoke"),
      login.indexOf("const timer = window.setTimeout(() => {", login.indexOf("staleCloudLogoutRef")),
    );
    expect(revokeBlock).toContain("!hasExplicitLogout()");
    expect(revokeBlock).not.toContain("!signedOut");
    expect(revokeBlock).not.toContain("consumeExplicitLogout()");
    expect(revokeBlock).toContain("pending || openingWorkspace || redirectingRef.current");
  });

  it("documents why first login must not bounce after signedOut URL login", () => {
    const login = readFileSync(
      resolve(process.cwd(), "features/auth/components/login-form.tsx"),
      "utf8",
    );
    expect(login).toContain("never `?signedOut=1`");
    expect(login).toContain("first login bounces");
    expect(login).toContain("clearLogoutBarrierAfterCredentialUnlock");
    expect(login).toContain("clearSignedOutQueryParam");
  });

  it("keeps the requested login route during Electron recovery", () => {
    const desktopWindow = readFileSync(
      resolve(process.cwd(), "apps/desktop/src/window.ts"),
      "utf8",
    );
    expect(desktopWindow).toContain("mainShellEntry = entry");
    expect(desktopWindow).toContain("loadAppShell(win, appUrl, mainShellEntry");
    expect(desktopWindow).toContain("appEntryFromUrl(appUrl, validatedURL)");
  });
});
