import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");

test("player Block discard effects pause for an explicit choice without suppressing other Block effects", () => {
  assert.match(source, /effect.kind === "draw"/);
  assert.match(source, /effect.kind === "discard"[\s\S]{0,260}timing === "onPlay" \|\| timing === "onBlock"/);
  assert.match(source, /blockDiscardChoice = playerDiscardChoiceCount\(defenseCard, "onBlock"\)/);
  assert.match(source, /afterChoice: "resume-defense", sourceFollowup: false/);
});

test("AI target discard removes selected copies one at a time", () => {
  assert.match(source, /let aiHand = nextAi\.hand/);
  assert.match(source, /for \(const id of discarded\) aiHand = removeOne\(aiHand, id\)/);
});
