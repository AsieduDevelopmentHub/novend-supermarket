import { ipcMain } from "electron";
import {
  closeCustomerDisplayWindow,
  CUSTOMER_DISPLAY_STATE_CHANNEL,
  getCustomerDisplayStatus,
  listDesktopDisplays,
  onCustomerDisplayStatus,
  onDesktopDisplaysChanged,
  openCustomerDisplayWindow,
  relayCustomerDisplayState,
  setCustomerDisplayAutoOpenEnabled,
} from "./customer-display";

export { CUSTOMER_DISPLAY_STATE_CHANNEL };

const DISPLAY_CHANGED_CHANNEL = "desktop:customerDisplay:displaysChanged";

const CHANNELS = {
  open: "desktop:customerDisplay:open",
  close: "desktop:customerDisplay:close",
  getStatus: "desktop:customerDisplay:getStatus",
  listDisplays: "desktop:customerDisplay:listDisplays",
  publish: "desktop:customerDisplay:publish",
  onStatus: "desktop:customerDisplay:onStatus",
  setAutoOpen: "desktop:customerDisplay:setAutoOpen",
  onDisplaysChanged: "desktop:customerDisplay:onDisplaysChanged",
} as const;

function isDisplayId(value: unknown): value is number | null | undefined {
  return value == null || (typeof value === "number" && Number.isFinite(value));
}

export function registerCustomerDisplayIpc() {
  ipcMain.handle(CHANNELS.open, async (_event, payload?: unknown) => {
    const displayId =
      payload &&
      typeof payload === "object" &&
      isDisplayId((payload as { displayId?: unknown }).displayId)
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

  ipcMain.handle(CHANNELS.setAutoOpen, (_event, payload?: unknown) => {
    const enabled = Boolean(
      payload && typeof payload === "object" && (payload as { enabled?: unknown }).enabled === true,
    );
    setCustomerDisplayAutoOpenEnabled(enabled);
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

  ipcMain.handle(CHANNELS.onDisplaysChanged, (event) => {
    const wc = event.sender;
    const unsubscribe = onDesktopDisplaysChanged((displays) => {
      if (wc.isDestroyed()) return;
      wc.send(DISPLAY_CHANGED_CHANNEL, { ok: true, displays });
    });
    wc.once("destroyed", unsubscribe);
    return { ok: true, displays: listDesktopDisplays() };
  });
}

export { CHANNELS as CUSTOMER_DISPLAY_CHANNELS };
