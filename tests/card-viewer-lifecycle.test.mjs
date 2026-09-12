import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const lifecycle = await readFile(new URL("../app/card-viewer-lifecycle.tsx", import.meta.url), "utf8");
const companion = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");
const playtest = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
const inspector = await readFile(new URL("../app/card-inspector.tsx", import.meta.url), "utf8");

test("global Dojo Dossier lifecycle is mounted without eagerly importing CardInspector", () => {
  assert.match(main, /import CardViewerLifecycle, \{ prepareCardRouteAlias \} from "\.\.\/app\/card-viewer-lifecycle";/);
  assert.match(main, /prepareCardRouteAlias\(\);/);
  assert.match(main, /<CardViewerLifecycle \/>/);
  assert.match(lifecycle, /export default function CardViewerLifecycle\(\)/);
  assert.doesNotMatch(lifecycle, /import \{ CardInspector \}/);
});

test("Dojo Dossier uses singular canonical #card routes and preserves direct deep links", () => {
  assert.match(lifecycle, /const CANONICAL_CARD_PREFIX = "#card\/";/);
  assert.match(lifecycle, /const canonicalCardHash = \(catalogId: string\) => `\$\{CANONICAL_CARD_PREFIX\}\$\{encodeURIComponent\(catalogId\)\}`;/);
  assert.match(lifecycle, /window\.location\.hash\.match\(\/\^#card\\\/\(\[\^\/\]\+\)\$\/i\)/);
  assert.match(lifecycle, /window\.history\.replaceState\(window\.history\.state, "", libraryCardHash\(match\[1\]\)\);/);
});

test("Quick Duel gives the Dossier a card history entry and closing restores #playtest", () => {
  assert.match(lifecycle, /origin = document\.querySelector\("\.playtest-shell"\) \? "playtest" : "cards";/);
  assert.match(lifecycle, /origin === "playtest" && firstOpen && window\.location\.hash === "#playtest"/);
  assert.match(lifecycle, /window\.history\.pushState\(null, "", shareHash\);/);
  assert.match(lifecycle, /const originHash = \(origin: ViewerOrigin\) => origin === "playtest" \? "#playtest" : "#cards";/);
  assert.match(lifecycle, /window\.addEventListener\("popstate", handlePopState\);/);
});

test("shared CardInspector stays out of the application entry and is loaded through its dedicated lazy module", () => {
  assert.doesNotMatch(main, /import \{ CardInspector \} from "\.\.\/app\/card-inspector";/);
  assert.doesNotMatch(main, /rootElement\.dataset\.cardInspectorModule/);
  assert.match(playtest, /lazy\(\(\) => import\("\.\/card-inspector"\)\.then\(\(module\) => \(\{ default: module\.CardInspector \}\)\)\)/);
  assert.match(companion, /lazy\(\(\) => import\("\.\/card-inspector"\)\.then\(\(module\) => \(\{ default: module\.CardInspector \}\)\)\)/);
});

test("Dojo Dossier contains card render failures instead of unmounting the Playtest", () => {
  assert.match(inspector, /class CardInspectorErrorBoundary extends Component/);
  assert.match(inspector, /static getDerivedStateFromError/);
  assert.match(inspector, /Dojo Dossier failed to render/);
  assert.match(inspector, /The filing cabinet jammed\./);
  assert.match(inspector, /<CardInspectorErrorBoundary onClose=\{props\.onClose\}>/);
});

test("Dojo Dossier tolerates missing taxonomy arrays from runtime card data", () => {
  assert.match(inspector, /const tags = Array\.isArray\(card\.tags\) \? card\.tags : \[\];/);
  assert.match(inspector, /const buildPaths = Array\.isArray\(card\.buildPaths\) \? card\.buildPaths : \[\];/);
  assert.doesNotMatch(inspector, /card\.tags\.length/);
  assert.doesNotMatch(inspector, /card\.buildPaths\.length/);
});

test("Card Library still mounts exactly one shared CardInspector surface", () => {
  assert.match(companion, /\{activeCard && <Suspense fallback=\{null\}><CardInspector/);
  assert.doesNotMatch(companion, /<CardModal\b/);
});

test("Quick Duel still mounts the shared CardInspector and routing stays outside the game engine", () => {
  assert.match(playtest, /\{inspected && !inspectedBoard && <Suspense fallback=\{null\}><CardInspector/);
  assert.doesNotMatch(playtest, /MutationObserver/);
  assert.match(lifecycle, /new MutationObserver\(syncRouteFromViewer\)/);
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
