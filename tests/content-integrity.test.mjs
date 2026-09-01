import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("glossary terms are unique", async () => {
  const rules = JSON.parse(await readFile(new URL("../app/data/rules.json", import.meta.url), "utf8"));
  const normalized = rules.glossary.map((entry) => entry.term.trim().toLocaleLowerCase());
  assert.equal(new Set(normalized).size, normalized.length, "Glossary contains duplicate terms");
  for (const term of ["Belt Exam", "Boss Profile", "Ready", "Reversal"]) {
    assert.equal(rules.glossary.filter((entry) => entry.term === term).length, 1, `Expected one glossary entry for ${term}`);
  }
});

test("deployment gates publication on the test suite", async () => {
  const workflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
  assert.match(workflow, /run: npm test/);
});

test("every Core Attack, Defense, Kata, and Consumable has a matching website card file", async () => {
  const cards = JSON.parse(await readFile(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
  const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");
  const groups = [
    { prefix: "DDB-ATK-CORE-", folder: "attacks", count: 71 },
    { prefix: "DDB-DEF-CORE-", folder: "defenses", count: 50 },
    { prefix: "DDB-KAT-CORE-", folder: "katas", count: 62 },
    { prefix: "DDB-CON-CORE-", folder: "consumables", count: 62 },
  ];

  for (const group of groups) {
    const completeCards = cards.filter((card) => card.catalogId.startsWith(group.prefix));
    const files = (await readdir(new URL(`../app/assets/cards/${group.folder}/`, import.meta.url))).filter((name) => name.endsWith(".webp"));
    const cardCatalogIds = files.map((name) => name.match(/^(ddb-(?:atk|def|kat|con)-core-\d{3})_/i)?.[1].toUpperCase()).sort();
    assert.equal(completeCards.length, group.count, `Unexpected ${group.folder} catalog count`);
    assert.equal(files.length, group.count, `Unexpected ${group.folder} card count`);
    assert.deepEqual(cardCatalogIds, completeCards.map((card) => card.catalogId).sort(), `Mismatched ${group.folder} catalog IDs`);
  }
  assert.match(source, /COMPLETE_CARD_URLS_BY_CATALOG_ID\[card\.catalogId\]/, "Complete card images must resolve by immutable catalog ID");
});

test("deployment stamps a build fingerprint and cache-busts the app shell", async () => {
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const entry = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
  const workflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
  assert.match(index, /name="ddb-build" content="__DDB_BUILD__"/);
  assert.match(index, /Cache-Control/);
  assert.match(entry, /build\.json\?ts=/);
  assert.match(entry, /cache: "no-store"/);
  assert.match(entry, /_ddb_build/);
  assert.match(workflow, /Stamp deployment and bust stale app-shell caches/);
  assert.match(workflow, /build\.json/);
});

test("rulings have stable IDs and filing dates", async () => {
  const rules = JSON.parse(await readFile(new URL("../app/data/rules.json", import.meta.url), "utf8"));
  assert.equal(rules.officialRulings.length, 8);
  for (let number = 1; number <= 8; number += 1) {
    assert.ok(rules.officialRulings.some((ruling) => ruling.id === `DDB-RUL-${String(number).padStart(3, "0")}`));
  }
  assert.ok(rules.officialRulings.every((ruling) => /^Filed [A-Z][a-z]{2} \d{1,2}, 20\d{2}$/.test(ruling.filed)));
});

test("rendered glossary deduplicates terms at the UI boundary", async () => {
  const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");
  assert.match(source, /const GLOSSARY_ENTRIES = Array\.from\(new Map/);
  assert.match(source, /const glossaryKey =/);
  assert.ok(!source.includes("rulesData.glossary.filter("), "Glossary rendering/search must use the deduplicated collection");
  assert.ok(source.includes("{GLOSSARY_ENTRIES.length} terms"), "Glossary count must reflect the deduplicated collection");
});

test("playtest uses the live Core catalog and actual uploaded card art", async () => {
  const [companion, playtest, cards] = await Promise.all([
    readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/cards.json", import.meta.url), "utf8"),
  ]);
  assert.match(companion, /PlaytestView/);
  assert.match(companion, /Play the Game/);
  assert.match(playtest, /import cardsJson from "\.\/data\/cards\.json"/);
  assert.match(playtest, /import\.meta\.glob<string>\("\.\/assets\/cards\/\{attacks,defenses,katas,consumables,characters\}/);
  assert.match(playtest, /COMPLETE_CARD_ART_BY_CATALOG_ID\[card\.catalogId\]/);
  assert.match(playtest, /gameDefinition\.starterDeck\.flatMap/);
  assert.match(playtest, /const marketPool = cards\.filter/);
  assert.match(playtest, /function openAiStrike/);
  assert.match(playtest, /defense-window/);
  assert.match(playtest, /Shared Market · \{gameDefinition\.economy\.market\.rowSize\} live records/);
  assert.equal(JSON.parse(cards).total, 597, "Playtest source must retain the current definitive Core catalog");
});

test("playtest behaves like a complete guided game surface", async () => {
  const playtest = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  for (const expected of [
    "DIFFICULTIES",
    "prepareAiTurn",
    "ddb-field-match",
    "ddb-field-settings",
    "game-phase-rail",
    "turn-coach",
    "Instant rematch",
    "player-initiate",
    "turnOrder",
    "advanceRound",
  ]) assert.ok(playtest.includes(expected), `Missing field-test enhancement: ${expected}`);
  assert.ok(!playtest.includes("v2.2.2 catalog"), "Public field-test copy must remain version-free");
  assert.match(playtest, /onClick=\{\(\) => begin\(\)\}/, "The launch control must not pass React's click event as a fighter ID");
  assert.match(playtest, /QUICK_DUEL_LOCATION_NAMES/, "Quick Duel must use locations whose rules are automated by the engine");
  assert.match(playtest, /function ImpactReadout/, "Combat math must be visible on the live mat");
});

test("field test three adds real digital-game decisions without replacing the Core rules", async () => {
  const [playtest, styles] = await Promise.all([
    readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  for (const feature of [
    "curateOpeningMarket",
    "comboAttackModifier",
    "reversal-window",
    "resolveReversal",
    "Separate Combo docket",
    "Guarantee a playable opening Market",
    "aiMarketScore",
    "aiAttackScore",
    "playtest-action-dock",
    "NativeCardArt",
  ]) assert.ok(playtest.includes(feature), `Missing upgraded field-test feature: ${feature}`);
  assert.match(playtest, /nextPlayer\.focus = Math\.max\(0, nextPlayer\.focus - cardFocus\(card\)\)/, "Reversals must not generate their printed Focus");
  assert.match(playtest, /learnedCombos\.length >= 2/, "The two learned-Combo limit must remain enforced");
  assert.match(styles, /Field Test 3 — tactical desk/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("v2 engine upgrade keeps rules, play, and simulation on one versioned contract", async () => {
  const [playtest, worker, manifest, styles] = await Promise.all([
    readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/simulation-worker.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/rules-manifest.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(playtest, /import gameDefinitionJson from "\.\/data\/game-definition\.json"/);
  assert.match(playtest, /fetchRulesManifest/);
  assert.match(playtest, /pin-until-match-ends|rulesVersion: catalogRulesVersion/);
  assert.match(worker, /Math\.min\(1000/);
  assert.match(worker, /turn-snapshot/);
  assert.equal(JSON.parse(manifest).activeMatchPolicy, "pin-until-match-ends");
  assert.match(styles, /playtest-shell--live/);
  assert.match(styles, /\.market-row \{[^}]*overflow-x: auto/);
  assert.match(styles, /\.fighter-stats \{[^}]*repeat\(6/);
});
