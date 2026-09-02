import { ipcMain } from "electron";
import {
  closeCustomerDisplayWindow,
  getCustomerDisplayStatus,
  listDesktopDisplays,
  onCustomerDisplayStatus,
  openCustomerDisplayWindow,
  relayCustomerDisplayState,
} from "./customer-display";

export const CUSTOMER_DISPLAY_STATE_CHANNEL = "desktop:customerDisplay:state";

const CHANNELS = {
  open: "desktop:customerDisplay:open",
  close: "desktop:customerDisplay:close",
  getStatus: "desktop:customerDisplay:getStatus",
  listDisplays: "desktop:customerDisplay:listDisplays",
  publish: "desktop:customerDisplay:publish",
  onStatus: "desktop:customerDisplay:onStatus",
} as const;

function isDisplayId(value: unknown): value is number | null | undefined {
  return value == null || (typeof value === "number" && Number.isFinite(value));
}

export function registerCustomerDisplayIpc() {
  ipcMain.handle(CHANNELS.open, async (_event, payload?: unknown) => {
    const displayId =
      payload && typeof payload === "object" && isDisplayId((payload as { displayId?: unknown }).displayId)
        ? ((payload as { displayId?: number | null }).displayId ?? null)
        : null;
    return openCustomerDisplayWindow({ displayId });
  });

  ipcMain.handle(CHANNELS.close, () => closeCustomerDisplayWindow());

  ipcMain.handle(CHANNELS.getStatus, () => getCustomerDisplayStatus());

  ipcMain.handle(CHANNELS.listDisplays, () => ({
    ok: true,
    displays: listDesktopDisplays(),
  }));

  ipcMain.handle(CHANNELS.publish, (_event, payload: unknown) => {
    relayCustomerDisplayState(payload);
    return { ok: true };
  });

  ipcMain.handle(CHANNELS.onStatus, (event) => {
    const wc = event.sender;
    const unsubscribe = onCustomerDisplayStatus((status) => {
      if (wc.isDestroyed()) return;
      wc.send("desktop:customerDisplay:status", status);
    });
    wc.once("destroyed", unsubscribe);
    return getCustomerDisplayStatus();
  });
}

export { CHANNELS as CUSTOMER_DISPLAY_CHANNELS };
