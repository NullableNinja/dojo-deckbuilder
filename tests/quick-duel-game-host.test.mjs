import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as host from "../app/quick-duel-game-host.ts";

const source = await readFile(new URL("../app/quick-duel-game-host.ts", import.meta.url), "utf8");

test("Quick Duel exposes one JSON-backed semantic host facade", () => {
  assert.equal(host.QUICK_DUEL_GAME_HOST_CONTRACT, "canonical-json-structured-runtime");
  for (const name of [
    "applyQuickDuelStructuredTransition",
    "comboHostFactsFromBoard",
    "comboPlanFromQuickDuelFacts",
    "comboContextFromQuickDuelBoard",
    "quickDuelComboPlansForEvent",
    "activateQuickDuelComboPlan",
    "publishQuickDuelComboTrigger",
    "resolveQuickDuelComboChoice",
    "publishQuickDuelCharacterEventSafely",
    "beginQuickDuelCharacterTurn",
    "beginQuickDuelCharacterRound",
  ]) assert.equal(typeof host[name], "function", name);
});

test("Quick Duel host facade contains no card/fighter dispatch or printed rules", () => {
  assert.doesNotMatch(source, /DDB-(?:ATK|DEF|KAT|CON|ITM|CMB|CHR|LOC)-CORE-/);
  assert.doesNotMatch(source, /rulesText|Requirement:|Payoff:|fighterId\s*===|catalogId\s*===/);
  assert.doesNotMatch(source, /combat\.modify|core\.gain|core\.draw|core\.discard/);
});

test("Quick Duel host facade stays an adapter instead of becoming another rule engine", () => {
  const executableStatements = source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//") && !line.startsWith("*") && !line.startsWith("/*"));
  assert.ok(executableStatements.length < 80, "facade should remain a thin export boundary");
  assert.doesNotMatch(source, /\bswitch\s*\(|\bif\s*\(/);
});
