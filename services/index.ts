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

export async function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((key) => escape(row[key])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return { filename, rows: rows.length };
}

/** @deprecated Use `exportCsv`. */
export const exportCsvStub = exportCsv;

export async function notifyStub(message: string) {
  console.info("[notify:stub]", message);
  return { delivered: false as const, message };
}
