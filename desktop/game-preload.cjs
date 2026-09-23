const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dojoGame", {
  command: (message) => ipcRenderer.invoke("dojo-game-command", message),
  getArtMap: () => ipcRenderer.invoke("dojo-game-art-map"),
});
