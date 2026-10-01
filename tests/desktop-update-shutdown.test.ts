import { EventEmitter } from "node:events";
import type { BrowserWindow } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acknowledgeUpdatePreparation,
  CANCEL_UPDATE_CHANNEL,
  prepareRendererForUpdate,
  PREPARE_UPDATE_CHANNEL,
} from "@/apps/desktop/src/update-shutdown";

afterEach(() => vi.useRealTimers());

function testWindow() {
  return Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    webContents: { id: 42, send: vi.fn() },
  });
}

describe("desktop update preparation", () => {
  it("requires the matching request and renderer before approving restart", async () => {
    const window = testWindow();
    const result = prepareRendererForUpdate(window as unknown as BrowserWindow);
    const [channel, request] = window.webContents.send.mock.calls[0];
    expect(channel).toBe(PREPARE_UPDATE_CHANNEL);
    expect(acknowledgeUpdatePreparation(99, { ...request, ready: true })).toBe(false);
    expect(acknowledgeUpdatePreparation(42, { id: "stale", ready: true })).toBe(false);
    expect(acknowledgeUpdatePreparation(42, { ...request, ready: true })).toBe(true);
    expect(await result).toBe(true);
  });

  it("postpones when the renderer does not respond and cancels its barrier", async () => {
    vi.useFakeTimers();
    const window = testWindow();
    const result = prepareRendererForUpdate(window as unknown as BrowserWindow);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toBe(false);
    expect(window.webContents.send.mock.calls[1][0]).toBe(CANCEL_UPDATE_CHANNEL);
    expect(await prepareRendererForUpdate(null)).toBe(false);
  });
});
