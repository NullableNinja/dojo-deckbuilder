import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const attacks = JSON.parse(await readFile(new URL("../content/card-effects/attacks.json", import.meta.url), "utf8"));
const vocabulary = JSON.parse(await readFile(new URL("../content/effects.json", import.meta.url), "utf8"));

const entries = Object.entries(attacks.cards ?? {});
const effects = entries.flatMap(([catalogId, entry]) =>
  (entry.effects ?? []).map((effect) => ({ catalogId, effect })),
);

test("all Core Attack effects use the canonical reusable vocabulary", () => {
  assert.equal(attacks.family, "Attack");
  assert.equal(entries.length, 71, "Attack family must retain all 71 canonical Core Attacks");
  assert.equal(effects.length, 90, "Attack effect-instance inventory changed; review the Stage 3B invariant");

  for (const { catalogId, effect } of effects) {
    assert.ok(effect.effect, `${catalogId} ${effect.id} must reference a canonical effect ID`);
    assert.ok(vocabulary.effects?.[effect.effect], `${catalogId} ${effect.id} references unknown effect ${effect.effect}`);
    assert.equal(effect.action, undefined, `${catalogId} ${effect.id} must not author a parallel legacy action`);

    for (const condition of effect.conditions ?? []) {
      assert.ok(vocabulary.conditions?.[condition.kind], `${catalogId} ${effect.id} uses unknown condition ${condition.kind}`);
    }
  }
});
