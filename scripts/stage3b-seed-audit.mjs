import { readFile, readdir, writeFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const seed = await readJson("content/card-effects-seed.json");
const files = (await readdir("content/card-effects"))
  .filter((file) => file.endsWith(".json"))
  .sort();

const authored = new Map();
for (const file of files) {
  const registry = await readJson(`content/card-effects/${file}`);
  for (const catalogId of Object.keys(registry.cards ?? {})) {
    authored.set(catalogId, file);
  }
}

const seedIds = Object.keys(seed.cards ?? {}).sort();
const overridden = seedIds.filter((catalogId) => authored.has(catalogId));
const unique = seedIds.filter((catalogId) => !authored.has(catalogId));
const byPrefix = Object.groupBy(unique, (catalogId) => catalogId.split("-")[1] ?? "UNKNOWN");

const report = {
  seedTotal: seedIds.length,
  familyFileCount: files.length,
  familyFiles: files,
  overriddenByFamily: overridden.length,
  seedOnlyCount: unique.length,
  seedOnlyByPrefix: Object.fromEntries(Object.entries(byPrefix).map(([prefix, ids]) => [prefix, ids.length])),
  seedOnlyIds: unique,
};

await writeFile("stage3b-seed-audit.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log("STAGE3B_SEED_AUDIT", JSON.stringify(report));
