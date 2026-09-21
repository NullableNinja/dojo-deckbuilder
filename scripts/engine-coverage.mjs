import { readFile } from "node:fs/promises";
import { analyzeEffectCoverage } from "../engine/coverage.mjs";

const root = new URL("../", import.meta.url);
const registry = JSON.parse(await readFile(new URL("app/data/card-effects.json", root), "utf8"));
const report = analyzeEffectCoverage(registry);
console.log(JSON.stringify({ rulesVersion: registry.rulesVersion, ...report }, null, 2));
