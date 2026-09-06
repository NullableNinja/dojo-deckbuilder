import { readFile, writeFile } from "node:fs/promises";

const seed = JSON.parse(await readFile("content/card-effects-seed.json", "utf8"));
const starterCards = Object.fromEntries(
  Object.entries(seed.cards ?? {})
    .filter(([catalogId]) => catalogId.includes("-STA-CORE-"))
    .sort(([left], [right]) => left.localeCompare(right)),
);

if (Object.keys(starterCards).length !== 11) {
  throw new Error(`Expected 11 Core Starter structured-effect entries, found ${Object.keys(starterCards).length}.`);
}

const registry = {
  schemaVersion: 1,
  rulesVersion: seed.rulesVersion,
  rulesRevision: seed.rulesRevision,
  family: "Starter",
  cards: starterCards,
};

await writeFile("content/card-effects/starters.json", `${JSON.stringify(registry, null, 2)}\n`, "utf8");
console.log(`Materialized content/card-effects/starters.json (${Object.keys(starterCards).length} Core Starter cards).`);
