import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

let source = await readFile("scripts/stage3b-followup-state-patch.mjs", "utf8");

const ambiguousEmptyBoard = `  'flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false',\n  'flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false',\n  "emptyBoard next Attack zone state",`;
const structuralEmptyBoard = `  'tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], tempo: true, attackedThisRound: false,',\n  'tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], tempo: true, attackedThisRound: false,',\n  "emptyBoard next Attack zone state",`;
if (!source.includes(ambiguousEmptyBoard)) throw new Error("Could not locate emptyBoard patch block");
source = source.replace(ambiguousEmptyBoard, structuralEmptyBoard);

const loopingBlock = `const consumeNeedle = 'nextAttackBonus: 0, nextAttackHasFlow: false,';\nlet consumeCount = 0;\nwhile (playtest.includes(consumeNeedle)) {\n  playtest = playtest.replace(consumeNeedle, 'nextAttackBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false,');\n  consumeCount += 1;\n}\nif (consumeCount !== 2) throw new Error(\`Expected two normal Attack consumption patches; found \${consumeCount}\`);`;
const boundedBlock = `const consumeNeedle = 'nextAttackBonus: 0, nextAttackHasFlow: false,';\nconst consumeReplacement = 'nextAttackBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false,';\nconst consumeCount = playtest.split(consumeNeedle).length - 1;\nif (consumeCount !== 2) throw new Error(\`Expected two normal Attack consumption patches; found \${consumeCount}\`);\nplaytest = playtest.split(consumeNeedle).join(consumeReplacement);`;
if (!source.includes(loopingBlock)) throw new Error("Could not locate next-Attack consumption loop");
source = source.replace(loopingBlock, boundedBlock);

const fixedPath = "/tmp/stage3b-followup-state-patch-fixed.mjs";
await writeFile(fixedPath, source, "utf8");
await import(pathToFileURL(fixedPath).href);
