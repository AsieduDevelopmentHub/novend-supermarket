import { spawn } from "node:child_process";
import type { DiscoveredWindowsPrinter, PrinterSuggestion } from "../types";

export function inferNetworkFromPort(portName: string) {
  if (!portName) return { networkHost: null as string | null, networkPort: null as number | null };
  const ipPrefixed = portName.match(/^IP_(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?$/i);
  if (ipPrefixed) {
    return {
      networkHost: ipPrefixed[1]!,
      networkPort: Number(ipPrefixed[2]) || 9100,
    };
  }
  const hostPort = portName.match(/^([a-zA-Z0-9._-]+):(\d+)$/);
  if (hostPort && !hostPort[1]!.includes("\\")) {
    return { networkHost: hostPort[1]!, networkPort: Number(hostPort[2]) || 9100 };
  }
  const bareIp = portName.match(/^(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (bareIp) return { networkHost: bareIp[1]!, networkPort: 9100 };
  return { networkHost: null, networkPort: null };
}

function looksLikeReceiptPrinter(name: string, driverName: string) {
  const hay = `${name} ${driverName}`.toLowerCase();
  return /epson|star|bixolon|citizen|pos-|receipt|thermal|tm-t|tsp|rp-|rongta|xprinter|gprinter/.test(
    hay,
  );
}

export function listWindowsPrinters(): Promise<DiscoveredWindowsPrinter[]> {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32") {
      resolve([]);
      return;
    }
    const ps = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Get-CimInstance Win32_Printer | Select-Object Name, DriverName, PortName, Default | ConvertTo-Json -Compress`,
      ],
      { windowsHide: true },
    );
    let stdout = "";
    let stderr = "";
    ps.stdout.on("data", (d) => {
      stdout += String(d);
    });
    ps.stderr.on("data", (d) => {
      stderr += String(d);
    });
    ps.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || "Could not enumerate Windows printers"));
        return;
      }
      try {
        const trimmed = stdout.trim();
        if (!trimmed) {
          resolve([]);
          return;
        }
        const parsed = JSON.parse(trimmed) as unknown;
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        resolve(
          rows
            .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
            .map((r) => {
              const name = String(r.Name || "");
              const driverName = String(r.DriverName || "");
              const portName = String(r.PortName || "");
              const network = inferNetworkFromPort(portName);
              return {
                name,
                driverName,
                portName,
                isDefault: Boolean(r.Default),
                networkHost: network.networkHost,
                networkPort: network.networkPort,
              };
            })
            .filter((p) => p.name),
        );
      } catch (error) {
        reject(
          new Error(error instanceof Error ? error.message : "Invalid printer discovery response"),
        );
      }
    });
  });
}

export function buildSuggested(printers: DiscoveredWindowsPrinter[]): PrinterSuggestion | null {
  if (!printers.length) return null;
  const preferred =
    printers.find((p) => looksLikeReceiptPrinter(p.name, p.driverName)) ||
    printers.find((p) => p.isDefault) ||
    printers[0]!;

  if (preferred.networkHost) {
    return {
      connectionType: "network",
      windowsPrinterName: preferred.name,
      printerHost: preferred.networkHost,
      printerPort: preferred.networkPort || 9100,
    };
  }
  return {
    connectionType: "windows",
    windowsPrinterName: preferred.name,
    printerHost: "",
    printerPort: 9100,
  };
}
