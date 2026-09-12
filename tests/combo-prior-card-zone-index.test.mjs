import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/combo-runtime.ts", import.meta.url), "utf8");

const attack = (id) => ({ id, subtype: "Attack" });
const kata = (id) => ({ id, subtype: "Kata" });
const isAttack = (card) => card.subtype === "Attack";

function correctlyIndexedHistory(priorCards, zonesPlayed) {
  let attackIndex = 0;
  return priorCards.map((card) => ({
    card,
    zone: isAttack(card) ? zonesPlayed[attackIndex++] ?? "" : "",
  }));
}

test("priorCardMatches uses Attack-indexed history instead of prior-card array indexes", () => {
  assert.match(
    source,
    /case\s+"priorCardMatches"\s*:\s*return\s+historyEntries\(context\)[\s\S]*?\.filter\(\(entry\)\s*=>\s*!entry\.current\)[\s\S]*?stepMatches\(requirement,\s*entry\.card,\s*entry\.zone\)/,
  );
  assert.doesNotMatch(
    source,
    /case\s+"priorCardMatches"[\s\S]{0,300}context\.zonesPlayed\[index\]/,
  );
});

test("Attack, Kata, Attack maps the second Attack to the second Attack zone", () => {
  const first = attack("first");
  const middle = kata("middle");
  const second = attack("second");
  const history = correctlyIndexedHistory([first, middle, second], ["High", "Low"]);

  assert.deepEqual(history.map((entry) => entry.zone), ["High", "", "Low"]);
  const zoneAwarePriorMatch = history.some((entry) => entry.card.subtype === "Attack" && entry.zone === "Low");
  assert.equal(zoneAwarePriorMatch, true, "the second Attack must retain the second Attack-zone fact even with a Kata between Attacks");
});
