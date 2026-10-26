import { contextBridge, ipcRenderer } from "electron";
import {
  CHANGE_CHANNEL,
  type DesktopApi,
  PROJECT_CHANNEL,
  RUNTIME_CHANNEL,
} from "../shared/desktop-api.ts";

if (process.isMainFrame) {
  const request = (action: string, fields: object = {}) =>
    ipcRenderer.invoke(PROJECT_CHANNEL, { action, ...fields });
  const api: DesktopApi = {
    runtime: () => ipcRenderer.invoke(RUNTIME_CHANNEL),
    recent: () => request("recent"),
    chooseProject: () => request("choose"),
    openRecent: (id) => request("open", { id }),
    closeProject: () => request("close"),
    locate: (projectId, oid) =>
      request("locate", { projectId, request: { oid } }),
    previewTextEdit: (projectId, value) =>
      request("preview-text", { projectId, request: value }),
    applyTextEdit: (projectId, value) =>
      request("apply-text", { projectId, request: value }),
    previewClassEdit: (projectId, value) =>
      request("preview-class", { projectId, request: value }),
    applyClassEdit: (projectId, value) =>
      request("apply-class", { projectId, request: value }),
    undo: (projectId) => request("undo", { projectId }),
    redo: (projectId) => request("redo", { projectId }),
    onChange: (callback) => {
      const listener = (_event: unknown, message: unknown) => {
        if (typeof message === "string" && message.length <= 2000)
          callback(message);
      };
      ipcRenderer.on(CHANGE_CHANNEL, listener);
      return () => ipcRenderer.removeListener(CHANGE_CHANNEL, listener);
    },
  };
  contextBridge.exposeInMainWorld("allstudio", Object.freeze(api));
}
