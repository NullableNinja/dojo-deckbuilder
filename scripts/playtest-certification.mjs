import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeEffectCoverage } from "../engine/coverage.mjs";
import { effectPlanForCard } from "../app/card-effects.ts";
import { evaluateCombo } from "../app/combo-engine.ts";

const defaultRoot = fileURLToPath(new URL("../", import.meta.url));

const executionFiles = [
  "app/card-effects.ts",
  "app/combo-engine.ts",
  "app/effect-resolvers-legacy.ts",
  "app/effect-resolvers.ts",
  "app/family-effect-runtime.ts",
  "app/defense-effect-resolvers.ts",
  "app/consumable-effect-resolvers.ts",
  "app/kata-effect-resolvers.ts",
  "app/character-runtime.ts",
  "app/combo-runtime.ts",
  "app/location-effect-resolvers.ts",
  "app/equipment-structured.ts",
  "app/reaction-item-runtime.ts",
  "app/boss-runtime.ts",
];

const readJson = async (root, path) => JSON.parse(await readFile(resolve(root, path), "utf8"));

export async function certifyPlaytest(root = defaultRoot) {
  const [catalogDocument, registry, definition] = await Promise.all([
    readJson(root, "app/data/cards.json"),
    readJson(root, "app/data/card-effects.json"),
    readJson(root, "app/data/game-definition.json"),
  ]);
  const catalog = catalogDocument.cards ?? [];
  const cardsByCatalogId = new Map(catalog.map((card) => [card.catalogId, card]));
  const registryEntries = registry.cards ?? {};
  const failures = [];
  const missingRegistryEntries = catalog.filter((card) => !registryEntries[card.catalogId]).map((card) => card.catalogId);
  const orphanRegistryEntries = Object.keys(registryEntries).filter((catalogId) => !cardsByCatalogId.has(catalogId));
  if (missingRegistryEntries.length) failures.push(`missing canonical effect entries: ${missingRegistryEntries.join(", ")}`);
  if (orphanRegistryEntries.length) failures.push(`orphan canonical effect entries: ${orphanRegistryEntries.join(", ")}`);

  const coverage = analyzeEffectCoverage(registry, { catalog, definition });
  if (coverage.unsupportedEffects) failures.push(`${coverage.unsupportedEffects} structured effects are not executable by the headless vocabulary`);

  const plans = [];
  for (const card of catalog) {
    const plan = effectPlanForCard(card, registry);
    plans.push({ card, plan });
    if (plan.source !== "structured") failures.push(`${card.catalogId}: effect plan source is ${plan.source ?? "missing"}`);
    if (plan.unsupported.length) failures.push(`${card.catalogId}: unsupported plan entries ${plan.unsupported.join(", ")}`);
  }

  const emptyEntries = Object.entries(registryEntries).filter(([, entry]) => !(entry.effects ?? []).length).map(([catalogId]) => catalogId);
  const emptyNonStarters = emptyEntries.filter((catalogId) => cardsByCatalogId.get(catalogId)?.cardType !== "Starter");
  if (emptyNonStarters.length) failures.push(`non-Starter cards have no canonical effects: ${emptyNonStarters.join(", ")}`);

  const proseReferences = [];
  for (const relativePath of executionFiles) {
    const source = await readFile(resolve(root, relativePath), "utf8");
    if (/rulesText/.test(source)) proseReferences.push(relativePath);
    if (/legacy-parser|normalizedRulesText|operationsForSentence|sentenceTiming/.test(source)) proseReferences.push(`${relativePath}: prose parser symbol`);
  }
  if (proseReferences.length) failures.push(`printed-rules execution references remain: ${proseReferences.join(", ")}`);

  const playtestSource = await readFile(resolve(root, "app/playtest.tsx"), "utf8");
  for (const requiredImport of ["./data/cards.json", "./data/game-definition.json", "./card-effects"]) {
    if (!playtestSource.includes(requiredImport)) failures.push(`Playtest is missing canonical import ${requiredImport}`);
  }
  const cardEffectsSource = await readFile(resolve(root, "app/card-effects.ts"), "utf8");
  if (!cardEffectsSource.includes("./data/card-effects.json")) failures.push("card-effect planning is missing the generated canonical effect registry");
  if (!playtestSource.includes("evaluateCombo")) failures.push("Playtest is missing the canonical Combo runtime adapter");
  if (/const\s+text\s*=\s*card\.rulesText/.test(playtestSource)) failures.push("Playtest runtime still reads card.rulesText into an executable effect path");
  if (/gains Flow[^\n]*rulesText|rulesText[^\n]*gains Flow/i.test(playtestSource)) failures.push("Playtest runtime still parses printed Flow prose");

  const comboCards = catalog.filter((card) => card.cardType === "Combo");
  const comboEvaluations = comboCards.map((combo) => evaluateCombo(combo, {
    priorCards: [],
    attacksThisTurn: 0,
    defendedThisRound: false,
    hitThisTurn: false,
    zonesPlayed: [],
    equipment: [],
    currentCard: combo,
    currentZone: combo.zone ?? "Mid",
  }));
  const unsupportedCombos = comboCards.filter((_, index) => !comboEvaluations[index].supported).map((card) => card.catalogId);
  if (unsupportedCombos.length) failures.push(`Combo runtime rejected canonical requirements: ${unsupportedCombos.join(", ")}`);

  const fullyPlannedCards = plans.filter(({ plan }) => plan.unsupported.length === 0).length;
  return {
    pass: failures.length === 0,
    failures,
    catalogCards: catalog.length,
    registeredCards: Object.keys(registryEntries).length,
    structuredEffects: coverage.totalEffects,
    supportedEffects: coverage.supportedEffects,
    unsupportedEffects: coverage.unsupportedEffects,
    emptyCanonicalEntries: emptyEntries.length,
    emptyStarterEntries: emptyEntries.filter((catalogId) => cardsByCatalogId.get(catalogId)?.cardType === "Starter").length,
    fullyPlannedCards,
    comboCards: comboCards.length,
    unsupportedCombos,
    executionFilesChecked: executionFiles.length,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const report = await certifyPlaytest();
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) {
    console.error(`Playtest certification FAILED:\n${report.failures.map((failure) => ` - ${failure}`).join("\n")}`);
    process.exitCode = 1;
  } else {
    console.error(`Playtest certification PASS — ${report.catalogCards}/${report.catalogCards} catalog cards use canonical structured execution.`);
  }
}
