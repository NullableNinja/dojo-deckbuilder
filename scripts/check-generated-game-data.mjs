import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readText = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

const [source, generated, rules, cards] = await Promise.all([
  readJson("content/dojo-game.json"),
  readJson("app/data/game-definition.json"),
  readJson("app/data/rules.json"),
  readJson("app/data/cards.json"),
]);

const failures = [];
const fail = (message) => failures.push(message);

if (!source?.definition) fail("content/dojo-game.json is missing definition");
if (source.rulesVersion !== source.definition?.rulesVersion) fail("source rulesVersion does not match definition.rulesVersion");
if (source.rulesRevision !== source.definition?.rulesRevision) fail("source rulesRevision does not match definition.rulesRevision");
if (JSON.stringify(generated) !== JSON.stringify(source.definition)) fail("app/data/game-definition.json has drifted from content/dojo-game.json; run npm run game:generate");
if (!String(rules.version ?? "").startsWith(source.rulesVersion)) fail(`app/data/rules.json version '${rules.version ?? "missing"}' does not match ${source.rulesVersion}`);
if (!String(cards.version ?? "").startsWith(source.rulesVersion)) fail(`app/data/cards.json version '${cards.version ?? "missing"}' does not match ${source.rulesVersion}`);
if (cards.total !== cards.cards?.length) fail("app/data/cards.json total does not match cards.length");

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

if (failures.length) {
  console.error("Dojo canonical-source check FAILED:\n");
  for (const message of failures) console.error(` - ${message}`);
  process.exitCode = 1;
} else {
  console.log(`Dojo canonical-source check PASS — ${source.rulesRevision}`);
  console.log("Authoritative mechanical source: content/dojo-game.json");
  if (source.sourcePolicy?.legacySourcesPendingMigration?.length) {
    console.log(`Pending migration: ${source.sourcePolicy.legacySourcesPendingMigration.join(", ")}`);
  }
}
