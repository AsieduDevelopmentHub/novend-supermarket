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
});
