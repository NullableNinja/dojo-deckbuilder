import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const sourcePath = "scripts/stage3b-followup-state-patch.mjs";
let source = await readFile(sourcePath, "utf8");

const before = `  'flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false',\n  'flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false',\n  "emptyBoard next Attack zone state",`;
const after = `  'tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], tempo: true, attackedThisRound: false,',\n  'tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, nextAttackAnyZone: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], tempo: true, attackedThisRound: false,',\n  "emptyBoard next Attack zone state",`;

if (!source.includes(before)) throw new Error("Could not locate the ambiguous emptyBoard patch target");
source = source.replace(before, after);
const fixedPath = "/tmp/stage3b-followup-state-patch-fixed.mjs";
await writeFile(fixedPath, source, "utf8");
await import(pathToFileURL(fixedPath).href);
