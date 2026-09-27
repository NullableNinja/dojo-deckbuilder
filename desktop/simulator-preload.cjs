const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("simulation", {
  start: (options) => ipcRenderer.invoke("simulation:start", options),
  onOutput: (callback) => ipcRenderer.on("simulation:output", (_event, text) => callback(text)),
  onProgress: (callback) => ipcRenderer.on("simulation:progress", (_event, progress) => callback(progress)),
  onDone: (callback) => ipcRenderer.on("simulation:done", (_event, result) => callback(result)),
});
