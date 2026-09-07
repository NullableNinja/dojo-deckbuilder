import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Ascend teaches combined acquisition, Belt, then Hide", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /Acquire → Belt → Hide/);
  assert.match(source, /Market \+ Combo decisions/);
  assert.match(source, /function FeaturedComboPanel/);
  assert.match(source, /Continue to Belt Check/);
  assert.match(source, /Finish Ascend → Hide/);
  assert.match(source, /advanceAscendReview/);
  assert.doesNotMatch(source, /className="ascend-desk-tabs"/);
});

test("the persistent action dock cannot prematurely Hide during Ascend", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /Resume Ascend Review/);
  assert.doesNotMatch(source, /match\.phase === "player-ascend" && <button onClick=\{completeTurn\}>Hide/);
});

test("visual overhaul keeps every major Quick Duel surface represented", async () => {
  const [css, recovery, source] = await Promise.all([
    readFile(new URL("../app/playtest-production-mat.css", import.meta.url), "utf8"),
    readFile(new URL("../app/playtest-functional-recovery.css", import.meta.url), "utf8"),
    readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
  ]);
  for (const selector of [".battle-versus-hud", ".combat-stage-heading", ".living-fighter-card", ".combat-stage", ".hand-panel", ".ascend-guide", ".ascend-step-coach"]) {
    assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(source, /className="ascend-market-grid"/);
  assert.match(recovery, /\.ascend-market-grid/);
});
