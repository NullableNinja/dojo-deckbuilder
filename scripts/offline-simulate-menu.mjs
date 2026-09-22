import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadGameData } from "../engine/rules-loader.mjs";
import { modeSummary } from "../engine/modes.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = await loadGameData();
const modes = modeSummary(data);
const defaultWorkers = Math.min(availableParallelism(), 8);
const rl = createInterface({ input, output });

function ask(label, fallback) {
  return rl.question(`${label} [${fallback}]: `).then((value) => value.trim() || String(fallback));
}

function positiveInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) throw new Error(`${label} must be an integer from 1 to ${maximum}.`);
  return parsed;
}

try {
  console.log(`\nDojo Deckbuilder offline simulation control`);
  console.log(`Live canonical rules: ${data.definition.rulesVersion}/${data.definition.rulesRevision}`);
  console.log(`Executable modes: ${modes.executable.map((mode) => mode.id).join(", ") || "none"}`);
  if (modes.unavailable.length) console.log(`Not executable (rules are not guessed): ${modes.unavailable.map((mode) => `${mode.id} — ${mode.title}`).join("; ")}`);
  console.log("");

  const games = positiveInteger(await ask("Games to run", 1000), "Games");
  const workers = positiveInteger(await ask("Parallel workers", defaultWorkers), "Workers", games);
  const seed = positiveInteger(await ask("Starting seed", 1), "Starting seed");
  const mode = await ask("Mode ID", modes.executable[0]?.id ?? "quick-duel");
  if (!modes.executable.some((candidate) => candidate.id === mode)) throw new Error(`Mode ${mode} is not executable in this canonical rules snapshot.`);
  const policy = await ask("Policy (baseline or random)", "baseline");
  if (!["baseline", "random"].includes(policy)) throw new Error("Policy must be baseline or random.");
  const telemetry = await ask("Telemetry (summary, games, or full)", "games");
  if (!["summary", "games", "full"].includes(telemetry)) throw new Error("Telemetry must be summary, games, or full.");
  const replayEvery = Number.parseInt(await ask("Replay-check every Nth game (0 disables)", 100), 10);
  if (!Number.isInteger(replayEvery) || replayEvery < 0) throw new Error("Replay interval must be zero or a positive integer.");
  const output = await ask("Summary JSON path", "reports/offline-simulation.json");

  const args = [
    resolve(root, "engine", "parallel-simulate.mjs"),
    `--games=${games}`, `--workers=${workers}`, `--seed=${seed}`, `--mode=${mode}`,
    `--policy=${policy}`, `--telemetry=${telemetry}`, `--replay-every=${replayEvery}`, `--out=${output}`,
  ];
  console.log(`\nStarting ${games} ${mode} game${games === 1 ? "" : "s"} on ${workers} worker${workers === 1 ? "" : "s"}...\n`);
  const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
  const exitCode = await new Promise((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("exit", (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
  });
  process.exitCode = exitCode;
} catch (error) {
  console.error(`\nSimulation setup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
