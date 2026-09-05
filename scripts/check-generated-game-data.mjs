import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readText = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

const [source, generated, canonicalRules, generatedRules, cards] = await Promise.all([
  readJson("content/dojo-game.json"),
  readJson("app/data/game-definition.json"),
  readJson("content/rules.json"),
  readJson("app/data/rules.json"),
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
if (!String(canonicalRules.version ?? "").startsWith(source.rulesVersion)) fail(`content/rules.json version '${canonicalRules.version ?? "missing"}' does not match ${source.rulesVersion}`);
if (!String(cards.version ?? "").startsWith(source.rulesVersion)) fail(`app/data/cards.json version '${cards.version ?? "missing"}' does not match ${source.rulesVersion}`);
if (cards.total !== cards.cards?.length) fail("app/data/cards.json total does not match cards.length");

const expectedGenerated = new Set(["app/data/game-definition.json", "app/data/rules.json"]);
for (const path of expectedGenerated) {
  if (!source.sourcePolicy?.generatedFiles?.includes(path)) fail(`${path} is generated but missing from sourcePolicy.generatedFiles`);
}
if (source.sourcePolicy?.legacySourcesPendingMigration?.includes("app/data/rules.json")) fail("app/data/rules.json is still marked legacy even though rules migration is complete");

const catalogIds = new Set();
for (const card of cards.cards ?? []) {
  if (!card.catalogId) {
    fail(`Card '${card.name ?? card.id ?? "unknown"}' has no catalogId`);
    continue;
  }
  if (catalogIds.has(card.catalogId)) fail(`Duplicate catalogId ${card.catalogId}`);
  catalogIds.add(card.catalogId);
}
for (const entry of source.definition?.starterDeck ?? []) {
  if (!catalogIds.has(entry.catalogId)) fail(`Starter card ${entry.catalogId} is missing from app/data/cards.json`);
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
  console.log("Generated rules output: app/data/rules.json");
  if (source.sourcePolicy?.legacySourcesPendingMigration?.length) {
    console.log(`Pending migration: ${source.sourcePolicy.legacySourcesPendingMigration.join(", ")}`);
  }
}
