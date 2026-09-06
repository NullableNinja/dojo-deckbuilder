import { readFile, writeFile } from "node:fs/promises";

function replaceExact(source, before, after, label, expected = 1) {
  const hits = source.split(before).length - 1;
  if (hits !== expected) throw new Error(`${label}: expected ${expected} target(s), found ${hits}`);
  return source.split(before).join(after);
}

let playtest = await readFile("app/playtest.tsx", "utf8");

playtest = replaceExact(
  playtest,
  '    const rawDamage = hit ? Math.max(0, pending.attackPower - defensePower + (pending.damageModifier ?? 0)) : 0;',
  '    const rawDamage = hit ? Math.max(0, finalAttackPower - defensePower + (pending.damageModifier ?? 0)) : 0;',
  "AI post-Defense damage uses final Attack Power",
);

playtest = replaceExact(
  playtest,
  '    if (!hit && defenseCard) nextPlayer = { ...nextPlayer, blockedSinceLastTurn: true, blockedThisRound: true };',
  '    if (!hit) nextPlayer = { ...nextPlayer, blockedSinceLastTurn: true, blockedThisRound: true };',
  "standing DEF/Armor Block memory for player",
);

playtest = replaceExact(
  playtest,
  '    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, blockedSinceLastTurn: !hit || Boolean(nextAi.blockedSinceLastTurn), blockedThisRound: !hit || Boolean(nextAi.blockedThisRound), nextDefenseCardBonus: 0 };',
  '    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, nextDefenseCardBonus: 0 };\n    if (!hit) nextAi = { ...nextAi, blockedSinceLastTurn: true, blockedThisRound: true };',
  "normal Attack Block memory for AI",
);

playtest = replaceExact(
  playtest,
  '    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, blockedSinceLastTurn: !hit || Boolean(nextAi.blockedSinceLastTurn), blockedThisRound: !hit || Boolean(nextAi.blockedThisRound), nextDefenseCardBonus: 0 };',
  '    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, nextDefenseCardBonus: 0 };\n    if (!hit) nextAi = { ...nextAi, blockedSinceLastTurn: true, blockedThisRound: true };',
  "Reversal Block memory for AI",
);

await writeFile("app/playtest.tsx", playtest, "utf8");

let tests = await readFile("tests/attack-structured-resolvers-batch.test.mjs", "utf8");
if (tests.includes('post-Defense Attack modifiers feed the final power into AI damage math')) {
  throw new Error("final regression test already exists unexpectedly");
}

tests += `\n\ntest("post-Defense Attack modifiers feed final power into AI damage math", async () => {\n  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");\n  assert.match(source, /const finalAttackPower = Math\\.max\\(0, pending\\.attackPower \\+ postDefensePower\\.amount\\);/);\n  assert.match(source, /const rawDamage = hit \\? Math\\.max\\(0, finalAttackPower - defensePower \\+ \\(pending\\.damageModifier \\?\\? 0\\)\\) : 0;/);\n  assert.doesNotMatch(source, /const rawDamage = hit \\? Math\\.max\\(0, pending\\.attackPower - defensePower \\+ \\(pending\\.damageModifier \\?\\? 0\\)\\) : 0;/);\n});\n\ntest("Block memory includes zero-damage strikes stopped by standing DEF or Armor", async () => {\n  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");\n  assert.match(source, /if \\(!hit\\) nextPlayer = \\{ \\.\\.\\.nextPlayer, blockedSinceLastTurn: true, blockedThisRound: true \\};/);\n  const aiBlockMemory = source.match(/if \\(!hit\\) nextAi = \\{ \\.\\.\\.nextAi, blockedSinceLastTurn: true, blockedThisRound: true \\};/g) ?? [];\n  assert.ok(aiBlockMemory.length >= 2, "normal Attacks and Reversals must both remember standing-DEF Blocks");\n  assert.doesNotMatch(source, /if \\(!hit && defenseCard\\) nextPlayer = \\{ \\.\\.\\.nextPlayer, blockedSinceLastTurn: true, blockedThisRound: true \\};/);\n});\n`;

await writeFile("tests/attack-structured-resolvers-batch.test.mjs", tests, "utf8");
console.log("Prepared final 11-card product files without writing to GitHub.");
