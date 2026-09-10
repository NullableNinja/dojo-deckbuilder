import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  consumableEventReactionKind,
  eventReactionCards,
  firstEventReactionCard,
  isDisarmReplacementReaction,
  isReactionCancellationReaction,
  isRevealReplacementReaction,
  isTargetInvalidationReaction,
} from "../app/stage3c-consumable-event-reactions.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const byCatalogId = new Map(cards.map((card) => [card.catalogId, card]));

const expected = [
  ["DDB-CON-CORE-001", "Air Horn", "cancel-reaction"],
  ["DDB-CON-CORE-017", "Emergency Shoelace", "replace-disarm"],
  ["DDB-CON-CORE-033", "Lucky Dumpling", "replace-reveal"],
  ["DDB-CON-CORE-049", "Smoke Bomb", "invalidate-target"],
];

test("the four event-specific Core Consumables map to distinct structured Reaction contracts", () => {
  for (const [catalogId, name, kind] of expected) {
    const card = byCatalogId.get(catalogId);
    assert.ok(card, `${name} must exist in the Core catalog`);
    assert.equal(String(card.timing ?? "").trim().toLocaleLowerCase(), "reaction", `${name} must remain a Reaction card`);
    assert.equal(consumableEventReactionKind(card), kind, `${name} must map to ${kind}`);
  }

  assert.equal(isReactionCancellationReaction(byCatalogId.get("DDB-CON-CORE-001")), true);
  assert.equal(isDisarmReplacementReaction(byCatalogId.get("DDB-CON-CORE-017")), true);
  assert.equal(isRevealReplacementReaction(byCatalogId.get("DDB-CON-CORE-033")), true);
  assert.equal(isTargetInvalidationReaction(byCatalogId.get("DDB-CON-CORE-049")), true);
});

test("event Reaction selection is timing-aware and deterministic", () => {
  const cardsInHand = [
    byCatalogId.get("DDB-CON-CORE-049"),
    byCatalogId.get("DDB-CON-CORE-001"),
    byCatalogId.get("DDB-CON-CORE-033"),
  ].filter(Boolean);
  assert.deepEqual(eventReactionCards(cardsInHand, "cancel-reaction").map((card) => card.catalogId), ["DDB-CON-CORE-001"]);
  assert.equal(firstEventReactionCard(cardsInHand, "replace-reveal")?.catalogId, "DDB-CON-CORE-033");
});

test("Emergency Shoelace is currently unreachable in Core Quick Duel because Core has no Disarm producer", async () => {
  const playtest = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.equal(/\bdisarm\b/i.test(playtest), false, "Quick Duel must not pretend to have a Disarm event hook that does not exist");

  const producerFamilies = ["starters", "attacks", "defenses", "katas", "equipment", "combos", "locations", "characters"];
  const producers = [];
  for (const family of producerFamilies) {
    const source = await readFile(new URL(`../content/card-effects/${family}.json`, import.meta.url), "utf8");
    if (/\bdisarm\b/i.test(source)) producers.push(family);
  }
  assert.deepEqual(producers, [], "Shoelace must remain reachability-blocked until a canonical Core Disarm producer exists");
});
