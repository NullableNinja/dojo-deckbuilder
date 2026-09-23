const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

let windowRef;
let server;
let nextId = 1;
const pending = new Map();
const appRoot = () => app.getAppPath();
const rootPath = (...parts) => path.join(appRoot(), ...parts);

function buildArtMap() {
  const packaged = fs.existsSync(rootPath("assets", "cards"));
  const cardsRoot = packaged ? rootPath("assets", "cards") : rootPath("app", "assets", "cards");
  const urlRoot = packaged ? "assets/cards" : "../app/assets/cards";
  const map = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) { visit(absolute); continue; }
      if (!entry.name.toLowerCase().endsWith(".webp")) continue;
      const relative = path.relative(cardsRoot, absolute).split(path.sep).join("/");
      const url = `${urlRoot}/${relative}`;
      const stem = entry.name.replace(/\.webp$/i, "");
      const catalog = stem.match(/^(ddb-[a-z0-9-]+-core-\d{3})_/i)?.[1];
      if (catalog) map[catalog.toUpperCase()] = url;
      map[`name:${stem.toLowerCase()}`] = url;
      map[`name:${(stem.split("_").at(-1) ?? stem).toLowerCase()}`] = url;
    }
  };
  visit(cardsRoot);
  return map;
}

function startServer() {
  const nodeBinary = process.env.DOJO_NODE_BINARY || rootPath("runtime", "node.exe");
  server = spawn(nodeBinary, [rootPath("engine", "desktop-server.mjs")], { cwd: appRoot(), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const lines = readline.createInterface({ input: server.stdout, crlfDelay: Infinity });
  lines.on("line", (line) => {
    try { const message = JSON.parse(line); const resolve = pending.get(message.id); if (resolve) { pending.delete(message.id); resolve(message); } } catch { /* wait for the request timeout */ }
  });
  server.stderr.on("data", (chunk) => console.error(String(chunk)));
  server.on("exit", (code) => { for (const resolve of pending.values()) resolve({ ok: false, error: `Game engine exited with code ${code}` }); pending.clear(); });
}

function createWindow() {
  windowRef = new BrowserWindow({ width: 1440, height: 960, minWidth: 1080, minHeight: 720, backgroundColor: "#090c13", title: "Dojo Deckbuilder — Offline Game", autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, "game-preload.cjs") } });
  windowRef.loadFile(path.join(__dirname, "game.html"));
}

app.whenReady().then(() => {
  startServer();
  ipcMain.handle("dojo-game-command", (_event, message) => new Promise((resolve) => { const id = nextId++; pending.set(id, resolve); server.stdin.write(`${JSON.stringify({ ...message, id })}\n`); }));
  ipcMain.handle("dojo-game-art-map", () => buildArtMap());
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("before-quit", () => server?.kill());
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
