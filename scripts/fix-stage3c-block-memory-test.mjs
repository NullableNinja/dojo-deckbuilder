import { readFile, writeFile } from "node:fs/promises";

const path = "tests/attack-structured-resolvers-batch.test.mjs";
let source = await readFile(path, "utf8");
const before = `  const aiBlockMemory = source.match(/if \\(!hit\\) (?:nextAi|reactingAi) = \\{ \\.\\.\\.(?:nextAi|reactingAi), blockedSinceLastTurn: true, blockedThisRound: true \\};/g) ?? [];\n  assert.ok(aiBlockMemory.length >= 2, "normal Attacks and Reversals must both remember standing-DEF Blocks");`;
const after = `  assert.match(source, /if \\(!hit && !targetInvalidated\\) nextAi = \\{ \\.\\.\\.nextAi, blockedSinceLastTurn: true, blockedThisRound: true \\};/, "normal Attacks must remember standing-DEF Blocks without treating target invalidation as a Block");\n  assert.match(source, /if \\(!hit\\) nextAi = \\{ \\.\\.\\.nextAi, blockedSinceLastTurn: true, blockedThisRound: true \\};/, "Reversals must remember standing-DEF Blocks");`;
if (!source.includes(before)) throw new Error("Block-memory assertion anchor not found");
source = source.replace(before, after);
await writeFile(path, source);
console.log("Block-memory certification now distinguishes Smoke target invalidation from real Blocks.");
