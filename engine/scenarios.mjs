import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const clone = (value) => structuredClone(value);

function mergePatch(target, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return clone(patch);
  const next = target && typeof target === "object" && !Array.isArray(target) ? clone(target) : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key];
    else next[key] = value && typeof value === "object" && !Array.isArray(value) ? mergePatch(next[key], value) : clone(value);
  }
  return next;
}

export function applyScenario(data, scenario = {}) {
  if (!scenario || typeof scenario !== "object") throw new Error("Scenario must be an object");
  if (scenario.baseRulesVersion && scenario.baseRulesVersion !== data.definition.rulesVersion) throw new Error(`Scenario ${scenario.id ?? "unknown"} expects ${scenario.baseRulesVersion}, loaded ${data.definition.rulesVersion}`);
  const next = {
    ...data,
    definition: mergePatch(data.definition, scenario.definitionPatch ?? {}),
    cards: data.cards.map((card) => mergePatch(card, scenario.cardPatches?.[card.catalogId] ?? {})),
    cardEffects: mergePatch(data.cardEffects, scenario.cardEffectsPatch ?? {}),
  };
  next.byId = new Map(next.cards.map((card) => [card.catalogId, card]));
  next.cardEffectById = new Map(Object.entries(next.cardEffects.cards ?? {}));
  return next;
}

export async function loadScenario(path) {
  const scenario = JSON.parse(await readFile(resolve(path), "utf8"));
  if (!scenario.id) throw new Error(`Scenario ${path} has no id`);
  return scenario;
}

export function scenarioSummary(scenario) {
  return {
    id: scenario.id ?? "unnamed",
    description: scenario.description ?? "",
    definitionKeys: Object.keys(scenario.definitionPatch ?? {}),
    cardPatches: Object.keys(scenario.cardPatches ?? {}).length,
    cardEffectsPatched: Object.keys(scenario.cardEffectsPatch?.cards ?? {}).length,
  };
}
