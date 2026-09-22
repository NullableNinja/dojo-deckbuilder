const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("simulation", {
  start: (options) => ipcRenderer.invoke("simulation:start", options),
  onOutput: (callback) => ipcRenderer.on("simulation:output", (_event, text) => callback(text)),
  onDone: (callback) => ipcRenderer.on("simulation:done", (_event, result) => callback(result)),
});
