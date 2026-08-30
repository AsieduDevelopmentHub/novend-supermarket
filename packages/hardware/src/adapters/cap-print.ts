import { registerPlugin } from "@capacitor/core";

type NovendPrintPlugin = {
  printPdf: (options: { path?: string; data?: string; title?: string }) => Promise<void>;
  savePdfToDownloads: (options: { data: string; fileName: string }) => Promise<{
    uri: string;
    fileName: string;
  }>;
  sharePdf: (options: { data: string; fileName: string; title?: string }) => Promise<void>;
};

export const NovendPrint = registerPlugin<NovendPrintPlugin>("NovendPrint");
