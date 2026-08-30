/** Shared result / payload types for the hardware abstraction layer. */

export type HardwareResult<T = void> = {
  ok: boolean;
  message?: string;
  data?: T;
};

export type PhotoCapture = {
  /** data URL, web path, or durable filesystem URI for preview */
  uri: string;
  mimeType: string;
  /** Original File when available (web / Electron / Capacitor) */
  file?: File;
  /** Durable Capacitor Filesystem URI when the image was persisted locally */
  localPath?: string;
};

export type BarcodeScanResult = {
  value: string;
  format?: string;
};

export type DiscoveredPrinter = {
  name: string;
  driverName?: string;
  portName?: string;
  isDefault?: boolean;
  networkHost?: string | null;
  networkPort?: number | null;
  /** Bluetooth LE device id when discovered on Capacitor */
  bluetoothDeviceId?: string;
};

export type PrinterDiscovery = {
  printers: DiscoveredPrinter[];
  suggested?: {
    connectionType: "windows" | "network" | "auto" | "bluetooth";
    windowsPrinterName: string;
    printerHost: string;
    printerPort: number;
    bluetoothDeviceId?: string;
  } | null;
  version?: string;
  platform?: string;
};

export type PrintReceiptRequest = {
  escposBase64: string;
  invoiceNumber?: string;
  copies?: number;
  connectionType: "windows" | "network" | "auto" | "bluetooth";
  printerHost?: string;
  printerPort?: number;
  windowsPrinterName?: string;
  bluetoothDeviceId?: string;
  paperWidthMm?: 58 | 80;
  openCashDrawer?: boolean;
};

export type DefaultPrinterInfo = {
  connectionType: "windows" | "network" | "auto" | "bluetooth";
  windowsPrinterName?: string;
  printerHost?: string;
  printerPort?: number;
  bluetoothDeviceId?: string;
  paperWidthMm?: 58 | 80;
};

export type SavedFile = {
  pathOrName: string;
};

export type CameraAdapter = {
  /** Ensure camera (or photos) permission without opening the capture UI. */
  ensurePermission: (kind?: "camera" | "photos") => Promise<HardwareResult>;
  capturePhoto: () => Promise<HardwareResult<PhotoCapture>>;
  pickFromGallery: () => Promise<HardwareResult<PhotoCapture>>;
};

export type BarcodeAdapter = {
  scan: () => Promise<HardwareResult<BarcodeScanResult>>;
  startListening: () => Promise<HardwareResult>;
  stopListening: () => Promise<HardwareResult>;
  /** Optional discovery for settings panels (Electron bridge). */
  discover?: () => Promise<HardwareResult<unknown>>;
};

export type PrinterAdapter = {
  printReceipt: (request: PrintReceiptRequest) => Promise<HardwareResult>;
  discoverPrinters: () => Promise<HardwareResult<PrinterDiscovery>>;
  getDefaultPrinter: () => Promise<HardwareResult<DefaultPrinterInfo | null>>;
  /** Desktop test print; no-op / unsupported elsewhere. */
  testPrint?: (config: DefaultPrinterInfo) => Promise<HardwareResult>;
};

export type FilesystemAdapter = {
  savePDF: (bytes: Uint8Array, fileName: string) => Promise<HardwareResult<SavedFile>>;
  saveImage: (bytes: Uint8Array, fileName: string) => Promise<HardwareResult<SavedFile>>;
  readFile: (path: string) => Promise<HardwareResult<Uint8Array>>;
  /** Write a PDF and open the system print dialog (Capacitor). */
  printPDF?: (bytes: Uint8Array, title: string) => Promise<HardwareResult>;
};

export type ShareAdapter = {
  shareReceipt: (text: string, title?: string) => Promise<HardwareResult>;
  shareImage: (uri: string, title?: string) => Promise<HardwareResult>;
  /** Share a local file URI (PDF/image) via the native sheet. */
  shareFile?: (uri: string, title?: string) => Promise<HardwareResult>;
  /** Write a temp PDF (Cache + FileProvider) and open the native share sheet. */
  sharePdf?: (
    bytes: Uint8Array,
    title: string,
    fileName: string,
  ) => Promise<HardwareResult>;
};

export type HardwareAdapters = {
  camera: CameraAdapter;
  barcode: BarcodeAdapter;
  printer: PrinterAdapter;
  filesystem: FilesystemAdapter;
  share: ShareAdapter;
};
