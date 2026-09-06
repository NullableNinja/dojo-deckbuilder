import test from "node:test";
import assert from "node:assert/strict";
import { buildVfxPresentationCues } from "../src/playtest-vfx-presentation.ts";

test("combat resolves before one condensed secondary summary", () => {
  const cues = buildVfxPresentationCues([
    { type: "combat.attack", actor: "player", target: "ai", zone: "Mid" },
    { type: "resource.xpGain", fighter: "player", amount: 1 },
    { type: "card.draw", fighter: "player", amount: 1 },
    { type: "combat.block", actor: "ai", target: "player" },
  ]);

  assert.deepEqual(cues.map((cue) => cue.kind), ["event", "event", "summary"]);
  assert.equal(cues[0].event.type, "combat.attack");
  assert.equal(cues[1].event.type, "combat.block");
  assert.deepEqual(cues[2].labels, ["+1 XP", "DRAW 1"]);
  assert.ok(cues[1].holdMs >= 1200, "Block should remain readable long enough to capture");
  assert.ok(cues[2].holdMs >= 1400, "Result ticket should remain readable long enough to capture");
});

test("routine events for one fighter collapse into one result ticket", () => {
  const cues = buildVfxPresentationCues([
    { type: "resource.focusGain", fighter: "player", amount: 2 },
    { type: "resource.xpGain", fighter: "player", amount: 1 },
    { type: "card.draw", fighter: "player", amount: 2 },
    { type: "tempo.used", fighter: "player" },
  ]);

  assert.equal(cues.length, 1);
  assert.equal(cues[0].kind, "summary");
  assert.deepEqual(cues[0].labels, ["+2 FOCUS", "+1 XP", "DRAW 2", "TEMPO USED"]);
});

test("player and opponent routine results get separate readable tickets", () => {
  const cues = buildVfxPresentationCues([
    { type: "resource.focusGain", fighter: "player", amount: 1 },
    { type: "card.discard", fighter: "ai", amount: 1 },
  ]);

  assert.equal(cues.length, 2);
  assert.equal(cues[0].kind, "summary");
  assert.equal(cues[0].fighter, "player");
  assert.equal(cues[1].kind, "summary");
  assert.equal(cues[1].fighter, "ai");
});

test("promotion suppresses redundant Belt Exam flash", () => {
  const cues = buildVfxPresentationCues([
    { type: "progress.beltExam", fighter: "player" },
    { type: "progress.promotion", fighter: "player", belt: 2 },
  ]);

  assert.equal(cues.length, 1);
  assert.equal(cues[0].kind, "event");
  assert.equal(cues[0].event.type, "progress.promotion");
});

test("KO ends the visual sentence without post-knockout resource chatter", () => {
  const cues = buildVfxPresentationCues([
    { type: "combat.attack", actor: "player", target: "ai", zone: "High" },
    { type: "combat.hit", actor: "player", target: "ai", amount: 6 },
    { type: "resource.xpGain", fighter: "player", amount: 1 },
    { type: "card.draw", fighter: "player", amount: 1 },
    { type: "combat.ko", fighter: "ai", winner: "player" },
  ]);

  assert.deepEqual(cues.map((cue) => cue.kind), ["event", "event", "event"]);
  assert.deepEqual(cues.map((cue) => cue.event.type), ["combat.attack", "combat.hit", "combat.ko"]);
  assert.ok(cues.at(-1).holdMs >= 1600);
});
