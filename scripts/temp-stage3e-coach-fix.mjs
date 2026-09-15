import fs from "node:fs";

const replace = (path, before, after, label) => {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(before)) throw new Error(`${label}: expected source block not found in ${path}`);
  fs.writeFileSync(path, source.replace(before, after));
};

replace(
  "app/character-runtime.ts",
  `function isAvailable(board: CharacterRuntimeBoard, effect: CharacterStructuredEffect, event: CharacterRuntimeEventType) {\n  const resolver = String(effect.resolver ?? "");\n  return Boolean(resolver)\n    && (resolverEvents[resolver] ?? []).includes(event)\n    && (!resolver.startsWith("character.green.") || greenCharacterAbilityUnlocked(board.belt))\n    && !usage(board, effect).includes(idFor(effect));\n}\n`,
  `function isAvailable(board: CharacterRuntimeBoard, effect: CharacterStructuredEffect, event: CharacterRuntimeEventType) {\n  const resolver = String(effect.resolver ?? "");\n  const used = usage(board, effect);\n  const resolverEffectIds = effectsFor(board.fighterId)\n    .filter((entry) => String(entry.resolver ?? "") === resolver)\n    .map(idFor);\n  return Boolean(resolver)\n    && (resolverEvents[resolver] ?? []).includes(event)\n    && (!resolver.startsWith("character.green.") || greenCharacterAbilityUnlocked(board.belt))\n    && !resolverEffectIds.some((id) => used.includes(id));\n}\n`,
  "shared-resolver usage guard",
);

replace(
  "tests/character-runtime-enforcement.test.mjs",
  `test("005 Coach Karen: opponent modification cycles and Green primes the matching card type", () => {\n  const first = run("DDB-CHR-CORE-005", { type: "cardPlayed", opponentModifiedCard: true, card: attack(), selectedId: "h1" });\n  assert.ok(first.self.discard.includes("h1"));\n  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "cardPlayed", card: attack() }, "ai");\n  assert.equal(second.self.nextAttackBonus, 1);\n});\n`,
  `test("005 Coach Karen: opponent modification cycles and Green primes the matching card type", () => {\n  const first = run("DDB-CHR-CORE-005", { type: "cardModified", opponentModifiedCard: true, modifiedCardType: "Attack" });\n  assert.ok(first.self.discard.includes("h1"));\n  assert.equal(first.self.nextAttackBonus, 1);\n  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "cardModified", opponentModifiedCard: true, modifiedCardType: "Defense" }, "ai");\n  assert.equal(second.self.nextAttackBonus, 1);\n  assert.equal(second.self.nextDefenseCardBonus, 0, "the once-per-round Coach ability must not reopen through its sibling effect row");\n  assert.equal(second.self.discard.length, first.self.discard.length, "White must cycle only once per round");\n});\n`,
  "stale Coach enforcement test",
);

console.log("Coach Karen certification repairs applied.");
