import { readFile } from "node:fs/promises";
import { expectedCardEffectAggregate } from "./card-effect-registry.mjs";

const root = new URL("../", import.meta.url);
const readText = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

const failures = [];
const fail = (message) => failures.push(message);
const normalized = (value) => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

let effectArchitecture = null;
try {
  effectArchitecture = await expectedCardEffectAggregate();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const [source, generated, canonicalRules, generatedRules, canonicalCards, generatedCards, canonicalVocabulary, generatedVocabulary, canonicalCardEffects, generatedCardEffects] = await Promise.all([
  readJson("content/dojo-game.json"),
  readJson("app/data/game-definition.json"),
  readJson("content/rules.json"),
  readJson("app/data/rules.json"),
  readJson("content/cards.json"),
  readJson("app/data/cards.json"),
  readJson("content/effects.json"),
  readJson("app/data/effects.json"),
  readJson("content/card-effects.json"),
  readJson("app/data/card-effects.json"),
]);

if (!source?.definition) fail("content/dojo-game.json is missing definition");
if (source.rulesVersion !== source.definition?.rulesVersion) fail("source rulesVersion does not match definition.rulesVersion");
if (source.rulesRevision !== source.definition?.rulesRevision) fail("source rulesRevision does not match definition.rulesRevision");
if (source.definition?.source !== "content/rules.json") fail("definition.source must point to content/rules.json");
if (!sameJson(generated, source.definition)) fail("app/data/game-definition.json has drifted from content/dojo-game.json; run npm run game:generate");
if (!sameJson(generatedRules, canonicalRules)) fail("app/data/rules.json has drifted from content/rules.json; run npm run game:generate");
if (!sameJson(generatedCards, canonicalCards)) fail("app/data/cards.json has drifted from content/cards.json; run npm run game:generate");
if (!sameJson(generatedVocabulary, canonicalVocabulary)) fail("app/data/effects.json has drifted from content/effects.json; run npm run game:generate");
if (effectArchitecture && !sameJson(canonicalCardEffects, effectArchitecture.aggregate)) fail("content/card-effects.json has drifted from the effect seed/family sources; run npm run game:generate");
if (!sameJson(generatedCardEffects, canonicalCardEffects)) fail("app/data/card-effects.json has drifted from content/card-effects.json; run npm run game:generate");
if (!String(canonicalRules.version ?? "").startsWith(source.rulesVersion)) fail(`content/rules.json version '${canonicalRules.version ?? "missing"}' does not match ${source.rulesVersion}`);
if (!String(canonicalCards.version ?? "").startsWith(source.rulesVersion)) fail(`content/cards.json version '${canonicalCards.version ?? "missing"}' does not match ${source.rulesVersion}`);
if (canonicalVocabulary.rulesVersion !== source.rulesVersion) fail(`content/effects.json rulesVersion '${canonicalVocabulary.rulesVersion ?? "missing"}' does not match ${source.rulesVersion}`);
if (canonicalVocabulary.rulesRevision !== source.rulesRevision) fail(`content/effects.json rulesRevision '${canonicalVocabulary.rulesRevision ?? "missing"}' does not match ${source.rulesRevision}`);
if (canonicalCardEffects.rulesVersion !== source.rulesVersion) fail(`content/card-effects.json rulesVersion '${canonicalCardEffects.rulesVersion ?? "missing"}' does not match ${source.rulesVersion}`);
if (canonicalCardEffects.rulesRevision !== source.rulesRevision) fail(`content/card-effects.json rulesRevision '${canonicalCardEffects.rulesRevision ?? "missing"}' does not match ${source.rulesRevision}`);
if (canonicalCards.total !== canonicalCards.cards?.length) fail("content/cards.json total does not match cards.length");
if (generatedCards.total !== generatedCards.cards?.length) fail("app/data/cards.json total does not match cards.length");

const expectedAuthoritative = new Set([
  "content/dojo-game.json",
  "content/rules.json",
  "content/cards.json",
  "content/effects.json",
  "content/card-effect.schema.json",
  "content/card-effect-family.schema.json",
]);
for (const path of expectedAuthoritative) {
  if (!source.sourcePolicy?.authoritativeFiles?.includes(path)) fail(`${path} is canonical but missing from sourcePolicy.authoritativeFiles`);
}
if (!source.sourcePolicy?.authoritativeGlobs?.includes("content/card-effects/*.json")) fail("content/card-effects/*.json is canonical but missing from sourcePolicy.authoritativeGlobs");
if (!source.sourcePolicy?.temporaryMigrationSeeds?.includes("content/card-effects-seed.json")) fail("content/card-effects-seed.json must be declared as a temporary Stage 3B migration seed until the split is complete");

const expectedGenerated = new Set([
  "content/card-effects.json",
  "app/data/game-definition.json",
  "app/data/rules.json",
  "app/data/cards.json",
  "app/data/effects.json",
  "app/data/card-effects.json",
]);
for (const path of expectedGenerated) {
  if (!source.sourcePolicy?.generatedFiles?.includes(path)) fail(`${path} is generated but missing from sourcePolicy.generatedFiles`);
}
const legacySources = source.sourcePolicy?.legacySourcesPendingMigration ?? [];
if (legacySources.length) fail(`Legacy authoritative sources remain after Stage 3A: ${legacySources.join(", ")}`);

const catalogIds = new Set();
const cardsByCatalogId = new Map();
for (const card of canonicalCards.cards ?? []) {
  if (!card.catalogId) {
    fail(`Card '${card.name ?? card.id ?? "unknown"}' has no catalogId`);
  } else if (catalogIds.has(card.catalogId)) {
    fail(`Duplicate catalogId ${card.catalogId}`);
  } else {
    catalogIds.add(card.catalogId);
    cardsByCatalogId.set(card.catalogId, card);
  }
  if (!String(card.name ?? "").trim()) fail(`Card '${card.catalogId ?? card.id ?? "unknown"}' has no name`);
}

const vocabularyEffects = canonicalVocabulary.effects ?? {};
const canonicalConditions = canonicalVocabulary.conditions ?? {};
const canonicalOperators = canonicalVocabulary.conditionOperators ?? {};
if (!Object.keys(vocabularyEffects).length) fail("content/effects.json contains no canonical effects");
for (const [effectId, definition] of Object.entries(vocabularyEffects)) {
  if (!/^[a-z][a-z0-9-]*\.[A-Za-z][A-Za-z0-9]*$/.test(effectId)) fail(`Canonical effect ID '${effectId}' does not use namespace.camelCase format`);
  if (!String(definition.description ?? "").trim()) fail(`Canonical effect '${effectId}' has no description`);
  if (!String(definition.action ?? "").trim()) fail(`Canonical effect '${effectId}' has no runtime action`);
  if (!Array.isArray(definition.allowedTriggers) || !definition.allowedTriggers.length) fail(`Canonical effect '${effectId}' has no allowedTriggers`);
  if (!Array.isArray(definition.allowedTargets) || !definition.allowedTargets.length) fail(`Canonical effect '${effectId}' has no allowedTargets`);
}

const starterEntries = source.definition?.starterDeck ?? [];
for (const entry of starterEntries) {
  if (!catalogIds.has(entry.catalogId)) fail(`Starter card ${entry.catalogId} is missing from content/cards.json`);
}
const starterDeckCount = starterEntries.reduce((sum, entry) => sum + Number(entry.copies ?? 0), 0);
if (starterDeckCount !== 15) fail(`Starter Deck should contain 15 cards; canonical definition contains ${starterDeckCount}`);

const validTriggers = new Set(["onPlay", "onHit", "onBlock", "afterResolve", "onEquip", "onPurchase", "onInitiate", "onHide", "onAttackDeclared", "onDefenseDeclared", "passive"]);
const validActions = new Set(["draw", "discard", "heal", "gainFocus", "modifySpeed", "modifyAttackPower", "modifyGuard", "dealDamage", "piercing", "destroy", "ready", "exhaust", "preventDamage", "chooseZone", "custom"]);
const structuredEntries = Object.entries(canonicalCardEffects.cards ?? {});
if (structuredEntries.length < 11) fail(`Structured effect migration must contain at least the 11 Starter card identities; found ${structuredEntries.length}`);
for (const [catalogId, entry] of structuredEntries) {
  const card = cardsByCatalogId.get(catalogId);
  if (!card) {
    fail(`Structured effect entry ${catalogId} does not resolve to a canonical card`);
    continue;
  }
  if (entry.name !== card.name) fail(`Structured effect entry ${catalogId} is named '${entry.name}' but canonical card is '${card.name}'`);
  if (!Array.isArray(entry.effects)) {
    fail(`Structured effect entry ${catalogId} must contain an effects array`);
    continue;
  }
  const effectIds = new Set();
  for (const effect of entry.effects) {
    if (!validTriggers.has(effect.trigger)) fail(`${catalogId} uses unsupported trigger '${effect.trigger}'`);
    if (!validActions.has(effect.action)) fail(`${catalogId} uses unsupported action '${effect.action}'`);
    if (effect.effect) {
      const definition = vocabularyEffects[effect.effect];
      if (!definition) fail(`${catalogId} references unknown canonical effect '${effect.effect}'`);
      else if (effect.action !== definition.action) fail(`${catalogId} canonical effect '${effect.effect}' should hydrate to action '${definition.action}', found '${effect.action}'`);
      for (const condition of effect.conditions ?? []) {
        if (!canonicalConditions[condition.kind]) fail(`${catalogId} uses unknown canonical condition '${condition.kind}'`);
        if (condition.operator && !canonicalOperators[condition.operator]) fail(`${catalogId} uses unknown condition operator '${condition.operator}'`);
      }
    }
    if (effect.action === "custom" && !String(effect.resolver ?? "").trim()) fail(`${catalogId} custom effect '${effect.id ?? "unnamed"}' requires resolver`);
    if (effect.id) {
      if (effectIds.has(effect.id)) fail(`${catalogId} has duplicate effect id '${effect.id}'`);
      effectIds.add(effect.id);
    }
  }
}
for (const entry of starterEntries) {
  if (!canonicalCardEffects.cards?.[entry.catalogId]) fail(`Starter card ${entry.catalogId} has not been migrated into the unified card-effect registry`);
}

const chapterIds = new Set();
for (const chapter of canonicalRules.chapters ?? []) {
  if (!chapter.id) fail(`Rule chapter ${chapter.number ?? "?"} has no id`);
  if (chapterIds.has(chapter.id)) fail(`Duplicate rule chapter id ${chapter.id}`);
  chapterIds.add(chapter.id);
  const sectionIds = new Set();
  for (const section of chapter.sections ?? []) {
    if (!section.id) fail(`Rule section '${section.title ?? "unknown"}' in chapter ${chapter.id} has no id`);
    if (sectionIds.has(section.id)) fail(`Duplicate section id ${section.id} inside chapter ${chapter.id}`);
    sectionIds.add(section.id);
  }
}

const glossaryTerms = new Set();
for (const entry of canonicalRules.glossary ?? []) {
  const key = normalized(entry.term);
  if (!key) fail("Glossary contains an entry without a term");
  if (glossaryTerms.has(key)) fail(`Duplicate glossary term ${entry.term}`);
  glossaryTerms.add(key);
}

const rulingIds = new Set();
for (const ruling of canonicalRules.officialRulings ?? []) {
  if (!ruling.id) fail(`Official ruling '${ruling.title ?? "unknown"}' has no id`);
  if (rulingIds.has(ruling.id)) fail(`Duplicate official ruling id ${ruling.id}`);
  rulingIds.add(ruling.id);
}

const houseRuleNames = new Set();
for (const rule of canonicalRules.houseRules ?? []) {
  const key = normalized(rule.name);
  if (!key) fail("House rules contain an unnamed rule");
  if (houseRuleNames.has(key)) fail(`Duplicate house rule ${rule.name}`);
  houseRuleNames.add(key);
}

const collectRuleText = (node) => {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectRuleText).join(" ");
  if (typeof node === "object") return Object.values(node).map(collectRuleText).join(" ");
  return "";
};
const ruleText = normalized(collectRuleText(canonicalRules));
const mustContain = (needle, label = needle) => {
  if (!ruleText.includes(normalized(needle))) fail(`Canonical rules are missing required r5 rule: ${label}`);
};
const mustNotContain = (needle, label = needle) => {
  if (ruleText.includes(normalized(needle))) fail(`Canonical rules still contain retired rule text: ${label}`);
};

