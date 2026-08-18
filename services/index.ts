export type PrintJob = {
  title: string;
  content: string;
};

export async function queuePrintJob(job: PrintJob) {
  console.info("[print:stub]", job.title);
  return { queued: true as const };
}

export {
  printReceipt,
  printReceiptBrowser,
  buildReceiptPrintHtml,
  normalizeReceiptPayload,
  loadTerminalPrinterConfig,
  saveTerminalPrinterConfig,
  probePrintBridge,
  discoverPrinters,
  testDesktopPrint,
  isDesktopRuntime,
  buildEscPosReceipt,
} from "./printing";

export async function uploadFileStub(file: File) {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
  };
}

export async function exportCsvStub(filename: string, rows: Record<string, unknown>[]) {
  console.info("[export:stub]", filename, rows.length);
  return { filename, rows: rows.length };
}

export async function notifyStub(message: string) {
  console.info("[notify:stub]", message);
  return { delivered: false as const, message };
}
