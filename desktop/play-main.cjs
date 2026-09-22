const { app, BrowserWindow } = require("electron");
const path = require("node:path");

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#0b0e15",
    title: "Dojo Deckbuilder",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.loadFile(path.join(__dirname, "dist", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
