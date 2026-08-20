import type { PrintJobRequest, PrintJobResult } from "../types";
import { sendTcp } from "./network";
import { sendWindowsRaw } from "./windows-raw";

/** ESC/POS cash drawer kick (pin 2, common default). */
function cashDrawerPulse(): Buffer {
  return Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
}

export async function executePrintJob(job: PrintJobRequest): Promise<PrintJobResult> {
  const copies = Math.min(5, Math.max(1, job.copies || 1));
  const bytes = Buffer.from(String(job.escposBase64 || ""), "base64");
  if (!bytes.length) {
    return { ok: false, message: "Invalid print payload (missing ESC/POS data)" };
  }

  const payload = job.openCashDrawer === true ? Buffer.concat([bytes, cashDrawerPulse()]) : bytes;

  try {
    for (let i = 0; i < copies; i += 1) {
      if (job.connectionType === "windows") {
        await sendWindowsRaw(job.windowsPrinterName, payload);
      } else if (job.connectionType === "network") {
        await sendTcp(job.printerHost || "127.0.0.1", Number(job.printerPort) || 9100, payload);
      } else {
        try {
          await sendTcp(job.printerHost || "127.0.0.1", Number(job.printerPort) || 9100, payload);
        } catch (networkError) {
          if (job.windowsPrinterName) {
            await sendWindowsRaw(job.windowsPrinterName, payload);
          } else {
            throw networkError;
          }
        }
      }
    }
    return { ok: true, message: `Printed ${copies} copy(ies)` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Print failed",
    };
  }
}

/** Minimal ESC/POS: init + TEST receipt text + full cut. */
export function buildTestEscPosBase64(): string {
  const lines = [
    Buffer.from([0x1b, 0x40]),
    Buffer.from("Princellen POS\n"),
    Buffer.from("Desktop print test\n"),
    Buffer.from(`${new Date().toISOString()}\n`),
    Buffer.from([0x1d, 0x56, 0x00]),
  ];
  return Buffer.concat(lines).toString("base64");
}
