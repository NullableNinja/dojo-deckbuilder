import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { cardFamily } from "./card-effect-registry.mjs";
import { characterResolverHostEvidence } from "./runtime-effect-certification-character.mjs";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const readText = async (path) => readFile(new URL(path, root), "utf8");

async function walk(dir, extensions = new Set([".ts", ".tsx", ".mjs", ".js"])) {
  const absolute = new URL(`${dir.replace(/\/$/, "")}/`, root);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = `${dir.replace(/\/$/, "")}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await walk(path, extensions));
    else if (extensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const effectsRegistry = await readJson("content/card-effects.json");
const cardsCatalog = await readJson("content/cards.json");
const dojoGame = await readJson("content/dojo-game.json");
const gameDefinition = dojoGame.definition ?? dojoGame;
const playtest = await readText("app/playtest.tsx");
const appFiles = await walk("app");
const testFiles = await walk("tests");
const appSources = new Map(await Promise.all(appFiles.map(async (path) => [path, await readText(path)])));
const testSources = new Map(await Promise.all(testFiles.map(async (path) => [path, await readText(path)])));
const quickDuelHost = appSources.get("app/quick-duel-playtest-host.ts") ?? "";
const quickDuelTransitionHost = appSources.get("app/quick-duel-transition-host.ts") ?? "";
const quickDuelStructuredHost = appSources.get("app/quick-duel-structured-host.ts") ?? "";
const characterRuntimeSource = appSources.get("app/character-runtime.ts") ?? "";
const characterMigrationSource = appSources.get("app/quick-duel-character-migration.ts") ?? "";

const catalogCards = cardsCatalog.cards ?? [];
const cardByCatalogId = new Map(catalogCards.map((card) => [card.catalogId, card]));
const starterCatalogIds = new Set((gameDefinition.starterDeck ?? []).map((entry) => entry.catalogId));
const mechanicalCatalogCards = catalogCards.filter((card) => Boolean(cardFamily(card)));
const structuredCardIds = new Set(Object.keys(effectsRegistry.cards ?? {}));

const locationNameBlock = playtest.match(/const QUICK_DUEL_LOCATION_NAMES = new Set\(\[([\s\S]*?)\]\);/m)?.[1] ?? "";
const quickDuelLocationNames = new Set([...locationNameBlock.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]));

const countOccurrences = (source, token) => token ? source.split(token).length - 1 : 0;
const callCount = (token) => countOccurrences(playtest, `${token}(`);
const playerCharacterChoiceUiLive = playtest.includes("resolveQuickDuelPlaytestCharacterChoice") && playtest.includes('kind: "character-runtime"');

const familyHostEvidence = {
  Attack: () => /finalAttack|attackPiercing|effectPlanForCard/.test(playtest),
  Defense: () => callCount("defenseRuntimeCommands") > 0,
  Consumable: () => callCount("consumableRuntimeCommands") > 0,
  Equipment: () => /equipmentActivationPlan|equipmentOnEquipPlan|defenseEquipmentBonus/.test(playtest),
  Kata: () => /isKata\(|applyCardEffects/.test(playtest),
  Starter: () => /starterIds|applyCardEffects/.test(playtest),
  Combo: () => callCount("publishQuickDuelPlaytestLifecycleEvent") > 0 || callCount("prepareQuickDuelPlaytestAttack") > 0,
  Location: () => /resolveLocationEffects\(|structuredLocation|locationRuntimeDelta\(/.test(playtest),
  "Reaction Item": () => false,
};

function effectHostEvidence(family) {
  return Boolean(familyHostEvidence[family]?.());
}

function cardReachability(cardId, family) {
  const card = cardByCatalogId.get(cardId);
  if (!card) return { reachable: false, reason: "catalog-card-missing" };
  if (family === "Location") {
    return quickDuelLocationNames.has(card.name)
      ? { reachable: true, reason: "quick-duel-location-pool" }
      : { reachable: false, reason: "excluded-from-quick-duel-location-pool" };
  }
  if (family === "Starter") {
    return starterCatalogIds.has(cardId)
      ? { reachable: true, reason: "starter-deck" }
      : { reachable: false, reason: "not-in-starter-deck" };
  }
  if (family === "Character") return { reachable: true, reason: "character-selector" };
  if (family === "Combo") return { reachable: true, reason: "combo-pool" };
  if (["Attack", "Defense", "Kata", "Consumable", "Equipment", "Reaction Item"].includes(family)) {
    const inPool = card.cardType === "Technique" || card.cardType === "Item";
    return inPool ? { reachable: true, reason: "market-pool" } : { reachable: false, reason: `cardType-${card.cardType}-not-in-market` };
  }
  return { reachable: false, reason: "unclassified-family" };
}

function sourceFilesContaining(token, sources) {
  if (!token) return [];
  return [...sources.entries()].filter(([, source]) => source.includes(token)).map(([path]) => path);
}

const rows = [];
for (const card of mechanicalCatalogCards) {
  if (structuredCardIds.has(card.catalogId)) continue;
  const family = cardFamily(card) ?? "UNKNOWN";
  const reachability = cardReachability(card.catalogId, family);
  rows.push({
    family,
    cardId: card.catalogId,
    cardName: card.name ?? card.catalogId,
    effectId: "",
    effect: "",
    trigger: "",
    resolver: "",
    characterEvents: [],
    characterLiveEvents: [],
    characterOwner: null,
    characterCompatibilityHelper: null,
    cardReachable: reachability.reachable,
    reachabilityReason: reachability.reason,
    familyHostEvidence: false,
    requiresPlayerChoiceUi: false,
    playerChoiceUiEvidence: false,
    resolverEvidence: false,
    resolverFiles: [],
    testEvidence: false,
    testFiles: [],
    certification: "FAIL_STRUCTURE",
    rootCause: "Canonical mechanical card has no structured effect definition in content/card-effects/*.json.",
  });
}

for (const [cardId, cardEntry] of Object.entries(effectsRegistry.cards ?? {})) {
  const card = cardByCatalogId.get(cardId);
  const family = cardFamily(card) ?? "UNKNOWN";
  const reachability = cardReachability(cardId, family);
  for (const effect of cardEntry.effects ?? []) {
    const effectId = String(effect.id ?? "");
    const resolver = String(effect.resolver ?? "");
    const mechanicalEffect = String(effect.effect ?? effect.action ?? "");
    const trigger = String(effect.trigger ?? "");
    const resolverFiles = sourceFilesContaining(resolver, appSources);
    const testFilesForEffect = [...new Set([
      ...sourceFilesContaining(effectId, testSources),
      ...sourceFilesContaining(resolver, testSources),
    ])];
    const characterHost = family === "Character"
      ? characterResolverHostEvidence({
          resolver,
          characterRuntimeSource,
          migrationSource: characterMigrationSource,
          playtestSource: playtest,
          quickDuelHostSource: quickDuelHost,
          quickDuelTransitionSource: quickDuelTransitionHost,
          quickDuelStructuredHostSource: quickDuelStructuredHost,
        })
      : null;
    const familyHost = characterHost ? characterHost.hostLive : effectHostEvidence(family);
    const resolverEvidence = !resolver || resolverFiles.length > 0;
    const testEvidence = testFilesForEffect.length > 0;
    const requiresPlayerChoiceUi = family === "Character" && mechanicalEffect === "core.choice";
    const playerChoiceUiEvidence = !requiresPlayerChoiceUi || playerCharacterChoiceUiLive;

    let certification = "UNVERIFIED";
    let rootCause = "No effect-specific executable proof yet.";
    if (!reachability.reachable) {
      certification = "FAIL_POOL";
      rootCause = reachability.reason;
    } else if (!familyHost) {
      certification = "FAIL_HOST";
      rootCause = characterHost?.reason ?? `${family} structured runtime is not demonstrably published by app/playtest.tsx.`;
    } else if (!playerChoiceUiEvidence) {
      certification = "FAIL_CHOICE_UI";
      rootCause = "The Character event reaches the structured host, but app/playtest.tsx does not yet surface and resume CharacterRuntimeChoice for the player.";
    } else if (!resolverEvidence) {
      certification = "FAIL_RESOLVER";
      rootCause = resolver ? `Resolver ${resolver} has no implementation reference in app source.` : "No executable generic/resolver evidence.";
    } else if (!testEvidence) {
      certification = "UNVERIFIED_TEST";
      rootCause = "Host path exists, but no regression test mentions this effect ID or resolver.";
    } else {
      certification = "STATIC_PASS";
      rootCause = characterHost?.reason ?? "Pool, host, resolver, and regression-test evidence exist; dynamic gameplay certification still required.";
    }

    rows.push({
      family,
      cardId,
      cardName: cardEntry.name ?? card?.name ?? cardId,
      effectId,
      effect: mechanicalEffect,
      trigger,
      resolver,
      characterEvents: characterHost?.events ?? [],
      characterLiveEvents: characterHost?.liveEvents ?? [],
      characterOwner: characterHost?.owner ?? null,
      characterCompatibilityHelper: characterHost?.helper ?? null,
      cardReachable: reachability.reachable,
      reachabilityReason: reachability.reason,
      familyHostEvidence: familyHost,
      requiresPlayerChoiceUi,
      playerChoiceUiEvidence,
      resolverEvidence,
      resolverFiles,
      testEvidence,
      testFiles: testFilesForEffect,
      certification,
      rootCause,
    });
  }
}

const byFamily = {};
const byStatus = {};
for (const row of rows) {
  byFamily[row.family] ??= { effects: 0, statuses: {} };
  if (row.effectId) byFamily[row.family].effects += 1;
  byFamily[row.family].statuses[row.certification] = (byFamily[row.family].statuses[row.certification] ?? 0) + 1;
  byStatus[row.certification] = (byStatus[row.certification] ?? 0) + 1;
}

const effectRows = rows.filter((row) => row.effectId);
const missingStructureRows = rows.filter((row) => row.certification === "FAIL_STRUCTURE");
const cardsWithEffects = new Set(effectRows.map((row) => row.cardId));
const failedCards = new Set(rows.filter((row) => row.certification.startsWith("FAIL") || row.certification.startsWith("UNVERIFIED")).map((row) => row.cardId));
const summary = {
  generatedAt: new Date().toISOString(),
  source: "content/card-effects.json",
  mechanicalCanonicalCards: mechanicalCatalogCards.length,
  structuredDefinitions: structuredCardIds.size,
  missingStructuredDefinitions: missingStructureRows.length,
  effects: effectRows.length,
  cardsWithStructuredEffects: cardsWithEffects.size,
  cardsNotFullyCertified: failedCards.size,
  byStatus,
  byFamily,
  quickDuelLocationPoolSize: quickDuelLocationNames.size,
  starterDeckCardCount: starterCatalogIds.size,
  characterChoiceUiLive: playerCharacterChoiceUiLive,
  caveat: "STATIC_PASS is not final gameplay certification. It means static pool/host/resolver/test evidence exists. Final certification requires deterministic runtime scenarios for the exact effect.",
};

await mkdir(new URL("reports/", root), { recursive: true });
await writeFile(new URL("reports/runtime-effect-certification.json", root), `${JSON.stringify({ summary, rows }, null, 2)}\n`);

const markdown = [
  "# Runtime Effect Certification",
  "",
  `Generated from canonical \`content/cards.json\` and \`content/card-effects.json\`.`,
  "",
  `- Canonical mechanical cards: **${summary.mechanicalCanonicalCards}**`,
  `- Structured definitions: **${summary.structuredDefinitions}**`,
  `- Missing structured definitions: **${summary.missingStructuredDefinitions}**`,
  `- Structured effects: **${summary.effects}**`,
  `- Cards with structured effects: **${summary.cardsWithStructuredEffects}**`,
  `- Cards not fully certified: **${summary.cardsNotFullyCertified}**`,
  `- Quick Duel Location pool: **${summary.quickDuelLocationPoolSize}**`,
  `- Canonical Starter deck card identities: **${summary.starterDeckCardCount}**`,
  `- Player Character choice UI wired: **${summary.characterChoiceUiLive ? "yes" : "no"}**`,
  "",
  "## Status totals",
  "",
  "| Status | Entries |",
  "|---|---:|",
  ...Object.entries(byStatus).sort().map(([status, count]) => `| ${status} | ${count} |`),
  "",
  "## Family totals",
  "",
  "| Family | Effects | Statuses |",
  "|---|---:|---|",
  ...Object.entries(byFamily).sort().map(([family, data]) => `| ${family} | ${data.effects} | ${Object.entries(data.statuses).map(([status, count]) => `${status}: ${count}`).join(", ")} |`),
  "",
  "## Failures / unverified effects",
  "",
  "| Family | Card | Effect | Trigger | Resolver | Status | Root cause |",
  "|---|---|---|---|---|---|---|",
  ...rows.filter((row) => row.certification !== "STATIC_PASS").map((row) => `| ${row.family} | ${row.cardId} ${row.cardName.replaceAll("|", "\\|")} | ${row.effectId || "—"} | ${row.trigger || "—"} | ${row.resolver || "—"} | ${row.certification} | ${row.rootCause.replaceAll("|", "\\|")} |`),
  "",
  "> FAIL_STRUCTURE is derived from the canonical card catalog. A mechanical card cannot disappear from certification merely because its structured definition is missing.",
  "",
  "> Character host certification follows resolver → runtime-event → migration ownership. Raw canonical trigger text is reported for reference but is not treated as execution evidence.",
  "",
  "> `STATIC_PASS` is deliberately not called certified. Final certification requires a deterministic gameplay scenario proving the effect mutates live Quick Duel state correctly for human and AI paths where applicable.",
  "",
].join("\n");
await writeFile(new URL("reports/runtime-effect-certification.md", root), markdown);

console.log(JSON.stringify(summary, null, 2));
