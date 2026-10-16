import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Fast Windows RAW path.
 *
 * Compiling C# via Add-Type on every print is slow (1–3s). We compile once to a
 * temp DLL, then each job only starts PowerShell long enough to load the DLL and
 * WritePrinter — similar feel to a short barcode/test ticket.
 */

const HELPER_DIR = path.join(os.tmpdir(), "millies-raw-printer");
const HELPER_DLL = path.join(HELPER_DIR, "RawPrinter.dll");
const HELPER_CS = path.join(HELPER_DIR, "RawPrinter.cs");

const RAW_PRINTER_CS = `using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA {
    public string pDocName;
    public string pOutputFile;
    public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter")]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter")]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter")]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter")]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static bool Send(string printer, byte[] bytes) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) return false;
    var di = new DOCINFOA();
    di.pDocName = "MilliesReceipt";
    di.pDataType = "RAW";
    if (!StartDocPrinter(h, 1, di)) { ClosePrinter(h); return false; }
    StartPagePrinter(h);
    IntPtr p = Marshal.AllocCoTaskMem(bytes.Length);
    Marshal.Copy(bytes, 0, p, bytes.Length);
    int written;
    WritePrinter(h, p, bytes.Length, out written);
    Marshal.FreeCoTaskMem(p);
    EndPagePrinter(h);
    EndDocPrinter(h);
    ClosePrinter(h);
    return written == bytes.Length;
  }
}
`;

let helperReady: Promise<void> | null = null;

/** Pre-compile the RAW helper so the first sale print is not paying csc cost. */
export function warmupWindowsRawPrinter(): void {
  if (process.platform !== "win32") return;
  void ensureHelperDll().catch(() => {
    /* best-effort */
  });
}

function ensureHelperDll(): Promise<void> {
  if (helperReady) return helperReady;
  helperReady = new Promise((resolve, reject) => {
    try {
      fs.mkdirSync(HELPER_DIR, { recursive: true });
      if (fs.existsSync(HELPER_DLL) && fs.statSync(HELPER_DLL).size > 0) {
        resolve();
        return;
      }
      fs.writeFileSync(HELPER_CS, RAW_PRINTER_CS, "utf8");
      const cscCandidates = [
        path.join(
          process.env["WINDIR"] || "C:\\Windows",
          "Microsoft.NET",
          "Framework64",
          "v4.0.30319",
          "csc.exe",
        ),
        path.join(
          process.env["WINDIR"] || "C:\\Windows",
          "Microsoft.NET",
          "Framework",
          "v4.0.30319",
          "csc.exe",
        ),
      ];
      const csc = cscCandidates.find((p) => fs.existsSync(p));
      if (!csc) {
        // Fall through: print path will use inline Add-Type once.
        resolve();
        return;
      }
      const build = spawn(
        csc,
        ["/nologo", "/target:library", `/out:${HELPER_DLL}`, HELPER_CS],
        { windowsHide: true },
      );
      let stderr = "";
      build.stderr?.on("data", (d) => {
        stderr = (stderr + String(d)).slice(-4_096);
      });
      build.once("error", () => resolve());
      build.once("close", (code) => {
        if (code !== 0 || !fs.existsSync(HELPER_DLL)) {
          console.warn("[print] RawPrinter.dll compile skipped:", stderr.trim() || code);
        }
        resolve();
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
  return helperReady;
}

function buildPowerShellCommand(printerName: string, tmpFile: string): string {
  const printerLiteral = printerName.replaceAll("'", "''");
  const fileLiteral = tmpFile.replaceAll("'", "''");
  const dllLiteral = HELPER_DLL.replaceAll("'", "''");
  if (fs.existsSync(HELPER_DLL)) {
    return (
      `Add-Type -Path '${dllLiteral}'; ` +
      `$bytes = [System.IO.File]::ReadAllBytes('${fileLiteral}'); ` +
      `$printer = '${printerLiteral}'; ` +
      `if (-not [RawPrinter]::Send($printer, $bytes)) { throw "Printer offline or not installed: $printer" }`
    );
  }
  // Slow fallback — compile from source once when csc was unavailable.
  return (
    `$bytes = [System.IO.File]::ReadAllBytes('${fileLiteral}'); ` +
    `$printer = '${printerLiteral}'; ` +
    `Add-Type -TypeDefinition @'\n${RAW_PRINTER_CS}\n'@; ` +
    `if (-not [RawPrinter]::Send($printer, $bytes)) { throw "Printer offline or not installed: $printer" }`
  );
}

/** Send RAW bytes to an installed Windows printer (USB / shared / TCP port mapped in spooler). */
export function sendWindowsRaw(printerName: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32") {
      reject(new Error("Windows RAW printing is only available on Windows"));
      return;
    }
    if (!printerName?.trim()) {
      reject(new Error("Windows printer name is required"));
      return;
    }

    const tmp = path.join(os.tmpdir(), `millies-receipt-${randomUUID()}.bin`);
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ps: ChildProcess | undefined;
    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* already removed */
      }
      if (error) reject(error);
      else resolve();
    };

    void ensureHelperDll()
      .then(() => {
        fs.writeFileSync(tmp, data);
        ps = spawn(
          "powershell.exe",
          ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", buildPowerShellCommand(printerName, tmp)],
          { windowsHide: true },
        );

        timer = setTimeout(() => {
          try {
            ps?.kill();
          } catch {
            /* reject even if process termination fails */
          }
          settle(
            new Error(
              "Printing timed out. Check the printer before retrying to avoid duplicate receipts.",
            ),
          );
        }, 15_000);

        let stderr = "";
        ps.stderr?.on("data", (d) => {
          stderr = (stderr + String(d)).slice(-8_192);
        });
        ps.once("error", (error) =>
          settle(new Error(`Could not start Windows printing: ${error.message}`)),
        );
        ps.once("close", (code) => {
          settle(
            code === 0
              ? undefined
              : new Error(stderr.trim() || `Printer offline or not installed: ${printerName}`),
          );
        });
      })
      .catch((error) => {
        settle(error instanceof Error ? error : new Error(String(error)));
      });
  });
}
