import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const lifecycle = await readFile(new URL("../app/card-viewer-lifecycle.tsx", import.meta.url), "utf8");
const companion = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");
const playtest = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");

test("Dojo Dossier lifecycle coordinator is mounted and eagerly includes CardInspector", () => {
  assert.match(main, /import CardViewerLifecycle from "\.\.\/app\/card-viewer-lifecycle";/);
  assert.match(main, /<CardViewerLifecycle \/>/);
  assert.match(lifecycle, /import \{ CardInspector \} from "\.\/card-inspector";/);
  assert.match(lifecycle, /if \(!CardInspector\.name\) return;/);
});

test("viewer exposes canonical share URLs without changing the visible Quick Duel host", () => {
  assert.match(lifecycle, /canonicalCardHash = \(catalogId: string\) => `#cards\/\$\{encodeURIComponent\(catalogId\)\}`/);
  assert.match(lifecycle, /document\.querySelector\("\.playtest-shell"\) \? "playtest" : "cards"/);
  assert.match(lifecycle, /window\.history\.replaceState\(null, "", shareHash\)/);
  assert.match(lifecycle, /Do not emit popstate here/);
});

test("viewer close clears routed card state before React can reveal an older card underneath", () => {
  assert.match(lifecycle, /clearRoutedViewerState/);
  assert.match(lifecycle, /window\.dispatchEvent\(new PopStateEvent\("popstate"\)\)/);
  assert.match(lifecycle, /VIEWER_CLOSE_SELECTOR/);
  assert.match(lifecycle, /VIEWER_BACKDROP_SELECTOR/);
  assert.match(lifecycle, /event\.key !== "Escape"/);
});

test("obsolete CardModal is definition-only and no longer mounted by the Card Library", () => {
  assert.match(companion, /function CardModal\(/);
  assert.doesNotMatch(companion, /<CardModal\b/);
});

test("Quick Duel Dojo Binder state uses the same persisted storage key as the Library", () => {
  assert.match(playtest, /const BINDER_STORAGE_KEY = "dojo-binder-v1";/);
  assert.match(playtest, /window\.localStorage\.setItem\(BINDER_STORAGE_KEY, JSON\.stringify\(\[\.\.\.savedCardIds\]\)\)/);
  assert.match(playtest, /saved=\{savedCardIds\.has\(inspected\.catalogId\)\}/);
});
