import { ipcMain, type IpcMainInvokeEvent } from "electron";
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
import { resolveAppUrl } from "./desktop-config";
import { assertTrustedIpcSender, createTrustedOriginPolicy } from "./trusted-origin";

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
  // Customer display loads the same loopback Next origin as the till (not a file:// shell).
  const trustedOrigin = createTrustedOriginPolicy(resolveAppUrl());
  const requireTrustedSender = (event: IpcMainInvokeEvent) => {
    assertTrustedIpcSender(trustedOrigin, event);
  };

  ipcMain.handle(CHANNELS.open, async (event, payload?: unknown) => {
    requireTrustedSender(event);
    const displayId =
      payload &&
      typeof payload === "object" &&
      isDisplayId((payload as { displayId?: unknown }).displayId)
        ? ((payload as { displayId?: number | null }).displayId ?? null)
        : null;
    return openCustomerDisplayWindow({ displayId });
  });

  ipcMain.handle(CHANNELS.close, (event) => {
    requireTrustedSender(event);
    return closeCustomerDisplayWindow();
  });

  ipcMain.handle(CHANNELS.getStatus, (event) => {
    requireTrustedSender(event);
    return getCustomerDisplayStatus();
  });

  ipcMain.handle(CHANNELS.listDisplays, (event) => {
    requireTrustedSender(event);
    return {
      ok: true,
      displays: listDesktopDisplays(),
    };
  });

  ipcMain.handle(CHANNELS.publish, (event, payload: unknown) => {
    requireTrustedSender(event);
    relayCustomerDisplayState(payload);
    return { ok: true };
  });

  ipcMain.handle(CHANNELS.setAutoOpen, (event, payload?: unknown) => {
    requireTrustedSender(event);
    const enabled = Boolean(
      payload && typeof payload === "object" && (payload as { enabled?: unknown }).enabled === true,
    );
    setCustomerDisplayAutoOpenEnabled(enabled);
    return { ok: true };
  });

  ipcMain.handle(CHANNELS.onStatus, (event) => {
    requireTrustedSender(event);
    const wc = event.sender;
    const unsubscribe = onCustomerDisplayStatus((status) => {
      if (wc.isDestroyed()) return;
      wc.send("desktop:customerDisplay:status", status);
    });
    wc.once("destroyed", unsubscribe);
    return getCustomerDisplayStatus();
  });

  ipcMain.handle(CHANNELS.onDisplaysChanged, (event) => {
    requireTrustedSender(event);
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
