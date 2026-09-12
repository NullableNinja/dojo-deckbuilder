import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Rulings & Variants keeps official and optional guidance on one route", async () => {
  const source = await read("../app/companion-app.tsx");
  assert.match(source, /Rulings & Variants/);
  assert.match(source, /OFFICIAL · APPLIES TO ALL GAMES/);
  assert.match(source, /OPTIONAL · AGREE BEFORE PLAY/);
  assert.match(source, /type RulingsTab = "official" \| "house"/);
  assert.match(source, /rawView === "house-rules"/);
  assert.doesNotMatch(source, /import \{ ReferenceDesk \}/);
  assert.doesNotMatch(source, /view === "reference"/);
  assert.doesNotMatch(source, /view === "house-rules"/);
});

test("Quick Duel exposes only certified house-rule toggles", async () => {
  const [source, registry] = await Promise.all([
    read("../app/playtest.tsx"),
    read("../app/playtest-house-rules.ts"),
  ]);
  assert.match(source, /QUICK_DUEL_HOUSE_RULES/);
  assert.match(source, /houseRuleIds: string\[\]/);
  assert.match(source, /Optional house rules/);
  assert.match(source, /effectiveBeltThresholds/);
  assert.match(source, /shouldRefreshMarketAtRoundEnd/);
  assert.match(registry, /"Market Scramble"[\s\S]*status: "supported"/);
  assert.match(registry, /"Fast Belts"[\s\S]*status: "supported"/);
  assert.match(registry, /"Friendly Fire"[\s\S]*status: "not-applicable"/);
});

test("Reference Desk code and stylesheet are removed from the application entrypoint", async () => {
  const main = await read("../src/main.tsx");
  assert.doesNotMatch(main, /reference-desk\.css/);
});
