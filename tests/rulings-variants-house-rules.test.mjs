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
  assert.doesNotMatch(source, /playtest-house-rules/);
});

test("canonical rules own Quick Duel house-rule support metadata", async () => {
  const canonical = JSON.parse(await read("../content/rules.json"));
  const rules = canonical.houseRules;
  assert.equal(rules.length, 9);
  assert.equal(new Set(rules.map((rule) => rule.id)).size, rules.length);
  for (const rule of rules) {
    assert.equal(typeof rule.id, "string");
    assert.ok(["supported", "planned", "not-applicable"].includes(rule.quickDuel?.status));
    assert.equal(typeof rule.quickDuel?.reason, "string");
    assert.ok(rule.quickDuel.reason.length > 0);
  }
  const supported = rules.filter((rule) => rule.quickDuel.status === "supported").map((rule) => rule.id).sort();
  assert.deepEqual(supported, ["fast-belts", "market-scramble"]);
});

test("Quick Duel exposes only canonically certified house-rule toggles", async () => {
  const [source, registry] = await Promise.all([
    read("../app/playtest.tsx"),
    read("../app/playtest-house-rules.ts"),
  ]);
  assert.match(source, /QUICK_DUEL_HOUSE_RULES/);
  assert.match(source, /houseRuleIds: string\[\]/);
  assert.match(source, /Quick Duel variants/);
  assert.match(source, /effectiveBeltThresholds/);
  assert.match(source, /shouldRefreshMarketAtRoundEnd/);
  assert.match(registry, /canonicalHouseRules/);
  assert.doesNotMatch(registry, /CAPABILITIES/);
});

test("Reference Desk implementation is removed from the application", async () => {
  const main = await read("../src/main.tsx");
  assert.doesNotMatch(main, /reference-desk\.css/);
  await assert.rejects(read("../app/reference-desk.tsx"));
  await assert.rejects(read("../app/reference-desk.css"));
});
