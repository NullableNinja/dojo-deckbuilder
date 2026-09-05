import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readText = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

const [source, generated, canonicalRules, generatedRules, canonicalCards, generatedCards] = await Promise.all([
  readJson("content/dojo-game.json"),
  readJson("app/data/game-definition.json"),
  readJson("content/rules.json"),
  readJson("app/data/rules.json"),
  readJson("content/cards.json"),
  readJson("app/data/cards.json"),
]);

const failures = [];
const fail = (message) => failures.push(message);
const normalized = (value) => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

if (!source?.definition) fail("content/dojo-game.json is missing definition");
if (source.rulesVersion !== source.definition?.rulesVersion) fail("source rulesVersion does not match definition.rulesVersion");
if (source.rulesRevision !== source.definition?.rulesRevision) fail("source rulesRevision does not match definition.rulesRevision");
if (source.definition?.source !== "content/rules.json") fail("definition.source must point to content/rules.json");
if (!sameJson(generated, source.definition)) fail("app/data/game-definition.json has drifted from content/dojo-game.json; run npm run game:generate");
if (!sameJson(generatedRules, canonicalRules)) fail("app/data/rules.json has drifted from content/rules.json; run npm run game:generate");
if (!sameJson(generatedCards, canonicalCards)) fail("app/data/cards.json has drifted from content/cards.json; run npm run game:generate");
if (!String(canonicalRules.version ?? "").startsWith(source.rulesVersion)) fail(`content/rules.json version '${canonicalRules.version ?? "missing"}' does not match ${source.rulesVersion}`);
if (!String(canonicalCards.version ?? "").startsWith(source.rulesVersion)) fail(`content/cards.json version '${canonicalCards.version ?? "missing"}' does not match ${source.rulesVersion}`);
if (!String(generatedCards.version ?? "").startsWith(source.rulesVersion)) fail(`app/data/cards.json version '${generatedCards.version ?? "missing"}' does not match ${source.rulesVersion}`);
if (canonicalCards.total !== canonicalCards.cards?.length) fail("content/cards.json total does not match cards.length");
if (generatedCards.total !== generatedCards.cards?.length) fail("app/data/cards.json total does not match cards.length");

const expectedAuthoritative = new Set(["content/dojo-game.json", "content/rules.json", "content/cards.json"]);
for (const path of expectedAuthoritative) {
  if (!source.sourcePolicy?.authoritativeFiles?.includes(path)) fail(`${path} is canonical but missing from sourcePolicy.authoritativeFiles`);
}
const expectedGenerated = new Set(["app/data/game-definition.json", "app/data/rules.json", "app/data/cards.json"]);
for (const path of expectedGenerated) {
  if (!source.sourcePolicy?.generatedFiles?.includes(path)) fail(`${path} is generated but missing from sourcePolicy.generatedFiles`);
}
const legacySources = source.sourcePolicy?.legacySourcesPendingMigration ?? [];
if (legacySources.length) fail(`Legacy authoritative sources remain after Stage 3A: ${legacySources.join(", ")}`);

const catalogIds = new Set();
for (const card of canonicalCards.cards ?? []) {
  if (!card.catalogId) {
    fail(`Card '${card.name ?? card.id ?? "unknown"}' has no catalogId`);
  } else if (catalogIds.has(card.catalogId)) {
    fail(`Duplicate catalogId ${card.catalogId}`);
  } else {
    catalogIds.add(card.catalogId);
  }
  if (!String(card.name ?? "").trim()) fail(`Card '${card.catalogId ?? card.id ?? "unknown"}' has no name`);
}
for (const entry of source.definition?.starterDeck ?? []) {
  if (!catalogIds.has(entry.catalogId)) fail(`Starter card ${entry.catalogId} is missing from content/cards.json`);
}
const starterDeckCount = (source.definition?.starterDeck ?? []).reduce((sum, entry) => sum + Number(entry.copies ?? 0), 0);
if (starterDeckCount !== 15) fail(`Starter Deck should contain 15 cards; canonical definition contains ${starterDeckCount}`);

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
  console.log("Generated runtime outputs: app/data/game-definition.json, app/data/rules.json, app/data/cards.json");
  console.log("Legacy authoritative data sources: none");
}
