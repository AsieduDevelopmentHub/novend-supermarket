import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("novendDesktop", {
  ok: true,
  runtime: "electron",
});
