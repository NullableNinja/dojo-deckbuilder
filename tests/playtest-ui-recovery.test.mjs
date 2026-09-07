import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [source, entry, index, recovery, retiredHotfix, vfxRuntime, vfxStyles, ledger] = await Promise.all([
  readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../app/playtest-functional-recovery.css", import.meta.url), "utf8"),
  readFile(new URL("../public/playtest-critical-hotfix.css", import.meta.url), "utf8"),
  readFile(new URL("../src/playtest-vfx-runtime.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/playtest-vfx.css", import.meta.url), "utf8"),
  readFile(new URL("../docs/PLAYTEST-UI-RECOVERY.md", import.meta.url), "utf8"),
]);

test("functional recovery is the final bundled layout authority", () => {
  const overlayImport = entry.indexOf('import "../app/playtest-overlay-fix.css"');
  const recoveryImport = entry.indexOf('import "../app/playtest-functional-recovery.css"');
  assert.ok(overlayImport >= 0);
  assert.ok(recoveryImport > overlayImport);
  assert.doesNotMatch(index, /playtest-critical-hotfix\.css/);
  assert.doesNotMatch(retiredHotfix, /position\s*:\s*fixed/i);
});

test("ordinary gameplay panels participate in flow", () => {
  assert.match(recovery, /grid-row:\s*auto\s*!important/);
  assert.doesNotMatch(source, /function AcquisitionRail|className="market-rail-cards"/);
  assert.match(recovery, /\.hand-panel > header > \.playtest-action-dock[\s\S]*?position:\s*relative\s*!important/);
  assert.match(recovery, /> \.playtest-workspace--hand\s*\{[\s\S]*?position:\s*relative\s*!important/);
  assert.match(recovery, /> \.playtest-utility-dock\s*\{[\s\S]*?position:\s*relative\s*!important/);
  assert.match(source, /<header>[\s\S]*?\{phaseActionDock\}<\/header>/);
});

test("fighter and acquisition presentation is declarative React", () => {
  assert.doesNotMatch(entry, /MutationObserver|document\.createElement|comboBridgeActive/);
  assert.match(source, /className="fighter-combo-launch"/);
  assert.match(source, /function FeaturedComboPanel/);
  assert.match(source, /className="battle-hud-fighter battle-hud-fighter--player"/);
  assert.match(source, /className="battle-hud-fighter battle-hud-fighter--ai"/);
  assert.doesNotMatch(source, /data-flavor=\{fighter\.flavorText/);
  assert.match(recovery, /\.fighter-vitality,[\s\S]*?display:\s*none\s*!important/);
  assert.match(recovery, /\.fighter-xp-meter,[\s\S]*?grid-area:\s*xp\s*!important/);
  assert.match(source, /aria-current=\{ascendStepIndex/);
});

test("Scene identity and dialogs have explicit stable contracts", () => {
  assert.match(source, />Current Scene</);
  assert.match(source, /<i>SCENE RULE<\/i>/);
  assert.match(recovery, /--scene-accent/);
  assert.match(recovery, /\.ascend-desk-backdrop[\s\S]*?position:\s*fixed\s*!important/);
  assert.match(recovery, /\.ascend-desk-body[\s\S]*?overflow-x:\s*hidden\s*!important/);
});

test("VFX uses fixed named viewport lanes rather than scroll-relative rectangles", () => {
  assert.doesNotMatch(vfxRuntime, /getBoundingClientRect|anchoredPosition/);
  assert.match(vfxRuntime, /playtest-vfx-cue--\$\{side\}/);
  assert.match(vfxStyles, /\.playtest-vfx-cue--player/);
  assert.match(vfxStyles, /\.playtest-vfx-cue--ai/);
  assert.match(vfxStyles, /\.playtest-vfx-banner\s*\{[\s\S]*?position:\s*fixed/);
});

test("the recovery ledger contains exactly 50 implemented improvements", () => {
  const numberedItems = ledger.match(/^\d+\. /gm) ?? [];
  assert.equal(numberedItems.length, 50);
  assert.match(ledger, /^1\. /m);
  assert.match(ledger, /^50\. /m);
});
