import { describe, expect, it } from "vitest";
import { isConnectivityError, toUserMessage } from "@/lib/errors";

describe("connectivity errors", () => {
  it("maps Chrome disconnect codes to a human message", () => {
    const error = new Error("net::ERR_INTERNET_DISCONNECTED");
    expect(isConnectivityError(error)).toBe(true);
    expect(toUserMessage(error)).toMatch(/offline/i);
    expect(toUserMessage(error)).not.toMatch(/ERR_INTERNET/i);
  });

  it("maps failed fetch without leaking the raw error", () => {
    expect(toUserMessage(new TypeError("Failed to fetch"))).toMatch(/couldn't load|try again/i);
    expect(toUserMessage(new TypeError("Failed to fetch"))).not.toMatch(/Failed to fetch/i);
  });

  it("maps a live network failure to a server message", () => {
    expect(toUserMessage(new Error("NETWORK_ERROR"))).toMatch(/Unable to reach the server/i);
  });

  it("hides a stale server action id", () => {
    const error = new Error(
      'Server Action "00c87a2790661c26f594a2428f4f2908055b355bb3" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action',
    );
    const message = toUserMessage(error);
    expect(message).toMatch(/quick refresh/i);
    expect(message).not.toMatch(/00c87a/i);
    expect(message).not.toMatch(/nextjs\.org/i);
  });
});

describe("auth errors", () => {
  it("maps rate limits before credential failures", () => {
    expect(toUserMessage(new Error("Rate limit exceeded"))).toMatch(/Too many attempts/i);
    expect(toUserMessage(new Error("Too many requests"))).toMatch(/Too many attempts/i);
    expect(toUserMessage(new Error("TOO_MANY_REQUESTS"))).toMatch(/Too many attempts/i);
    expect(toUserMessage(new Error("Too many failed login attempts"))).toMatch(
      /Too many attempts/i,
    );
  });

  it("maps invalid credentials distinctly from rate limits", () => {
    expect(toUserMessage(new Error("InvalidSecret"))).toMatch(/Incorrect email or password/i);
  });

  it("maps missing accounts and duplicate emails clearly", () => {
    expect(toUserMessage(new Error("InvalidAccountId"))).toMatch(/No account found/i);
    expect(toUserMessage(new Error("Account user@example.com already exists"))).toMatch(
      /already exists/i,
    );
  });
});
