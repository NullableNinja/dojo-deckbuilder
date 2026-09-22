const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
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
  const appRoot = app.getAppPath();
  const packageRootCandidate = path.resolve(appRoot, "..", "..", "..", "..");
  const root = fs.existsSync(path.join(packageRootCandidate, "mode-manifest.json")) ? packageRootCandidate : appRoot;
  const nodePath = path.join(appRoot, "runtime", "node.exe");
  const runnerPath = path.join(appRoot, "engine", "parallel-simulate.mjs");
  const output = path.isAbsolute(String(options.output)) ? String(options.output) : path.resolve(root, String(options.output));
  const args = [
    runnerPath,
    `--games=${options.games}`,
    `--workers=${options.workers}`,
    `--seed=${options.seed}`,
    `--mode=${options.mode}`,
    `--policy=${options.policy}`,
    `--telemetry=${options.telemetry}`,
    `--replay-every=${options.replayEvery}`,
    `--out=${output}`,
  ];
  activeProcess = spawn(nodePath, args, { cwd: root, windowsHide: true });
  activeProcess.stdout.on("data", (chunk) => send("simulation:output", chunk.toString()));
  activeProcess.stderr.on("data", (chunk) => send("simulation:output", chunk.toString()));
  activeProcess.on("close", (code, signal) => {
    const result = { code: code ?? 1, signal: signal ?? null, output };
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
