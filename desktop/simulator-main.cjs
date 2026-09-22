const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");

let mainWindow;
let activeProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 900,
    minHeight: 680,
    backgroundColor: "#0b0e15",
    title: "Dojo Deckbuilder Simulation Control",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "simulator-preload.cjs"),
    },
  });
  mainWindow.loadFile(path.join(__dirname, "simulator.html"));
  mainWindow.on("closed", () => { mainWindow = undefined; });
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

ipcMain.handle("simulation:start", (_event, options) => {
  if (activeProcess) throw new Error("A simulation is already running.");
  const root = app.getAppPath();
  const nodePath = path.join(root, "runtime", "node.exe");
  const runnerPath = path.join(root, "engine", "parallel-simulate.mjs");
  const args = [
    runnerPath,
    `--games=${options.games}`,
    `--workers=${options.workers}`,
    `--seed=${options.seed}`,
    `--mode=${options.mode}`,
    `--policy=${options.policy}`,
    `--telemetry=${options.telemetry}`,
    `--replay-every=${options.replayEvery}`,
    `--out=${options.output}`,
  ];
  activeProcess = spawn(nodePath, args, { cwd: root, windowsHide: true });
  activeProcess.stdout.on("data", (chunk) => send("simulation:output", chunk.toString()));
  activeProcess.stderr.on("data", (chunk) => send("simulation:output", chunk.toString()));
  activeProcess.on("close", (code, signal) => {
    const result = { code: code ?? 1, signal: signal ?? null };
    activeProcess = undefined;
    send("simulation:done", result);
  });
  activeProcess.on("error", (error) => send("simulation:output", `${error.message}\n`));
  return { started: true };
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => {
  if (activeProcess) activeProcess.kill();
  if (process.platform !== "darwin") app.quit();
});
