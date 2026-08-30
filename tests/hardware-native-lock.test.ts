import { describe, expect, it } from "vitest";
import { isNativeBridgeBusy, runExclusiveNative } from "@novend/hardware";

describe("runExclusiveNative", () => {
  it("runs one operation and is idle afterward", async () => {
    const result = await runExclusiveNative(async () => 7, 0);
    expect(result).toBe(7);
    expect(isNativeBridgeBusy()).toBe(false);
  });

  it("does not stack a second native call while one is in flight", async () => {
    let release!: () => void;
    const first = runExclusiveNative(
      () =>
        new Promise<string>((resolve) => {
          release = () => resolve("first");
        }),
      "busy",
    );
    const second = await runExclusiveNative(async () => "second", "busy");
    expect(second).toBe("busy");
    release();
    await expect(first).resolves.toBe("first");
    expect(isNativeBridgeBusy()).toBe(false);
  });
});
