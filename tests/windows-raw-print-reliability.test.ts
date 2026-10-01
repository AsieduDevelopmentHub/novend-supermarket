import { EventEmitter } from "node:events";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendWindowsRaw } from "@/apps/desktop/src/hardware/printers/windows-raw";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
vi.mock("node:fs", () => ({ default: { writeFileSync: vi.fn(), unlinkSync: vi.fn() } }));
const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
const child = () =>
  Object.assign(new EventEmitter(), {
    stderr: new EventEmitter(),
    kill: vi.fn(),
  });

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(process, "platform", { value: "win32" });
});
afterEach(() => {
  Object.defineProperty(process, "platform", platform);
  vi.useRealTimers();
});

describe("Windows RAW print lifecycle", () => {
  it("handles a missing printing process and removes its temporary file once", async () => {
    const ps = child();
    vi.mocked(spawn).mockReturnValue(ps as unknown as ReturnType<typeof spawn>);
    const job = sendWindowsRaw("Receipt", Buffer.from("receipt"));
    const rejection = expect(job).rejects.toThrow("Could not start Windows printing");
    ps.emit("error", new Error("ENOENT"));
    ps.emit("close", -1);
    await rejection;
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
  });

  it("terminates stalled printing and rejects instead of hanging", async () => {
    vi.useFakeTimers();
    const ps = child();
    vi.mocked(spawn).mockReturnValue(ps as unknown as ReturnType<typeof spawn>);
    const job = sendWindowsRaw("Receipt", Buffer.from("receipt"));
    const rejection = expect(job).rejects.toThrow("Printing timed out");
    await vi.advanceTimersByTimeAsync(30_000);
    await rejection;
    expect(ps.kill).toHaveBeenCalledTimes(1);
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
  });

  it("resolves successful printing and removes the temporary file", async () => {
    const ps = child();
    vi.mocked(spawn).mockReturnValue(ps as unknown as ReturnType<typeof spawn>);
    const job = sendWindowsRaw("Receipt", Buffer.from("receipt"));
    ps.emit("close", 0);
    await job;
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
  });
});
