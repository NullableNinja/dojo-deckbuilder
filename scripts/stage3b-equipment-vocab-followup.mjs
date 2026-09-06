import { readFile, writeFile } from "node:fs/promises";
const path = "content/effects.json";
const vocabulary = JSON.parse(await readFile(path, "utf8"));
vocabulary.conditions.consumableUsedThisRound ??= "The controller has resolved at least one Consumable during the current round; used by persistent round-scoped Equipment bonuses created by that use.";
await writeFile(path, `${JSON.stringify(vocabulary, null, 2)}\n`, "utf8");
