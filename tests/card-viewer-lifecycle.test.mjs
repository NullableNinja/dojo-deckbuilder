import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const lifecycle = await readFile(new URL("../app/card-viewer-lifecycle.tsx", import.meta.url), "utf8");
const companion = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");
const playtest = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
const inspector = await readFile(new URL("../app/card-inspector.tsx", import.meta.url), "utf8");

test("experimental global Dojo Dossier lifecycle stays isolated from the application root", () => {
  assert.doesNotMatch(main, /import CardViewerLifecycle from "\.\.\/app\/card-viewer-lifecycle";/);
  assert.doesNotMatch(main, /<CardViewerLifecycle \/>/);
  assert.match(lifecycle, /export default function CardViewerLifecycle\(\)/);
});

test("shared CardInspector is eager in the application graph so inspect cannot depend on a late chunk", () => {
  assert.match(main, /import \{ CardInspector \} from "\.\.\/app\/card-inspector";/);
  assert.match(main, /rootElement\.dataset\.cardInspectorModule = CardInspector\.name \|\| "ready";/);
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

test("Quick Duel still mounts the shared CardInspector without a global DOM observer", () => {
  assert.match(playtest, /\{inspected && !inspectedBoard && <Suspense fallback=\{null\}><CardInspector/);
  assert.doesNotMatch(main, /MutationObserver/);
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
