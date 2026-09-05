import assert from "node:assert/strict";
import test from "node:test";
import { attackCanChooseAnyZone, structuredFocusIfFastest } from "../app/effect-resolvers.ts";

test("Wild Swing zone choice resolves from structured data before prose", () => {
  const card = {
    catalogId: "DDB-STA-CORE-011",
    name: "Wild Swing",
    rulesText: "This deliberately does not describe a zone choice.",
    tags: [],
    stats: {},
    details: {},
  };
  assert.equal(attackCanChooseAnyZone(card, false, []), true);
});

test("Footwork Drill fastest Focus resolves from structured data", () => {
  const card = {
    catalogId: "DDB-STA-CORE-008",
    name: "Footwork Drill",
    rulesText: "This deliberately does not describe the conditional Focus reward.",
    tags: [],
    stats: {},
    details: {},
  };
  assert.equal(structuredFocusIfFastest(card, 6, 5), 1);
  assert.equal(structuredFocusIfFastest(card, 5, 5), 0, "A Speed tie is not faster");
  assert.equal(structuredFocusIfFastest(card, 4, 5), 0);
});

test("unmigrated cards do not accidentally inherit Starter resolvers", () => {
  const card = {
    catalogId: "DDB-ATK-CORE-999",
    name: "Definitely Not Wild Swing",
    rulesText: "No additional effect.",
    tags: [],
    stats: {},
    details: {},
  };
  assert.equal(attackCanChooseAnyZone(card, false, []), false);
  assert.equal(structuredFocusIfFastest(card, 99, 1), 0);
});
