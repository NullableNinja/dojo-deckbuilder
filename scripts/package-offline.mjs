import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { packager } from "@electron/packager";
import { loadGameData } from "../engine/rules-loader.mjs";
import { modeSummary } from "../engine/modes.mjs";

const repo = resolve(process.cwd());
const packageRoot = resolve(repo, "offline-package");
const stage = resolve(packageRoot, "dojo-deckbuilder-offline");
const zip = resolve(packageRoot, "Dojo-Deckbuilder-v2.3-r5-offline.zip");
const data = await loadGameData();
const modes = modeSummary(data);
const require = createRequire(import.meta.url);

await rm(stage, { recursive: true, force: true });
await rm(zip, { force: true });
await mkdir(packageRoot, { recursive: true });
await mkdir(stage, { recursive: true });
await cp(resolve(repo, "engine"), join(stage, "engine"), { recursive: true });
await cp(resolve(repo, "app", "data"), join(stage, "app", "data"), { recursive: true });
await cp(resolve(repo, "content"), join(stage, "content"), { recursive: true });
await cp(resolve(repo, "scripts", "offline-server.mjs"), join(stage, "tools", "offline-server.mjs"));
await cp(resolve(repo, "scripts", "offline-simulate-menu.mjs"), join(stage, "tools", "simulate-menu.mjs"));
if (process.platform === "win32") {
  await cp(process.execPath, join(stage, "runtime", "node.exe"));
}

let gameAppName = null;
let gameExeName = null;
let simulatorAppName = null;
let simulatorExeName = null;
if (process.platform === "win32") {
  const electronRoot = resolve(packageRoot, "electron-build");
  const gameSource = resolve(electronRoot, "game-source");
  const simulatorSource = resolve(electronRoot, "simulator-source");
  await rm(electronRoot, { recursive: true, force: true });
  await mkdir(gameSource, { recursive: true });
  await mkdir(simulatorSource, { recursive: true });
  await mkdir(join(gameSource, "runtime"), { recursive: true });
  await mkdir(join(simulatorSource, "runtime"), { recursive: true });
  await cp(resolve(repo, "engine"), join(gameSource, "engine"), { recursive: true });
  await cp(resolve(repo, "app", "data"), join(gameSource, "app", "data"), { recursive: true });
  await cp(resolve(repo, "app", "assets"), join(gameSource, "assets"), { recursive: true });
  await cp(resolve(repo, "desktop", "game-main.cjs"), join(gameSource, "game-main.cjs"));
  await cp(resolve(repo, "desktop", "game-preload.cjs"), join(gameSource, "game-preload.cjs"));
  await cp(resolve(repo, "desktop", "game.html"), join(gameSource, "game.html"));
  await cp(resolve(repo, "desktop", "game-renderer.js"), join(gameSource, "game-renderer.js"));
  await cp(process.execPath, join(gameSource, "runtime", "node.exe"));
  await writeFile(join(gameSource, "package.json"), `${JSON.stringify({ name: "dojo-deckbuilder-game", productName: "Dojo Deckbuilder Game", version: "1.0.0", main: "game-main.cjs" }, null, 2)}\n`);

  await cp(resolve(repo, "engine"), join(simulatorSource, "engine"), { recursive: true });
  await cp(resolve(repo, "content"), join(simulatorSource, "content"), { recursive: true });
  await cp(resolve(repo, "app", "data"), join(simulatorSource, "app", "data"), { recursive: true });
  await cp(process.execPath, join(simulatorSource, "runtime", "node.exe"));
  await cp(resolve(repo, "desktop", "simulator-main.cjs"), join(simulatorSource, "simulator-main.cjs"));
  await cp(resolve(repo, "desktop", "simulator-preload.cjs"), join(simulatorSource, "simulator-preload.cjs"));
  await cp(resolve(repo, "desktop", "simulator.html"), join(simulatorSource, "simulator.html"));
  await writeFile(join(simulatorSource, "mode-manifest.json"), `${JSON.stringify({ rulesVersion: data.definition.rulesVersion, rulesRevision: data.definition.rulesRevision, ...modes }, null, 2)}\n`);
  await writeFile(join(simulatorSource, "package.json"), `${JSON.stringify({ name: "dojo-deckbuilder-simulator", productName: "Dojo Deckbuilder Simulator", version: "1.0.0", main: "simulator-main.cjs" }, null, 2)}\n`);

  const electronVersion = require("electron/package.json").version;
  const [gameOutput] = await packager({ dir: gameSource, out: electronRoot, name: "Dojo-Deckbuilder-Game", platform: "win32", arch: "x64", electronVersion, overwrite: true, asar: false });
  const [simulatorOutput] = await packager({ dir: simulatorSource, out: electronRoot, name: "Dojo-Deckbuilder-Simulator", platform: "win32", arch: "x64", electronVersion, overwrite: true, asar: false });
  gameAppName = basename(gameOutput);
  gameExeName = "Dojo-Deckbuilder-Game.exe";
  simulatorAppName = basename(simulatorOutput);
  simulatorExeName = "Dojo-Deckbuilder-Simulator.exe";
  await cp(gameOutput, join(stage, "apps", gameAppName), { recursive: true });
  await cp(simulatorOutput, join(stage, "apps", simulatorAppName), { recursive: true });
}
await mkdir(join(stage, "reports"), { recursive: true });
await writeFile(join(stage, "package.json"), `${JSON.stringify({ type: "module", private: true }, null, 2)}\n`);
await writeFile(join(stage, "mode-manifest.json"), `${JSON.stringify({ rulesVersion: data.definition.rulesVersion, rulesRevision: data.definition.rulesRevision, ...modes }, null, 2)}\n`);
const launcher = process.platform === "win32" ? "%~dp0runtime\\node.exe" : "node";
const playCommand = process.platform === "win32"
  ? `@echo off\r\ncd /d "%~dp0"\r\n"%~dp0apps\\${gameAppName}\\${gameExeName}"\r\n`
  : `@echo off\r\ncd /d "%~dp0"\r\n"${launcher}" engine\\desktop-server.mjs %*\r\n`;
