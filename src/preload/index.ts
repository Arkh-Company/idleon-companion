// Preload: the only bridge between the window and the main process, through the fixed IPC channels only (api.ts).
import { contextBridge, ipcRenderer } from "electron";
import { companionApi } from "./api.ts";

contextBridge.exposeInMainWorld("companion", companionApi(ipcRenderer));
