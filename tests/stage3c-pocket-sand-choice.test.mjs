import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { consumableRuntimeCommands } from "../app/consumable-effect-resolvers.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const pocketSand = cards.find((card) => card.catalogId === "DDB-CON-CORE-043");

const context = {
  friendlyTargetCount: 1,
  opponentTargetCount: 1,
};

test("Pocket Sand auto-targets the only duel opponent but preserves multiplayer choice", () => {
  assert.ok(pocketSand);
  const duel = consumableRuntimeCommands(pocketSand, "onPlay", context)
    .find((command) => command.resolver === "consumable.chooseOpponentNextDefenseGuardPenalty");
  assert.ok(duel);
  assert.equal(duel.choice, undefined);
  assert.equal(duel.amount, -2);
  assert.equal(duel.duration, "nextDefense");
  assert.equal(duel.qualifier?.expires, "endOfRound");

  const multiplayer = consumableRuntimeCommands(pocketSand, "onPlay", { ...context, opponentTargetCount: 2 })
    .find((command) => command.resolver === "consumable.chooseOpponentNextDefenseGuardPenalty");
  assert.deepEqual(multiplayer?.choice, {
    resolver: "consumable.chooseOpponentNextDefenseGuardPenalty",
    catalogId: "DDB-CON-CORE-043",
  });
});
