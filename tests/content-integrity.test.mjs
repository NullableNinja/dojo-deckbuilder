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

test("the active rules and playtest have no Attack cap", async () => {
  const [rulesText, definitionText, playtest, engine, cli] = await Promise.all([
    readFile(new URL("../app/data/rules.json", import.meta.url), "utf8"),
    readFile(new URL("../app/data/game-definition.json", import.meta.url), "utf8"),
    readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
    readFile(new URL("../engine/core.mjs", import.meta.url), "utf8"),
    readFile(new URL("../engine/cli.mjs", import.meta.url), "utf8"),
  ]);
  const rules = JSON.parse(rulesText);
  const definition = JSON.parse(definitionText);
  assert.equal("normalAttackLimit" in definition.turn, false, "Game definition must not expose a hidden Attack cap");
  assert.equal(rules.glossary.some((entry) => entry.term === "Attack Limit" || entry.term === "Combo Extension"), false);
  assert.match(rulesText, /play any number of legal Attacks from your hand/i);
  assert.match(rulesText, /first Attack you play with Flow each turn resolves, draw one card/i);
  for (const source of [playtest, engine, cli]) {
    assert.doesNotMatch(source, /normalAttackLimit|attackLimit/, "Executable play surfaces must not retain the removed cap");
  }
  assert.match(playtest, /Flow draws 1 card/);
  assert.match(playtest, /function attackHasFlow/);
  assert.match(playtest, /practiceDefense/);
  const cardsText = await readFile(new URL("../app/data/cards.json", import.meta.url), "utf8");
  assert.doesNotMatch(cardsText, /"attackLimit"\s*:/, "Card metadata must not retain the removed Attack cap");
});

test("active rules and play surfaces use the persistent Market and full Quick Duel vitality", async () => {
  const [rules, definition, companion, playtest, engine, manifest] = await Promise.all([
    readFile(new URL("../app/data/rules.json", import.meta.url), "utf8"),
    readFile(new URL("../app/data/game-definition.json", import.meta.url), "utf8"),
    readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
    readFile(new URL("../engine/core.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/rules-manifest.json", import.meta.url), "utf8"),
  ]);
  for (const source of [rules, definition, companion, playtest, engine]) {
    assert.doesNotMatch(source, /Controlled Refill|controlledRefill/, "Controlled Refill must be completely removed from active surfaces");
  }
  assert.match(rules, /Unpurchased Market cards remain in the row between rounds/);
  assert.match(playtest, /marketPurchasedThisRound/);
  assert.match(playtest, /const choosePendingDiscard/);
  assert.match(playtest, /function applyBeltPromotion/);
  assert.match(playtest, /Bought \$\{card\.name\} for \$\{price\} Focus \(\$\{focusBefore\} → \$\{nextPlayer\.focus\}\)/);
  assert.equal(JSON.parse(definition).economy.market.refill, "top-card-after-purchase");
  assert.equal(JSON.parse(definition).progression.quickDuelUsesFullBeltRewards, true);
  assert.equal(JSON.parse(manifest).rulesRevision, "v2.3-r3");
});

test("deployment gates publication on the test suite", async () => {
  const workflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
  assert.match(workflow, /run: npm test/);
});

