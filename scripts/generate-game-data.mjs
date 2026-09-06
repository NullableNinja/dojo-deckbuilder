import { readFile, writeFile } from "node:fs/promises";
import { expectedCardEffectAggregate } from "./card-effect-registry.mjs";

const root = new URL("../", import.meta.url);
const readText = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));
const writeJson = async (path, value) => writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`, "utf8");

const [source, rules, cards, effectsText, effectArchitecture] = await Promise.all([
  readJson("content/dojo-game.json"),
  readJson("content/rules.json"),
  readJson("content/cards.json"),
  readText("content/effects.json"),
  expectedCardEffectAggregate(),
]);
const effects = JSON.parse(effectsText);
const { aggregate: cardEffects, families } = effectArchitecture;

if (!source?.definition) throw new Error("content/dojo-game.json is missing definition");
if (source.rulesVersion !== source.definition.rulesVersion) throw new Error("Canonical rulesVersion does not match definition.rulesVersion");
if (source.rulesRevision !== source.definition.rulesRevision) throw new Error("Canonical rulesRevision does not match definition.rulesRevision");
if (!String(rules.version ?? "").startsWith(source.rulesVersion)) throw new Error(`content/rules.json version '${rules.version ?? "missing"}' does not match ${source.rulesVersion}`);
if (!String(cards.version ?? "").startsWith(source.rulesVersion)) throw new Error(`content/cards.json version '${cards.version ?? "missing"}' does not match ${source.rulesVersion}`);
if (effects.rulesVersion !== source.rulesVersion) throw new Error(`content/effects.json rulesVersion '${effects.rulesVersion ?? "missing"}' does not match ${source.rulesVersion}`);
if (effects.rulesRevision !== source.rulesRevision) throw new Error(`content/effects.json rulesRevision '${effects.rulesRevision ?? "missing"}' does not match ${source.rulesRevision}`);
if (cardEffects.rulesVersion !== source.rulesVersion) throw new Error(`Generated card-effects rulesVersion '${cardEffects.rulesVersion ?? "missing"}' does not match ${source.rulesVersion}`);
if (cardEffects.rulesRevision !== source.rulesRevision) throw new Error(`Generated card-effects rulesRevision '${cardEffects.rulesRevision ?? "missing"}' does not match ${source.rulesRevision}`);
if (cards.total !== cards.cards?.length) throw new Error("content/cards.json total does not match cards.length");

await Promise.all([
  writeJson("content/card-effects.json", cardEffects),
  writeJson("app/data/game-definition.json", source.definition),
  writeJson("app/data/rules.json", rules),
  writeJson("app/data/cards.json", cards),
  writeFile(new URL("app/data/effects.json", root), effectsText.endsWith("\n") ? effectsText : `${effectsText}\n`, "utf8"),
  writeJson("app/data/card-effects.json", cardEffects),
]);

console.log(`Generated content/card-effects.json from the Stage 3B seed + ${families.length} active family source file${families.length === 1 ? "" : "s"}.`);
console.log(`Validated and copied content/effects.json (${Object.keys(effects.effects ?? {}).length} canonical reusable effects).`);
console.log(`Generated app/data/game-definition.json from content/dojo-game.json (${source.rulesRevision}).`);
console.log("Generated app/data/rules.json from content/rules.json.");
console.log(`Generated app/data/cards.json from content/cards.json (${cards.total} cards).`);
console.log(`Generated app/data/card-effects.json from the unified registry (${Object.keys(cardEffects.cards ?? {}).length} migrated cards).`);
