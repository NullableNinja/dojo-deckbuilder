import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const writeJson = async (path, value) => writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`, "utf8");

const [source, rules, cards, cardEffects] = await Promise.all([
  readJson("content/dojo-game.json"),
  readJson("content/rules.json"),
  readJson("content/cards.json"),
  readJson("content/card-effects.json"),
]);

if (!source?.definition) throw new Error("content/dojo-game.json is missing definition");
if (source.rulesVersion !== source.definition.rulesVersion) throw new Error("Canonical rulesVersion does not match definition.rulesVersion");
if (source.rulesRevision !== source.definition.rulesRevision) throw new Error("Canonical rulesRevision does not match definition.rulesRevision");
if (!String(rules.version ?? "").startsWith(source.rulesVersion)) throw new Error(`content/rules.json version '${rules.version ?? "missing"}' does not match ${source.rulesVersion}`);
if (!String(cards.version ?? "").startsWith(source.rulesVersion)) throw new Error(`content/cards.json version '${cards.version ?? "missing"}' does not match ${source.rulesVersion}`);
if (cardEffects.rulesVersion !== source.rulesVersion) throw new Error(`content/card-effects.json rulesVersion '${cardEffects.rulesVersion ?? "missing"}' does not match ${source.rulesVersion}`);
if (cardEffects.rulesRevision !== source.rulesRevision) throw new Error(`content/card-effects.json rulesRevision '${cardEffects.rulesRevision ?? "missing"}' does not match ${source.rulesRevision}`);
if (cards.total !== cards.cards?.length) throw new Error("content/cards.json total does not match cards.length");

await Promise.all([
  writeJson("app/data/game-definition.json", source.definition),
  writeJson("app/data/rules.json", rules),
  writeJson("app/data/cards.json", cards),
  writeJson("app/data/card-effects.json", cardEffects),
]);

console.log(`Generated app/data/game-definition.json from content/dojo-game.json (${source.rulesRevision}).`);
console.log("Generated app/data/rules.json from content/rules.json.");
console.log(`Generated app/data/cards.json from content/cards.json (${cards.total} cards).`);
console.log(`Generated app/data/card-effects.json from content/card-effects.json (${Object.keys(cardEffects.cards ?? {}).length} migrated cards).`);