mustContain("any number of legal Attack", "unlimited legal Attacks during Yell");
mustContain("draw seven", "seven-card starting hand");
mustContain("Market Mercy", "persistent Market with stagnation refresh");
mustContain("discard one Bad Habit from your hand to gain 1 Focus", "Bad Habit Focus action");
mustContain("After the first Attack you play with Flow each turn resolves, draw one card", "r5 Flow draw");
mustNotContain("normal two-Attack limit", "old two-Attack limit");
mustNotContain("normally play two Attacks", "old two-Attack limit");
mustNotContain("Controlled Refill", "retired Controlled Refill rule");
if (glossaryTerms.has("attack limit")) fail("Retired glossary term 'Attack Limit' is present");
if (glossaryTerms.has("controlled refill")) fail("Retired glossary term 'Controlled Refill' is present");

const beltSection = (canonicalRules.chapters ?? [])
  .flatMap((chapter) => chapter.sections ?? [])
  .find((section) => section.id === "belt-table");
const beltRows = beltSection?.content?.find((entry) => entry.kind === "table")?.rows ?? [];
const expectedBelts = ["white", "yellow", "orange", "green", "purple", "blue", "red", "brown", "black"];
if (beltRows.length !== expectedBelts.length + 1) fail(`Belt Table should contain one header plus nine belts; found ${beltRows.length}`);
const beltNames = beltRows.slice(1).map((row) => normalized(row[0]));
for (const belt of expectedBelts) {
  if (!beltNames.includes(belt)) fail(`Belt Table is missing ${belt}`);
}

if (failures.length) {
  console.error("Dojo canonical-source check FAILED:\n");
  for (const message of failures) console.error(` - ${message}`);
  process.exitCode = 1;
} else {
  console.log(`Dojo canonical-source check PASS — ${source.rulesRevision}`);
  console.log("Canonical mechanical source: content/dojo-game.json");
  console.log("Canonical rules source: content/rules.json");
  console.log(`Canonical card source: content/cards.json (${canonicalCards.total} cards)`);
  console.log(`Canonical effect vocabulary: content/effects.json (${Object.keys(vocabularyEffects).length} reusable effects)`);
  console.log(`Card-effect family sources: ${effectArchitecture?.families.length ?? 0} active family file(s)`);
  console.log(`Unified structured effect registry: content/card-effects.json (${structuredEntries.length} migrated cards)`);
  console.log("Generated runtime outputs: app/data/game-definition.json, app/data/rules.json, app/data/cards.json, app/data/effects.json, app/data/card-effects.json");
  console.log("Temporary Stage 3B effect seed: content/card-effects-seed.json (remove after seeded families are fully split)");
  console.log("Legacy authoritative data sources: none");
}
