import { readFile } from "node:fs/promises";
import { analyzeEffectCoverage } from "../engine/coverage.mjs";

const root = new URL("../", import.meta.url);
const [registry, catalog, definition] = await Promise.all([
  readFile(new URL("app/data/card-effects.json", root), "utf8").then(JSON.parse),
  readFile(new URL("app/data/cards.json", root), "utf8").then(JSON.parse),
  readFile(new URL("app/data/game-definition.json", root), "utf8").then(JSON.parse),
]);
const report = { rulesVersion: registry.rulesVersion, ...analyzeEffectCoverage(registry, { catalog: catalog.cards, definition }) };
const json = process.argv.includes("--json");
if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const top = (values, limit = 12) => Object.entries(values).slice(0, limit).map(([key, count]) => `${count} ${key}`).join("; ") || "(none)";
  console.log(`Rules ${report.rulesVersion}`);
  console.log(`TOTAL STRUCTURED EFFECTS ${report.totalEffects}`);
  console.log(`STATICALLY RECOGNIZED ${report.staticallyRecognizedEffects}`);
  console.log(`SEMANTICALLY EXECUTABLE ${report.semanticallyExecutableEffects}`);
  console.log(`BEHAVIORALLY CERTIFIED ${report.behaviorallyCertifiedEffects}`);
  console.log(`SUPPORTED ${report.supportedEffects}`);
  console.log(`UNSUPPORTED ${report.unsupportedEffects}`);
  console.log(`OUT-OF-MODE ${report.outOfModeEffects}`);
  console.log(`BASELINE CORE UNSUPPORTED ${report.unsupportedByScope["baseline-core"] ?? 0}`);
  console.log(`CARDS FULLY SUPPORTED ${report.cardsFullySupported.length}`);
  console.log(`CARDS PARTIALLY SUPPORTED ${report.cardsPartiallySupported.length}`);
  console.log(`CARDS WITH ZERO SUPPORTED EFFECTS ${report.cardsWithZeroSupportedEffects.length}`);
  console.log("\nBY FAMILY (unsupported)"); console.log(top(report.unsupportedByFamily, 20));
  console.log("\nBY EFFECT / ACTION (unsupported)"); console.log(top(report.unsupportedActions, 20));
  console.log("\nBY RESOLVER (unsupported)"); console.log(top(report.unsupportedResolvers, 20));
  console.log("\nBY TRIGGER"); console.log(top(report.triggerCounts, 20));
  console.log("\nBY TARGET"); console.log(top(report.targetCounts, 20));
  console.log("\nBY DURATION"); console.log(top(report.durationCounts, 20));
  console.log("\nBY CONDITION KIND (unsupported)"); console.log(top(report.unsupportedConditions, 30));
  console.log("\nTOP UNSUPPORTED BEHAVIOR GROUPS"); console.log(top(report.topUnsupportedGroups, 30));
  console.log("\nTOP BASELINE-CORE UNSUPPORTED GROUPS"); console.log(top(report.topUnsupportedGroupsByScope["baseline-core"], 30));
  console.log("\nMACHINE-READABLE: npm run engine:coverage -- --json");
}
