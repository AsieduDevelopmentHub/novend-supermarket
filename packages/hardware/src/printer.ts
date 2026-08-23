import { getHardwareAdapters } from "./adapters/create";
import type {
  DefaultPrinterInfo,
  HardwareResult,
  PrintReceiptRequest,
  PrinterDiscovery,
} from "./types";

export async function printReceipt(request: PrintReceiptRequest): Promise<HardwareResult> {
  return getHardwareAdapters().printer.printReceipt(request);
}

export async function discoverPrinters(): Promise<HardwareResult<PrinterDiscovery>> {
  return getHardwareAdapters().printer.discoverPrinters();
}

export async function getDefaultPrinter(): Promise<HardwareResult<DefaultPrinterInfo | null>> {
  return getHardwareAdapters().printer.getDefaultPrinter();
}

export async function testPrint(config: DefaultPrinterInfo): Promise<HardwareResult> {
  const adapter = getHardwareAdapters().printer;
  if (!adapter.testPrint) {
    return { ok: false, message: "Test print is not available on this platform" };
  }
  return adapter.testPrint(config);
}
