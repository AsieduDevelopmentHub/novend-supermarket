import type { PrintJobRequest, PrintJobResult } from "../types";
import { sendTcp } from "./network";
import { sendWindowsRaw } from "./windows-raw";

/** ESC/POS cash drawer kick (pin 2, common default). */
function cashDrawerPulse(): Buffer {
  return Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
}

function hasUsableNetworkHost(host: string | undefined): boolean {
  const value = (host ?? "").trim();
  if (!value) return false;
  // Legacy default placeholder — never block an 8s TCP timeout on it.
  if (value === "192.168.1.100") return false;
  return true;
}

/**
 * Route print bytes the fast way:
 * - Prefer Windows RAW when a Windows printer is configured (USB/shared).
 * - Prefer short TCP only when a real LAN host is set.
 * - Never wait 8s on a dead default IP before falling back (that made receipts feel slow vs test print).
 */
async function sendOnce(job: PrintJobRequest, payload: Buffer): Promise<void> {
  const windowsName = (job.windowsPrinterName || "").trim();
  const host = (job.printerHost || "").trim();
  const port = Number(job.printerPort) || 9100;
  const type = job.connectionType || "auto";

  if (type === "windows") {
    if (!windowsName) throw new Error("Windows printer name is required");
    await sendWindowsRaw(windowsName, payload);
    return;
  }

  if (type === "network") {
    if (!hasUsableNetworkHost(host)) {
      throw new Error("Network printer host is required");
    }
    await sendTcp(host, port, payload, 3_000);
    return;
  }

  // auto
  if (windowsName && !hasUsableNetworkHost(host)) {
    await sendWindowsRaw(windowsName, payload);
    return;
  }

  if (hasUsableNetworkHost(host)) {
    try {
      // Short probe — fail fast to Windows RAW when the LAN path is down.
      await sendTcp(host, port, payload, 800);
      return;
    } catch (networkError) {
      if (windowsName) {
        await sendWindowsRaw(windowsName, payload);
        return;
      }
      throw networkError;
    }
  }

  if (windowsName) {
    await sendWindowsRaw(windowsName, payload);
    return;
  }

  throw new Error(
    "No printer configured. Open Settings → Printer, Discover printers, then Save.",
  );
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
      await sendOnce(job, payload);
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
    Buffer.from("Millie's Supermarket\n"),
    Buffer.from("Desktop print test\n"),
    Buffer.from(`${new Date().toISOString()}\n`),
    Buffer.from([0x1d, 0x56, 0x00]),
  ];
  return Buffer.concat(lines).toString("base64");
}
