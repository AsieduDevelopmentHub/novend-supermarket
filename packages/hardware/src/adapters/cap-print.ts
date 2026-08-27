import { registerPlugin } from "@capacitor/core";

type NovendPrintPlugin = {
  printPdf: (options: { path: string; title?: string }) => Promise<void>;
  savePdfToDownloads: (options: { data: string; fileName: string }) => Promise<{
    uri: string;
    fileName: string;
  }>;
};

export const NovendPrint = registerPlugin<NovendPrintPlugin>("NovendPrint");
