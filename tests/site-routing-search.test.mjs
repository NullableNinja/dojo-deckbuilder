import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRoute, serializeRoute } from "../app/routing.ts";

const readText = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("route parser and serializer cover every user-facing deep-link family", () => {
  const cases = [
    ["#home", { page: "home" }],
    ["#playtest", { page: "playtest" }],
    ["#quickstart", { page: "quickstart" }],
    ["#story", { page: "story" }],
    ["#rules", { page: "rules" }],
    ["#rules/08-combat", { page: "rules", chapterId: "08-combat" }],
    ["#rules/08-combat/defense-limits", { page: "rules", chapterId: "08-combat", sectionId: "defense-limits" }],
    ["#cards", { page: "cards" }],
    ["#cards/DDB-ATK-CORE-001", { page: "cards", cardId: "DDB-ATK-CORE-001" }],
    ["#rulings/official/DDB-RUL-014", { page: "rulings", tab: "official", query: "DDB-RUL-014" }],
    ["#rulings/house/Controlled%20Refill", { page: "rulings", tab: "house", query: "Controlled Refill" }],
    ["#glossary/Focus", { page: "glossary", term: "Focus" }],
    ["#search/attack", { page: "search", query: "attack" }],
  ];

  for (const [hash, route] of cases) {
    assert.deepEqual(parseRoute(hash), route, `parse ${hash}`);
    assert.deepEqual(parseRoute(serializeRoute(route)), route, `round-trip ${hash}`);
  }
});

test("route parser safely handles empty, malformed, unknown, and legacy locations", () => {
  assert.deepEqual(parseRoute(""), { page: "home" });
  assert.deepEqual(parseRoute("#definitely-not-a-page/foo"), { page: "home" });
  assert.deepEqual(parseRoute("#glossary/%E0%A4%A"), { page: "glossary", term: "%E0%A4%A" });
  assert.deepEqual(parseRoute("#card/DDB-DEF-CORE-002"), { page: "cards", cardId: "DDB-DEF-CORE-002" });
  assert.deepEqual(parseRoute("#house-rules/Training%20Montage"), { page: "rulings", tab: "house", query: "Training Montage" });
  assert.deepEqual(parseRoute("#rulings/DDB-RUL-002"), { page: "rulings", tab: "official", query: "DDB-RUL-002" });
});

