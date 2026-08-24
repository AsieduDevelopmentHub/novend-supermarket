import { getHardwareAdapters } from "./adapters/create";
import type {
  DefaultPrinterInfo,
  HardwareResult,
  PrintReceiptRequest,
  PrinterDiscovery,
} from "./types";

export async function printReceipt(request: PrintReceiptRequest): Promise<HardwareResult> {
  const adapters = await getHardwareAdapters();
  return adapters.printer.printReceipt(request);
}

export async function discoverPrinters(): Promise<HardwareResult<PrinterDiscovery>> {
  const adapters = await getHardwareAdapters();
  return adapters.printer.discoverPrinters();
}

export async function getDefaultPrinter(): Promise<HardwareResult<DefaultPrinterInfo | null>> {
  const adapters = await getHardwareAdapters();
  return adapters.printer.getDefaultPrinter();
}

export async function testPrint(config: DefaultPrinterInfo): Promise<HardwareResult> {
  const adapters = await getHardwareAdapters();
  const adapter = adapters.printer;
  if (!adapter.testPrint) {
    return { ok: false, message: "Test print is not available on this platform" };
  }
  return adapter.testPrint(config);
}
