import { ipcMain } from "electron";
import {
  discoverDevices,
  getRuntimeInfo,
  listCapabilities,
  printReceiptJob,
  runTestPrint,
} from "./hardware/registry";
import type { PrintJobRequest } from "./hardware/types";
import {
  checkForUpdates,
  getUpdateStatus,
  installDownloadedUpdate,
  UPDATE_STATUS_CHANNEL,
} from "./updater";

const CHANNELS = {
  getRuntime: "desktop:getRuntime",
  getCapabilities: "desktop:getCapabilities",
  discover: "desktop:hardware:discover",
  print: "desktop:hardware:print",
  testPrint: "desktop:hardware:testPrint",
  updatesGetStatus: "desktop:updates:getStatus",
  updatesCheck: "desktop:updates:check",
  updatesInstall: "desktop:updates:install",
} as const;

function isPrintJobRequest(value: unknown): value is PrintJobRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.escposBase64 === "string" && v.escposBase64.length > 0;
}

/** Register secure IPC handlers. Renderer only reaches these via preload. */
export function registerDesktopIpc() {
  ipcMain.handle(CHANNELS.getRuntime, () => getRuntimeInfo());

  ipcMain.handle(CHANNELS.getCapabilities, () => ({
    ok: true,
    capabilities: listCapabilities(),
  }));

  ipcMain.handle(CHANNELS.discover, async () => discoverDevices());

  ipcMain.handle(CHANNELS.print, async (_event, payload: unknown) => {
    if (!isPrintJobRequest(payload)) {
      return { ok: false, message: "Invalid print request" };
    }
    const copies = Math.min(5, Math.max(1, Number(payload.copies) || 1));
    const paperWidthMm = payload.paperWidthMm === 58 ? 58 : 80;
    const connectionType =
      payload.connectionType === "windows" || payload.connectionType === "network"
        ? payload.connectionType
        : "auto";

    return printReceiptJob({
      escposBase64: payload.escposBase64,
      invoiceNumber: String(payload.invoiceNumber || "INV"),
      copies,
      connectionType,
      printerHost: String(payload.printerHost || ""),
      printerPort: Number(payload.printerPort) || 9100,
      windowsPrinterName: String(payload.windowsPrinterName || ""),
      paperWidthMm,
      openCashDrawer: payload.openCashDrawer === true,
    });
  });

  ipcMain.handle(CHANNELS.testPrint, async (_event, partial?: unknown) => {
    const p =
      partial && typeof partial === "object" ? (partial as Partial<PrintJobRequest>) : undefined;
    return runTestPrint(p);
  });

  ipcMain.handle(CHANNELS.updatesGetStatus, () => getUpdateStatus());

  ipcMain.handle(CHANNELS.updatesCheck, async () => checkForUpdates());

  ipcMain.handle(CHANNELS.updatesInstall, () => installDownloadedUpdate());
}

export { CHANNELS, UPDATE_STATUS_CHANNEL };
