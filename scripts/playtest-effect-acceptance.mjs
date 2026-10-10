import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));

const cardsJson = readJson("content/cards.json");
const characterEffectsJson = readJson("content/card-effects/characters.json");
const characterEvidence = readJson("qa/playtest-effect-acceptance/character-evidence.json");

const choiceEffects = new Set(["core.choice", "combat.chooseZone"]);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function buildCharacterAcceptanceMatrix() {
  const cards = (cardsJson.cards ?? [])
    .filter((card) => /^DDB-CHR-CORE-\d{3}$/.test(String(card.catalogId ?? "")))
    .sort((left, right) => String(left.catalogId).localeCompare(String(right.catalogId)));
  const registry = characterEffectsJson.cards ?? {};

  const rows = cards.map((card) => {
    const structured = registry[card.catalogId] ?? null;
    const effects = structured?.effects ?? [];
    const evidence = characterEvidence[card.catalogId] ?? {};
    return {
      catalogId: card.catalogId,
      name: card.name,
      family: "Character",
      reachableInQuickDuel: null,
      structuredDefinitionPresent: Boolean(structured),
      trigger: unique(effects.map((effect) => effect.trigger)),
      resolverRuntimeOwner: unique(effects.map((effect) => effect.resolver)),
      liveHostConnected: null,
      playerExecutionVerified: false,
      aiExecutionVerified: false,
      choiceUiRequired: effects.some((effect) => choiceEffects.has(String(effect.effect ?? ""))),
      choiceUiVerified: null,
      stateMutationVerified: false,
      durationResetVerified: false,
      effectVisibleUnderstandable: null,
      regressionTestPresent: false,
      executionStatus: "PENDING_EXECUTION",
      failureCategories: [],
      finalCertificationStatus: "PENDING_EXECUTION",
      rootCause: "Not yet executed through the card-effect acceptance harness.",
      ...evidence,
    };
  });

  const statusCounts = rows.reduce((counts, row) => {
    counts[row.finalCertificationStatus] = (counts[row.finalCertificationStatus] ?? 0) + 1;
    return counts;
  }, {});
  const executionCounts = rows.reduce((counts, row) => {
    counts[row.executionStatus] = (counts[row.executionStatus] ?? 0) + 1;
    return counts;
  }, {});
  const failureCounts = rows.reduce((counts, row) => {
    for (const status of row.failureCategories) counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});

  return {
    family: "Character",
    canonicalSource: "content/cards.json",
    structuredSource: "content/card-effects/characters.json",
    evidenceSource: "qa/playtest-effect-acceptance/character-evidence.json",
    canonicalCoreCount: rows.length,
    statusCounts,
    executionCounts,
    failureCounts,
    rows,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(buildCharacterAcceptanceMatrix(), null, 2)}\n`);
}