const simulateCommand = process.platform === "win32"
  ? `@echo off\r\nsetlocal\r\ncd /d "%~dp0"\r\nif "%*"=="" (\r\n  "%~dp0apps\\${simulatorAppName}\\${simulatorExeName}"\r\n  exit /b %ERRORLEVEL%\r\n)\r\necho Dojo Deckbuilder offline simulator CLI\r\necho Rules: ${data.definition.rulesVersion}/${data.definition.rulesRevision}\r\necho.\r\n"${launcher}" engine\\parallel-simulate.mjs %*\r\nset "EXITCODE=%ERRORLEVEL%"\r\necho.\r\nif "%EXITCODE%"=="0" ( echo Simulation complete. Reports are under the reports folder. ) else ( echo Simulation failed with exit code %EXITCODE%. )\r\nif /I not "%DOJO_NO_PAUSE%"=="1" pause\r\nexit /b %EXITCODE%\r\n`
  : `@echo off\r\nsetlocal\r\ncd /d "%~dp0"\r\n"${launcher}" tools\\simulate-menu.mjs\r\n`;
await writeFile(join(stage, "play.cmd"), playCommand);
await writeFile(join(stage, "simulate.cmd"), simulateCommand);
const readme = [
  "# Dojo Deckbuilder Offline",
  "",
  `Rules snapshot: **${data.definition.rulesVersion}/${data.definition.rulesRevision}**`,
  "",
  "This package uses the generated canonical data in `app/data` and the authoritative headless engine in `engine`. It does not need a network connection.",
  "",
  "## Play locally",
  "",
  "Run `play.cmd` or double-click `Dojo-Deckbuilder-Game.exe` under `apps`. This is the focused offline game client: it opens directly to mode selection and does not load the Dojo website, rules homepage, navigation, or browser server.",
  "",
  "## Run parallel simulations",
  "",
  "Run `simulate.cmd` or double-click the Dojo Deckbuilder Simulator executable under `apps` to use the native controls for game count, workers, seeds, mode, policy, telemetry detail, replay sampling, and output path.",
  "",
  "For scripted runs, pass arguments to `simulate.cmd`, for example: `simulate.cmd --games=10000 --workers=8 --telemetry=games --out=reports\\baseline.json`.",
  "",
  "The CLI launcher stays open so double-clicked runs show their result. Set `DOJO_NO_PAUSE=1` before launching it from an existing terminal to disable that pause.",
  "",
  "Telemetry levels:",
  "",
  "- `--telemetry=summary`: summary JSON only.",
  "- `--telemetry=games`: summary plus one JSON object per game in `reports\\baseline.games.jsonl`.",
  "- `--telemetry=full`: per-game objects also include complete decisions and lifecycle events.",
  "",
  "Executable modes currently include `--mode=quick-duel` and `--mode=boss-blitz` (solo). Cooperative Boss Blitz remains described in the canonical rules but is not yet executable; the runner rejects modes whose rules are prose-only rather than guessing.",
  "",
  "Each game is deterministic from its seed. Use `--seed=100000`, `--policy=baseline` or `--policy=random`, and `--replay-every=100` as needed.",
  "",
  "## Canonical source",
  "",
  "The included `content` directory is the authored source snapshot. Generated projections under `app/data` are included for offline execution.",
  "",
].join("\\n");
await writeFile(join(stage, "README-OFFLINE.md"), `${readme}\n`);

const archive = process.platform === "win32"
  ? spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${stage}', '${zip}', [System.IO.Compression.CompressionLevel]::Fastest, $false)`], { stdio: "inherit" })
  : spawnSync("tar", ["-a", "-c", "-f", zip, "-C", dirname(stage), stage.split(/[\\/]/).pop()], { stdio: "inherit" });
if (archive.status !== 0) throw new Error(`Could not create offline archive (status ${archive.status}). The unpacked package remains at ${stage}.`);
console.log(JSON.stringify({ package: zip, unpacked: stage, rulesVersion: data.definition.rulesVersion, rulesRevision: data.definition.rulesRevision, executableModes: modes.executable.map((mode) => mode.id), unavailableModes: modes.unavailable.map((mode) => mode.id) }, null, 2));
