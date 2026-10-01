import { randomUUID } from "node:crypto";
import type { BrowserWindow } from "electron";

export const PREPARE_UPDATE_CHANNEL = "desktop:updates:prepare";
export const CANCEL_UPDATE_CHANNEL = "desktop:updates:cancelPreparation";
export const ACK_UPDATE_CHANNEL = "desktop:updates:prepared";
type PendingPreparation = {
  id: string;
  senderId: number;
  finish: (ready: boolean) => void;
};
let pending: PendingPreparation | null = null;

/** A timed, sender-bound acknowledgement; old renderers fail closed. */
export function prepareRendererForUpdate(window: BrowserWindow | null): Promise<boolean> {
  if (!window || window.isDestroyed() || pending) return Promise.resolve(false);
  return new Promise((resolve) => {
    const id = randomUUID();
    const finish = (ready: boolean) => {
      if (pending?.id !== id) return;
      clearTimeout(timer);
      window.removeListener("closed", onClosed);
      pending = null;
      if (!ready && !window.isDestroyed()) {
        window.webContents.send(CANCEL_UPDATE_CHANNEL, { id });
      }
      resolve(ready);
    };
    const onClosed = () => finish(false);
    const timer = setTimeout(() => finish(false), 10_000);
    pending = { id, senderId: window.webContents.id, finish };
    window.once("closed", onClosed);
    try {
      window.webContents.send(PREPARE_UPDATE_CHANNEL, { id });
    } catch {
      finish(false);
    }
  });
}

export function acknowledgeUpdatePreparation(senderId: number, payload: unknown): boolean {
  if (!pending || !payload || typeof payload !== "object") return false;
  const value = payload as { id?: unknown; ready?: unknown };
  if (
    senderId !== pending.senderId ||
    value.id !== pending.id ||
    typeof value.ready !== "boolean"
  ) {
    return false;
  }
  pending.finish(value.ready);
  return true;
}