test("every Core Attack, Defense, Kata, Consumable, and Defense Equipment card has a matching website card file", async () => {
  const cards = JSON.parse(await readFile(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
  const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");
  const groups = [
    { prefix: "DDB-ATK-CORE-", folder: "attacks", count: 71 },
    { prefix: "DDB-DEF-CORE-", folder: "defenses", count: 50 },
    { prefix: "DDB-KAT-CORE-", folder: "katas", count: 62 },
    { prefix: "DDB-CON-CORE-", folder: "consumables", count: 62 },
    { prefix: "DDB-DEQ-CORE-", folder: "defense-equipment", count: 46 },
    { prefix: "DDB-GEA-CORE-", folder: "gear", count: 24 },
  ];

  for (const group of groups) {
    const completeCards = cards.filter((card) => card.catalogId.startsWith(group.prefix));
    const files = (await readdir(new URL(`../app/assets/cards/${group.folder}/`, import.meta.url))).filter((name) => name.endsWith(".webp"));
    const cardCatalogIds = files.map((name) => name.match(/^(ddb-(?:atk|def|kat|con|deq|gea)-core-\d{3})_/i)?.[1].toUpperCase()).sort();
    assert.equal(completeCards.length, group.count, `Unexpected ${group.folder} catalog count`);
    assert.equal(files.length, group.count, `Unexpected ${group.folder} card count`);
    assert.deepEqual(cardCatalogIds, completeCards.map((card) => card.catalogId).sort(), `Mismatched ${group.folder} catalog IDs`);
  }
  assert.match(source, /COMPLETE_CARD_URLS_BY_CATALOG_ID\[card\.catalogId\]/, "Complete card images must resolve by immutable catalog ID");
  assert.match(source, /Dojo_Deckbuilder_v2\.3_Defensive_Equipment_Editable_ORA\.zip/);
  assert.match(source, /Dojo_Deckbuilder_v2\.3_Consumable_Cards_Editable_ORA\.zip/);
  assert.match(source, /Dojo_Deckbuilder_v2\.3_Gear_Editable_ORA\.zip/);
});

test("editable card source pipeline emits GIMP-compatible OpenRaster deliverables", async () => {
  const source = await readFile(new URL("../scripts/build_editable_card_sources.py", import.meta.url), "utf8");
  assert.match(source, /image\/openraster/);
  assert.match(source, /Expected 46 Defense Equipment cards/);
  assert.match(source, /Expected 62 Consumable cards/);
  assert.match(source, /Defensive_Equipment_Editable_ORA\.zip/);
  assert.match(source, /Consumable_Cards_Editable_ORA\.zip/);
});

test("editable Gear source pipeline emits the complete GIMP-compatible deck", async () => {
  const source = await readFile(new URL("../scripts/build_editable_gear_sources.py", import.meta.url), "utf8");
  assert.match(source, /image\/openraster/);
  assert.match(source, /Expected 24 Gear cards/);
  assert.match(source, /Gear_Editable_ORA\.zip/);
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
  assert.match(companion, /Play Quick Duel/);
  assert.match(playtest, /import cardsJson from "\.\/data\/cards\.json"/);
  assert.match(playtest, /import\.meta\.glob<string>\("\.\/assets\/cards\/\{attacks,defenses,katas,consumables,defense-equipment,gear,characters\}/);
  assert.match(playtest, /COMPLETE_CARD_ART_BY_CATALOG_ID\[card\.catalogId\]/);
  assert.match(playtest, /gameDefinition\.starterDeck\.flatMap/);
  assert.match(playtest, /const marketPool = cards\.filter/);
  assert.match(playtest, /function openAiStrike/);
  assert.match(playtest, /defense-window/);
  assert.match(playtest, /Seven live records · full cards/);
  assert.equal(JSON.parse(cards).total, 597, "Playtest source must retain the current definitive Core catalog");
});

test("playtest behaves like a complete guided game surface", async () => {
  const playtest = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  for (const expected of [
    "DIFFICULTIES",
    "prepareAiTurn",
    "ddb-field-match",
    "ddb-field-settings",
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

test("public field test is one desktop-only Quick Duel teaser", async () => {
  const [companion, playtest, styles] = await Promise.all([
    readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(playtest, /Certified Quick Duel/);
  assert.match(playtest, /MobilePlaytestNotice/);
  assert.doesNotMatch(playtest, /<SimulationLab/);
  assert.doesNotMatch(playtest, /className="difficulty-grid"/);
  assert.match(companion, /MOBILE_MENU_ITEMS\.filter\(\(item\) => item\.id !== "playtest"\)/);
  assert.doesNotMatch(companion, />⚔<\/span>Play<\/button>/);
  assert.match(styles, /\.desktop-play-cta, \.route-playtest \{ display: none !important; \}/);
});

test("live mat thumbnails and impact equation cannot escape their records", async () => {
  const [playtest, styles] = await Promise.all([
    readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(playtest, /\{!math && <p>\{line\}<\/p>\}/);
  assert.match(styles, /\.mat-card-visual > \.native-card-art \{[^}]*height: 40px !important[^}]*contain: strict/);
  assert.match(styles, /\.playtest-shell--live \.impact-readout \{[^}]*overflow: visible/);
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
    "Combo Docket",
    "aiMarketScore",
    "aiAttackScore",
    "revealMarketCards",
    "refillPurchasedMarketSlot",
    "refreshMarketRow",
    "marketPurchasedThisRound",
    "choosePendingDiscard",
    "applyBeltPromotion",
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
  assert.match(playtest, /pin-until-match-ends|rulesVersion: activeRulesRevision/);
  assert.match(worker, /Math\.min\(1000/);
  assert.match(worker, /turn-snapshot/);
  assert.equal(JSON.parse(manifest).activeMatchPolicy, "pin-until-match-ends");
  assert.equal(JSON.parse(manifest).rulesRevision, "v2.3-r3");
  assert.match(styles, /playtest-shell--live/);
  assert.match(styles, /\.market-row \{[^}]*overflow-x: auto/);
  assert.match(playtest, /type DeskView = "market" \| "combo" \| "belt"/);
  assert.match(playtest, /className="ascend-desk-backdrop"/);
  assert.match(playtest, /className="ascend-guide"/);
  assert.match(playtest, /advanceAscendReview/);
  assert.match(playtest, /className="combat-desk-links"/);
  assert.doesNotMatch(playtest, /className="playtest-side-stack"/);
  assert.match(styles, /\.ascend-desk-backdrop \{[^}]*position: fixed/);
  assert.match(styles, /\.ascend-market-grid \{[^}]*repeat\(7, minmax\(118px, 1fr\)\)/);
  assert.match(styles, /:root\[data-theme="dark"\] \.ascend-desk \{/);
  assert.match(styles, /\.playtest-shell--live \.play-card-row \{[^}]*display: flex[^}]*overflow-x: auto/);
  assert.match(styles, /\.playtest-shell--live \.playtest-action-dock \{[^}]*position: static/);
  assert.match(styles, /\.fighter-stats \{[^}]*repeat\(6/);
});


test("Quick Duel polish keeps the HUD clear and the primary action surface singular", async () => {
  const [playtest, styles] = await Promise.all([
    readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8"),
  ]);
  assert.match(playtest, /className="playtest-utility-dock"/);
  assert.match(playtest, /className="coach-dialog paper-stack"/);
  assert.match(playtest, /victory-certificate/);
  assert.match(playtest, /className="hand-context-strip"/);
  assert.doesNotMatch(playtest, /className="combat-utility-panel paper-stack"/);
  assert.doesNotMatch(playtest, /className="playtest-yell-actions"/);
  assert.match(styles, /Stable hand geometry/);
  assert.match(styles, /fighter-combo-rack \.active-combo-grid \{[\s\S]*overflow-y: auto/);
  assert.match(styles, /playtest-inspector \.inspector-card-visual > \.native-card-art \{[\s\S]*position: relative !important/);
  assert.match(styles, /victory-confetti/);
});
