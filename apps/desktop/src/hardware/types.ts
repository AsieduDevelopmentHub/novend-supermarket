/** Shared hardware contracts for the Electron main process. */

export type ConnectionType = "network" | "windows" | "auto";

export type DiscoveredWindowsPrinter = {
  name: string;
  driverName: string;
  portName: string;
  isDefault: boolean;
  networkHost: string | null;
  networkPort: number | null;
};

export type PrinterSuggestion = {
  connectionType: ConnectionType;
  windowsPrinterName: string;
  printerHost: string;
  printerPort: number;
};

export type DeviceKind = "printer" | "scanner" | "cash_drawer" | "customer_display" | "scale";

export type DiscoveredDevice = {
  id: string;
  kind: DeviceKind;
  label: string;
  /** Kind-specific metadata (printer port, scanner mode, etc.). */
  meta: Record<string, unknown>;
};

export type PrintJobRequest = {
  escposBase64: string;
  invoiceNumber: string;
  copies: number;
  connectionType: ConnectionType;
  printerHost: string;
  printerPort: number;
  windowsPrinterName: string;
  paperWidthMm: 58 | 80;
  /** Optional ESC/POS cash-drawer pulse after print. */
  openCashDrawer?: boolean;
};

export type PrintJobResult = {
  ok: boolean;
  message: string;
};

export type DiscoverResult = {
  ok: boolean;
  version: string;
  platform: string;
  message?: string;
  windowsPrinters: DiscoveredWindowsPrinter[];
  devices: DiscoveredDevice[];
  suggested: PrinterSuggestion | null;
};

export type HardwareCapability = {
  kind: DeviceKind;
  available: boolean;
  reason?: string;
};
