export {
  loadTerminalScannerConfig,
  saveTerminalScannerConfig,
  DEFAULT_TERMINAL_SCANNER_CONFIG,
  type TerminalScannerConfig,
} from "./terminal-scanner-config";

export {
  discoverScanners,
  probeScannerBridge,
  isBarcodeScanningEnabled,
  getScannerConnectionState,
  getActiveBarcodeProviderKind,
  listAvailableBarcodeProviders,
  rememberLastScan,
  playScanSuccessBeep,
  BARCODE_HID_CAPTURE_MS,
  type DiscoveredScanner,
  type ScannerDiscoveryResult,
  type ScannerConnectionState,
  type BarcodeProviderKind,
} from "./barcode";

export {
  isCameraBarcodeSupported,
  createBarcodeDetector,
  openBarcodeCameraStream,
  cameraErrorMessage,
} from "./barcode-camera";
