import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeEffectCoverage, HEADLESS_SUPPORTED_CONDITIONS } from "../engine/coverage.mjs";
import { loadGameData } from "../engine/rules-loader.mjs";
import { Game } from "../engine/core.mjs";
import { replayGame, replayMatches, replayDiff } from "../engine/replay.mjs";
import { applyScenario, loadScenario } from "../engine/scenarios.mjs";
import { baselinePolicy } from "../engine/policies.mjs";
import { certifyPlaytest } from "./playtest-certification.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const failures = [];
const warnings = [];
const fail = (message) => failures.push(message);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const [source, definition, cards, effects, cardEffects] = await Promise.all([
  readJson("content/dojo-game.json"), readJson("app/data/game-definition.json"),
  readJson("app/data/cards.json"), readJson("app/data/effects.json"), readJson("app/data/card-effects.json"),
]);
const data = await loadGameData();
const coverage = analyzeEffectCoverage(cardEffects, { catalog: cards.cards, definition });
const playtest = await certifyPlaytest(root);

// Canonical source boundaries and browser/headless generated boundaries.
if (!same(source.definition, definition)) fail("generated game definition differs from content/dojo-game.json");
if (!same(source.rulesVersion, definition.rulesVersion) || !same(source.rulesRevision, definition.rulesRevision)) fail("canonical and generated rules metadata differ");
for (const path of ["app/playtest.tsx", "app/canonical-presentation.ts", "app/card-effects.ts", "app/family-effect-runtime.ts"]) {
  const text = await readFile(resolve(root, path), "utf8");
  if (!text.includes("./data/")) fail(`${path} does not visibly consume generated canonical data`);
}
if (!source.sourcePolicy?.authoritativeDirectory || !source.sourcePolicy.generatedFiles?.includes("app/data/game-definition.json")) fail("sourcePolicy does not describe canonical generation");

// Machine-readable rule contract.
const requiredDefinitionPaths = [
  ["mode", "startingHp"], ["mode", "maxRounds"], ["turn", "phases"], ["turn", "phaseRules"],
  ["economy", "market"], ["progression", "belts"], ["combat", "damageFloor"], ["starterDeck"],
];
for (const path of requiredDefinitionPaths) {
  let value = definition;
  for (const key of path) value = value?.[key];
  if (value === undefined || value === null) fail(`machine-readable definition is missing ${path.join(".")}`);
}
const phaseIds = new Set(definition.turn.phases);
for (const phase of definition.turn.phaseRules) if (!phaseIds.has(phase.id)) fail(`phase rule ${phase.id} is not in the phase sequence`);

// Structured vocabulary is only certified when the coverage analyzer sees the
// same action/condition as executable; unknown conditions are never permissive.
if (coverage.unsupportedEffects) fail(`${coverage.unsupportedEffects} structured effects are not executable by the headless vocabulary`);
if (!playtest.pass) for (const failure of playtest.failures) fail(`Playtest certification: ${failure}`);
for (const [kind, count] of Object.entries(coverage.conditionCounts)) if (!HEADLESS_SUPPORTED_CONDITIONS.has(kind) && count) fail(`condition kind ${kind} is not certified`);
const triggers = Object.fromEntries(Object.entries(coverage.triggerCounts));
const executableTriggers = new Set(["passive", "onPlay", "onHit", "onBlock", "onAttackDeclared", "onDefenseDeclared", "afterResolve", "onPurchase", "onEquip", "onInitiate", "onHide"]);
for (const trigger of Object.keys(triggers)) if (!executableTriggers.has(trigger)) fail(`trigger ${trigger} has no headless publisher: ${trigger}`);

// One deterministic game is the minimum runtime proof. Replay compares state,
// telemetry, card metrics, and invariants, not only winner/round count.
const original = new Game(data, { seed: 9127, strategies: ["balanced", "aggressive"] }).run({ policy: baselinePolicy });
const replayed = replayGame(data, original);
if (!replayMatches(original, replayed)) fail(`deterministic replay mismatch: ${replayDiff(original, replayed).join(", ")}`);
if (original.invariantFailures.length) fail(`baseline runtime invariants failed: ${original.invariantFailures.join("; ")}`);

// Scenario overlays must be isolated from canonical JSON and still execute.
const scenario = await loadScenario(resolve(root, "scenarios/no-defense-practice.json"));
const scenarioData = applyScenario(data, scenario);
if (scenarioData.definition.economy.defensePractice.usesPerTurn !== 0) fail("scenario overlay did not apply its definition patch");
if (data.definition.economy.defensePractice.usesPerTurn === 0) fail("scenario overlay mutated canonical data");
const scenarioResult = new Game(scenarioData, { seed: 9127 }).run({ policy: baselinePolicy });
if (scenarioResult.invariantFailures.length) fail(`scenario runtime invariants failed: ${scenarioResult.invariantFailures.join("; ")}`);

const report = {
  rulesVersion: definition.rulesVersion,
  rulesRevision: definition.rulesRevision,
  canonical: { source: "content/", generated: "app/data/", generatedBoundary: same(source.definition, definition) },
  coverage: { total: coverage.totalEffects, supported: coverage.supportedEffects, unsupported: coverage.unsupportedEffects, scopes: coverage.scopeCounts },
  playtest,
  runtime: { replayChecked: true, replayMatches: replayMatches(original, replayed), invariantFailures: original.invariantFailures, scenarioId: scenario.id, scenarioInvariantFailures: scenarioResult.invariantFailures },
  triggers,
  telemetry: original.telemetry,
  warnings,
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) { console.error("Workflow validation FAILED:\n" + failures.map((message) => ` - ${message}`).join("\n")); process.exitCode = 1; }
else console.error(`Workflow validation PASS — ${definition.rulesVersion}/${definition.rulesRevision}`);
