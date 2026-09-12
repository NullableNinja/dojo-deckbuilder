import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [source, entry, index, layout, retiredHotfix, vfxRuntime, vfxStyles, ledger] = await Promise.all([
  readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../app/playtest-layout.css", import.meta.url), "utf8"),
  readFile(new URL("../public/playtest-critical-hotfix.css", import.meta.url), "utf8"),
  readFile(new URL("../src/playtest-vfx-runtime.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/playtest-vfx.css", import.meta.url), "utf8"),
  readFile(new URL("../docs/PLAYTEST-UI-RECOVERY.md", import.meta.url), "utf8"),
]);

test("consolidated layout is the final bundled Quick Duel geometry authority", () => {
  const cardSurfaceImport = entry.indexOf('import "../app/playtest-card-surface.css"');
  const marketSurfaceImport = entry.indexOf('import "../app/playtest-market-card-polish.css"');
  const layoutImport = entry.indexOf('import "../app/playtest-layout.css"');
  assert.ok(cardSurfaceImport >= 0);
  assert.ok(marketSurfaceImport >= 0);
  assert.ok(layoutImport > cardSurfaceImport);
  assert.ok(layoutImport > marketSurfaceImport);
  assert.doesNotMatch(index, /playtest-critical-hotfix\.css/);
  assert.doesNotMatch(retiredHotfix, /position\s*:\s*fixed/i);
});

test("ordinary gameplay panels have explicit non-overlapping ownership", () => {
  assert.doesNotMatch(source, /function AcquisitionRail|className="market-rail-cards"/);
  assert.match(layout, /grid-template-areas:\s*"status"\s*"arena"\s*"hand"\s*"utility"/);
  assert.match(layout, /\.hand-panel > header > \.playtest-action-dock[\s\S]*?position:\s*relative/);
  assert.match(layout, /> \.playtest-workspace--hand\s*\{[\s\S]*?grid-area:\s*hand/);
  assert.match(layout, /> \.playtest-utility-dock\s*\{[\s\S]*?grid-area:\s*utility/);
  assert.match(source, /<header>[\s\S]*?\{phaseActionDock\}<\/header>/);
});

test("fighter and acquisition presentation remains declarative React", () => {
  assert.doesNotMatch(entry, /MutationObserver|document\.createElement|comboBridgeActive/);
  assert.match(source, /className="fighter-combo-launch"/);
  assert.match(source, /function FeaturedComboPanel/);
  assert.match(source, /className="battle-hud-fighter battle-hud-fighter--player"/);
  assert.match(source, /className="battle-hud-fighter battle-hud-fighter--ai"/);
  assert.match(layout, /\.fighter-resource-strip\s*\{[^}]*display:\s*contents/s);
  assert.match(layout, /\.fighter-xp-meter,[\s\S]*?grid-area:\s*xp/s);
  assert.match(source, /aria-current=\{ascendStepIndex/);
});

test("Scene identity and dialogs have explicit stable contracts", () => {
  assert.match(source, />Current Scene</);
  assert.match(source, /<i>SCENE RULE<\/i>/);
  assert.match(layout, /\.ascend-desk-backdrop[\s\S]*?position:\s*fixed/);
  assert.match(layout, /\.ascend-desk-body\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto/s);
});

test("VFX uses fixed named viewport lanes rather than scroll-relative rectangles", () => {
  assert.doesNotMatch(vfxRuntime, /getBoundingClientRect|anchoredPosition/);
  assert.match(vfxRuntime, /playtest-vfx-cue--\$\{side\}/);
  assert.match(vfxStyles, /\.playtest-vfx-cue--player/);
  assert.match(vfxStyles, /\.playtest-vfx-cue--ai/);
  assert.match(vfxStyles, /\.playtest-vfx-banner\s*\{[\s\S]*?position:\s*fixed/);
});

test("the recovery ledger preserves its 50 historical improvements", () => {
  const numberedItems = ledger.match(/^\d+\. /gm) ?? [];
  assert.equal(numberedItems.length, 50);
  assert.match(ledger, /^1\. /m);
  assert.match(ledger, /^50\. /m);
});