test("Search Page is a normal routed view powered by the shared engine", async () => {
  const [page, search, css, companion, main] = await Promise.all([
    readText("app/search-page.tsx"),
    readText("app/search.ts"),
    readText("app/search-page.css"),
    readText("app/companion-app.tsx"),
    readText("src/main.tsx"),
  ]);

  assert.match(page, /from "\.\/search"/);
  assert.match(page, /replaceRoute\(trimmed \? \{ page: "search", query: trimmed \}/);
  assert.doesNotMatch(page, /\.\/data\/rules\.json/);
  assert.doesNotMatch(page, /window\.history\.(?:pushState|replaceState)/);
  assert.doesNotMatch(page, /ddb-locationchange/);
  assert.doesNotMatch(page, /document\.body\.classList/);
  assert.doesNotMatch(page, /addEventListener\("keydown"[^\n]*true/);
  assert.doesNotMatch(css, /body\.ddb-search-page/);

  assert.match(search, /CANONICAL_RULES/);
  assert.match(search, /normalizeSearchQuery/);
  assert.match(search, /route: \{ page: "cards", cardId: card\.catalogId \}/);
  assert.match(search, /route: \{ page: "rules", chapterId: chapter\.id, sectionId: section\.id \}/);
  assert.match(search, /route: \{ page: "rulings", tab: "official", query: entry\.id \}/);
  assert.match(search, /route: \{ page: "rulings", tab: "house", query: entry\.name \}/);

  assert.match(companion, /route\.page === "search" && <SearchPage query=\{route\.query \?\? ""\} \/>/);
  assert.doesNotMatch(main, /<SearchPage \/>/);
});

test("Companion App uses one routing API instead of scattered browser-history calls", async () => {
  const [companion, routing] = await Promise.all([
    readText("app/companion-app.tsx"),
    readText("app/routing.ts"),
  ]);

  assert.match(companion, /readRoute/);
  assert.match(companion, /subscribeToRoute/);
  assert.match(companion, /navigate\(\{ page: "cards", cardId: card\.catalogId \}\)/);
  assert.match(companion, /replaceRoute\(\{ page: "cards", cardId: card\.catalogId \}\)/);
  assert.match(companion, /replaceRoute\(\{ page: "cards" \}\)/);
  assert.match(companion, /navigate\(\{ page: "rules", chapterId: id \}\)/);
  assert.match(companion, /navigate\(\{ page: "glossary", term: entry\.term \}\)/);
  assert.match(companion, /navigate\(\{ page: "rulings", tab: "house", query: entry\.name \}\)/);
  assert.doesNotMatch(companion, /dojoHash/);
  assert.doesNotMatch(companion, /parseDojoHash/);
  assert.doesNotMatch(companion, /window\.history\.(?:pushState|replaceState)/);

  assert.match(routing, /window\.history\.replaceState/);
  assert.match(routing, /window\.history\.pushState/);
  assert.doesNotMatch(routing, /window\.history\.pushState\s*=/);
  assert.doesNotMatch(routing, /window\.history\.replaceState\s*=/);
  assert.doesNotMatch(routing, /ddb-locationchange/);
});

test("Card Dossier selection is reconstructed directly from the cards route", async () => {
  const [companion, main] = await Promise.all([
    readText("app/companion-app.tsx"),
    readText("src/main.tsx"),
  ]);

  assert.match(companion, /function CardsView\(\{ cardId = "" \}: \{ cardId\?: string \}\)/);
  assert.match(companion, /const activeCard = cardId \? cardData\.cards\.find/);
  assert.match(companion, /route\.page === "cards" && <CardsView cardId=\{route\.cardId\} \/>/);
  assert.match(companion, /onPrevious=\{\(\) => stepCard\(previousCard\)\}/);
  assert.match(companion, /onNext=\{\(\) => stepCard\(nextCard\)\}/);
  assert.match(companion, /onClose=\{closeCard\}/);
  assert.doesNotMatch(companion, /MutationObserver/);
  assert.doesNotMatch(main, /CardViewerLifecycle/);
  assert.doesNotMatch(main, /prepareCardRouteAlias/);
});

test("global Search Enter opens the Search route unless keyboard selection is intentional", async () => {
  const companion = await readText("app/companion-app.tsx");
  assert.match(companion, /const \[selectionIntent, setSelectionIntent\] = useState\(false\)/);
  assert.match(companion, /event\.key === "ArrowDown" \|\| event\.key === "ArrowUp"/);
  assert.match(companion, /setSelectionIntent\(true\)/);
  assert.match(companion, /if \(selectionIntent && orderedGlobalResults\.length\)/);
  assert.match(companion, /openFullSearch\(\)/);
  assert.match(companion, /navigate\(\{ page: "search", query \}\)/);
});

test("desktop, mobile menu, and mobile bottom navigation derive from shared metadata", async () => {
  const [companion, navigation] = await Promise.all([
    readText("app/companion-app.tsx"),
    readText("app/site-navigation.ts"),
  ]);

  assert.match(companion, /DESKTOP_NAVIGATION\.map/);
  assert.match(companion, /MOBILE_MENU_NAVIGATION\.map/);
  assert.match(companion, /MOBILE_BOTTOM_NAVIGATION\.map/);
  assert.match(companion, /navigationItemIsActive\(item, route\)/);
  assert.match(companion, /aria-current=\{navigationItemIsActive\(item, route\) \? "page" : undefined\}/);
  assert.match(navigation, /page: "playtest"[\s\S]*mobileMenu: false[\s\S]*mobileBottom: false/);
});
