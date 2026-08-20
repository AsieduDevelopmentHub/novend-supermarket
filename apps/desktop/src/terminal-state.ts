import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

type TerminalState = {
  initialized: boolean;
  origin?: string;
  initializedAt?: number;
};

function statePath() {
  return path.join(app.getPath("userData"), "terminal-state.json");
}

function readState(): TerminalState {
  try {
    const raw = fs.readFileSync(statePath(), "utf8");
    const parsed = JSON.parse(raw) as TerminalState;
    return { initialized: Boolean(parsed.initialized), origin: parsed.origin, initializedAt: parsed.initializedAt };
  } catch {
    return { initialized: false };
  }
}

export function isTerminalInitialized() {
  return readState().initialized;
}

/** Record that this device reached the hosted app (service worker + Dexie can initialize). */
export function markTerminalInitialized(origin: string) {
  const next: TerminalState = {
    initialized: true,
    origin,
    initializedAt: Date.now(),
  };
  fs.mkdirSync(path.dirname(statePath()), { recursive: true });
  fs.writeFileSync(statePath(), `${JSON.stringify(next)}\n`);
}
