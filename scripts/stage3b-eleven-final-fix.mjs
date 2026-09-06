import { readFile, writeFile } from "node:fs/promises";

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: target missing`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: target ambiguous`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

let playtest = await readFile("app/playtest.tsx", "utf8");
playtest = replaceOnce(
  playtest,
  '    const rawDamage = hit ? Math.max(0, pending.attackPower - defensePower + (pending.damageModifier ?? 0)) : 0;',
  '    const rawDamage = hit ? Math.max(0, finalAttackPower - defensePower + (pending.damageModifier ?? 0)) : 0;',
  "AI post-Defense damage must use final Attack Power",
);
await writeFile("app/playtest.tsx", playtest, "utf8");

let tests = await readFile("tests/attack-structured-resolvers-batch.test.mjs", "utf8");
const regression = `\n\ntest("post-Defense Attack modifiers feed the final power into AI damage math", async () => {\n  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");\n  assert.match(source, /const finalAttackPower = Math\\.max\\(0, pending\\.attackPower \\+ postDefensePower\\.amount\\);/);\n  assert.match(source, /const rawDamage = hit \\? Math\\.max\\(0, finalAttackPower - defensePower \\+ \\(pending\\.damageModifier \\?\\? 0\\)\\) : 0;/);\n  assert.doesNotMatch(source, /const rawDamage = hit \\? Math\\.max\\(0, pending\\.attackPower - defensePower \\+ \\(pending\\.damageModifier \\?\\? 0\\)\\) : 0;/);\n});\n`;
if (tests.includes('post-Defense Attack modifiers feed the final power into AI damage math')) throw new Error("Regression test already present");
tests += regression;
await writeFile("tests/attack-structured-resolvers-batch.test.mjs", tests, "utf8");

console.log("Applied final post-Defense damage regression fix.");
