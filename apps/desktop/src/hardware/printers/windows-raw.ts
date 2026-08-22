import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

    const tmp = path.join(os.tmpdir(), `novend-receipt-${Date.now()}-${process.pid}.bin`);
    fs.writeFileSync(tmp, data);

    const ps = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `$bytes = [System.IO.File]::ReadAllBytes('${tmp.replaceAll("'", "''")}'); ` +
          `$printer = '${printerName.replaceAll("'", "''")}'; ` +
          `Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter")] public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter")] public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter")] public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter")] public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static bool Send(string printer, byte[] bytes) {
    IntPtr h; if (!OpenPrinter(printer, out h, IntPtr.Zero)) return false;
    var di = new DOCINFOA(); di.pDocName = "NovendReceipt"; di.pDataType = "RAW";
    if (!StartDocPrinter(h, 1, di)) { ClosePrinter(h); return false; }
    StartPagePrinter(h);
    IntPtr p = Marshal.AllocCoTaskMem(bytes.Length);
    Marshal.Copy(bytes, 0, p, bytes.Length);
    int written; WritePrinter(h, p, bytes.Length, out written);
    Marshal.FreeCoTaskMem(p);
    EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);
    return written == bytes.Length;
  }
}
"@; ` +
          `if (-not [RawPrinter]::Send($printer, $bytes)) { throw "Printer offline or not installed: $printer" }`,
      ],
      { windowsHide: true },
    );

    let stderr = "";
    ps.stderr.on("data", (d) => {
      stderr += String(d);
    });
    ps.on("close", (code) => {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      if (code === 0) resolve();
      else {
        reject(new Error(stderr.trim() || `Printer offline or not installed: ${printerName}`));
      }
    });
  });
}
