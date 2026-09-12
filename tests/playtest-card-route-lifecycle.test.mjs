import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRoute, serializeRoute } from "../app/routing.ts";

const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const lifecycle = readFileSync(new URL("../app/playtest-card-route-lifecycle.tsx", import.meta.url), "utf8");
const routing = readFileSync(new URL("../app/routing.ts", import.meta.url), "utf8");

test("Quick Duel mounts a dedicated Dossier URL coordinator", () => {
  assert.match(main, /import PlaytestCardRouteLifecycle from "\.\.\/app\/playtest-card-route-lifecycle";/);
  assert.match(main, /<PlaytestCardRouteLifecycle \/>/);
  assert.match(lifecycle, /document\.querySelector\("\.playtest-shell"\)/);
  assert.match(lifecycle, /\.universal-card-inspector/);
});

test("Quick Duel inspector exposes the same #cards deep link as the unified router", () => {
  const route = { page: "cards", cardId: "DDB-ATK-CORE-001" };
  assert.equal(serializeRoute(route), "#cards/DDB-ATK-CORE-001");
  assert.deepEqual(parseRoute(serializeRoute(route)), route);
  assert.match(lifecycle, /serializeRoute\(\{ page: "cards", cardId: catalogId \}\)/);
  assert.match(lifecycle, /pushTransientRoute\(\{ page: "cards", cardId: catalogId \}\)/);
  assert.match(lifecycle, /replaceTransientRoute\(\{ page: "cards", cardId: catalogId \}\)/);
});

test("transient Dossier URLs do not notify the app shell and unmount Quick Duel", () => {
  assert.match(routing, /export function pushTransientRoute/);
  assert.match(routing, /export function replaceTransientRoute/);
  const transientBlock = routing.slice(routing.indexOf("export function pushTransientRoute"), routing.indexOf("const writeRoute"));
  assert.doesNotMatch(transientBlock, /notify\(\)/);
  assert.match(lifecycle, /replaceTransientRoute\(\{ page: "playtest" \}\)/);
});

test("closing or navigating back cannot leave the Dossier URL and overlay out of sync", () => {
  assert.match(lifecycle, /handleCloseCapture/);
  assert.match(lifecycle, /event\.key !== "Escape"/);
  assert.match(lifecycle, /window\.addEventListener\("popstate", handlePopState\)/);
  assert.match(lifecycle, /document\.querySelector<HTMLButtonElement>\(`\$\{VIEWER_SELECTOR\} \$\{VIEWER_CLOSE_SELECTOR\}`\)\?\.click\(\)/);
});
