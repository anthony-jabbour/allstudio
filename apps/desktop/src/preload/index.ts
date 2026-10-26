import { contextBridge, ipcRenderer } from "electron";
import { type DesktopApi, RUNTIME_CHANNEL } from "../shared/desktop-api.ts";

if (process.isMainFrame) {
  const api: DesktopApi = {
    runtime: () => ipcRenderer.invoke(RUNTIME_CHANNEL),
  };
  contextBridge.exposeInMainWorld("allstudio", Object.freeze(api));
}
