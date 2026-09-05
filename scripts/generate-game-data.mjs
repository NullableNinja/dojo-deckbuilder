import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const writeJson = async (path, value) => writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`, "utf8");

const [source, rules] = await Promise.all([
  readJson("content/dojo-game.json"),
  readJson("content/rules.json"),
]);

if (!source?.definition) throw new Error("content/dojo-game.json is missing definition");
if (source.rulesVersion !== source.definition.rulesVersion) throw new Error("Canonical rulesVersion does not match definition.rulesVersion");
if (source.rulesRevision !== source.definition.rulesRevision) throw new Error("Canonical rulesRevision does not match definition.rulesRevision");
if (!String(rules.version ?? "").startsWith(source.rulesVersion)) throw new Error(`content/rules.json version '${rules.version ?? "missing"}' does not match ${source.rulesVersion}`);

await Promise.all([
  writeJson("app/data/game-definition.json", source.definition),
  writeJson("app/data/rules.json", rules),
]);

console.log(`Generated app/data/game-definition.json from content/dojo-game.json (${source.rulesRevision}).`);
console.log("Generated app/data/rules.json from content/rules.json.");
