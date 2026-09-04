import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Ascend teaches Market then Combo then Belt before Hide", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /Shop → Combo → Belt → Hide/);
  assert.match(source, /Continue to Combo Docket/);
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
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  for (const selector of [".battle-versus-hud", ".playtest-location", ".fighter-dossier", ".playtest-combat-desk", ".hand-panel", ".ascend-guide", ".ascend-step-coach"]) {
    assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});
