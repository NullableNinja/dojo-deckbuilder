import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

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
const gameDefinition = await readJson("content/dojo-game.json");
const playtest = await readText("app/playtest.tsx");
const appFiles = await walk("app");
const testFiles = await walk("tests");
const appSources = new Map(await Promise.all(appFiles.map(async (path) => [path, await readText(path)])));
const testSources = new Map(await Promise.all(testFiles.map(async (path) => [path, await readText(path)])));
const allAppSource = [...appSources.values()].join("\n");
const allTestSource = [...testSources.values()].join("\n");

const catalogCards = cardsCatalog.cards ?? [];
const cardByCatalogId = new Map(catalogCards.map((card) => [card.catalogId, card]));
const starterCatalogIds = new Set((gameDefinition.starterDeck ?? []).map((entry) => entry.catalogId));

const locationNameBlock = playtest.match(/const QUICK_DUEL_LOCATION_NAMES = new Set\(\[([\s\S]*?)\]\);/m)?.[1] ?? "";
const quickDuelLocationNames = new Set([...locationNameBlock.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]));

const familyFromId = (id) => {
  const code = String(id).match(/^DDB-([A-Z]+)-/)?.[1] ?? "UNKNOWN";
  return ({
    STA: "Starter",
    ATK: "Attack",
    DEF: "Defense",
    KAT: "Kata",
    CON: "Consumable",
    DEQ: "Equipment",
    GEA: "Equipment",
    WPN: "Equipment",
    CMB: "Combo",
    LOC: "Location",
    CHR: "Character",
  })[code] ?? code;
};

const countOccurrences = (source, token) => token ? source.split(token).length - 1 : 0;
const callCount = (token) => countOccurrences(playtest, `${token}(`);

const familyHostEvidence = {
  Attack: () => /finalAttack|attackPiercing|effectPlanForCard/.test(playtest),
  Defense: () => callCount("defenseRuntimeCommands") > 0,
  Consumable: () => callCount("consumableRuntimeCommands") > 0,
  Equipment: () => /equipmentActivationPlan|equipmentOnEquipPlan|defenseEquipmentBonus/.test(playtest),
  Kata: () => /isKata\(|applyCardEffects/.test(playtest),
  Starter: () => /starterIds|applyCardEffects/.test(playtest),
  Combo: () => callCount("publishQuickDuelPlaytestLifecycleEvent") > 0 || callCount("prepareQuickDuelPlaytestAttack") > 0,
  Location: () => /resolveLocationEffects\(|structuredLocation|locationRuntimeDelta\(/.test(playtest),
  Character: () => callCount("publishQuickDuelPlaytestCharacterEvent") > 0,
};

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
  if (["Attack", "Defense", "Kata", "Consumable", "Equipment"].includes(family)) {
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
for (const [cardId, cardEntry] of Object.entries(effectsRegistry.cards ?? {})) {
  const family = familyFromId(cardId);
  const card = cardByCatalogId.get(cardId);
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
    const familyHost = Boolean(familyHostEvidence[family]?.());
    const resolverEvidence = !resolver || resolverFiles.length > 0;
    const testEvidence = testFilesForEffect.length > 0;

    let certification = "UNVERIFIED";
    let rootCause = "No effect-specific executable proof yet.";
    if (!reachability.reachable) {
      certification = "FAIL_POOL";
      rootCause = reachability.reason;
    } else if (!familyHost) {
      certification = "FAIL_HOST";
      rootCause = `${family} structured runtime is not demonstrably published by app/playtest.tsx.`;
    } else if (!resolverEvidence) {
      certification = "FAIL_RESOLVER";
      rootCause = resolver ? `Resolver ${resolver} has no implementation reference in app source.` : "No executable generic/resolver evidence.";
    } else if (!testEvidence) {
      certification = "UNVERIFIED_TEST";
      rootCause = "Host path exists, but no regression test mentions this effect ID or resolver.";
    } else {
      certification = "STATIC_PASS";
      rootCause = "Pool, host, resolver, and regression-test evidence exist; dynamic gameplay certification still required.";
    }

    rows.push({
      family,
      cardId,
      cardName: cardEntry.name ?? card?.name ?? cardId,
      effectId,
      effect: mechanicalEffect,
      trigger,
      resolver,
      cardReachable: reachability.reachable,
      reachabilityReason: reachability.reason,
      familyHostEvidence: familyHost,
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
  byFamily[row.family].effects += 1;
  byFamily[row.family].statuses[row.certification] = (byFamily[row.family].statuses[row.certification] ?? 0) + 1;
  byStatus[row.certification] = (byStatus[row.certification] ?? 0) + 1;
}

const cardsWithEffects = new Set(rows.map((row) => row.cardId));
const failedCards = new Set(rows.filter((row) => row.certification.startsWith("FAIL") || row.certification.startsWith("UNVERIFIED")).map((row) => row.cardId));
const summary = {
  generatedAt: new Date().toISOString(),
  source: "content/card-effects.json",
  effects: rows.length,
  cardsWithStructuredEffects: cardsWithEffects.size,
  cardsNotFullyCertified: failedCards.size,
  byStatus,
  byFamily,
  quickDuelLocationPoolSize: quickDuelLocationNames.size,
  caveat: "STATIC_PASS is not final gameplay certification. It means static pool/host/resolver/test evidence exists. Final certification requires deterministic runtime scenarios for the exact effect.",
};

await mkdir(new URL("reports/", root), { recursive: true });
await writeFile(new URL("reports/runtime-effect-certification.json", root), `${JSON.stringify({ summary, rows }, null, 2)}\n`);

const markdown = [
  "# Runtime Effect Certification",
  "",
  `Generated from canonical \`content/card-effects.json\`.`,
  "",
  `- Structured effects: **${summary.effects}**`,
  `- Cards with structured effects: **${summary.cardsWithStructuredEffects}**`,
  `- Cards not fully certified: **${summary.cardsNotFullyCertified}**`,
  `- Quick Duel Location pool: **${summary.quickDuelLocationPoolSize}**`,
  "",
  "## Status totals",
  "",
  "| Status | Effects |",
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
  ...rows.filter((row) => row.certification !== "STATIC_PASS").map((row) => `| ${row.family} | ${row.cardId} ${row.cardName.replaceAll("|", "\\|")} | ${row.effectId} | ${row.trigger} | ${row.resolver || "—"} | ${row.certification} | ${row.rootCause.replaceAll("|", "\\|")} |`),
  "",
  "> `STATIC_PASS` is deliberately not called certified. Final certification requires a deterministic gameplay scenario proving the effect mutates live Quick Duel state correctly for human and AI paths where applicable.",
  "",
].join("\n");
await writeFile(new URL("reports/runtime-effect-certification.md", root), markdown);

console.log(JSON.stringify(summary, null, 2));
