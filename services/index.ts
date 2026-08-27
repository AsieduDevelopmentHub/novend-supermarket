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

import { buildCsvText } from "@/lib/export/csv";
import { downloadBlob } from "@/lib/export/download";

export async function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  const columns = Object.keys(rows[0] ?? {}).map((key) => ({ key, header: key }));
  const csv = buildCsvText({
    title: filename,
    filenameKind: "Export",
    columns,
    rows,
  });
  downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
  return { filename, rows: rows.length };
}

/** @deprecated Use `exportCsv`. */
export const exportCsvStub = exportCsv;

export async function notifyStub(message: string) {
  console.info("[notify:stub]", message);
  return { delivered: false as const, message };
}
