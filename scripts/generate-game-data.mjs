import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

const source = await readJson("content/dojo-game.json");

if (!source?.definition) throw new Error("content/dojo-game.json is missing definition");
if (source.rulesVersion !== source.definition.rulesVersion) throw new Error("Canonical rulesVersion does not match definition.rulesVersion");
if (source.rulesRevision !== source.definition.rulesRevision) throw new Error("Canonical rulesRevision does not match definition.rulesRevision");

const output = `${JSON.stringify(source.definition, null, 2)}\n`;
await writeFile(new URL("app/data/game-definition.json", root), output, "utf8");

console.log(`Generated app/data/game-definition.json from content/dojo-game.json (${source.rulesRevision}).`);
