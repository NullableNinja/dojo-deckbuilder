import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

let source = await readFile("scripts/stage3b-attack-eleven-patch.mjs", "utf8");

const countMarker = '  1,\n  "player conditional target Hit debuff",';
if ((source.split(countMarker).length - 1) !== 1) throw new Error("Target-debuff patch count marker changed");
source = source.replace(countMarker, '  2,\n  "player conditional target Hit debuff",');

const labelEnd = '  "player structured post-Attack followups",\n);';
const labelAt = source.indexOf(labelEnd);
if (labelAt < 0) throw new Error("Normal-Attack followup patch label missing");
const callStart = source.lastIndexOf('playtest = replaceCount(', labelAt);
if (callStart < 0) throw new Error("Normal-Attack followup patch call missing");
const callEnd = labelAt + labelEnd.length;
const replacement = `playtest = replaceCount(\n  playtest,\n  '    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, blockedSinceLastTurn: !hit || Boolean(nextAi.blockedSinceLastTurn), blockedThisRound: !hit || Boolean(nextAi.blockedThisRound), nextDefenseCardBonus: 0 };\\n    nextPlayer = applyCardEffects(nextPlayer, card, "player", hit ? "onHit" : "afterResolve");\\n    if (hit) nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve");\\n    let defenseFollowupNotes: string[] = [];',\n  '    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, playedDefenseSinceLastTurn: true, blockedSinceLastTurn: !hit || Boolean(nextAi.blockedSinceLastTurn), blockedThisRound: !hit || Boolean(nextAi.blockedThisRound), nextDefenseCardBonus: 0 };\\n    nextPlayer = applyCardEffects(nextPlayer, card, "player", hit ? "onHit" : "afterResolve");\\n    if (hit) nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve");\\n    const armorPenaltyGrant = hit ? nextAttackArmorPenalty(card) : 0;\\n    if (armorPenaltyGrant) nextPlayer = { ...nextPlayer, nextAttackArmorPenalty: (nextPlayer.nextAttackArmorPenalty ?? 0) + armorPenaltyGrant };\\n    if (conditionalCycle.draw) nextPlayer = drawCards(nextPlayer, conditionalCycle.draw);\\n    const cycleDiscardCount = nextAi.hp ? Math.min(conditionalCycle.discard, nextPlayer.hand.length) : 0;\\n    let defenseFollowupNotes: string[] = [];',\n  1,\n  "player structured post-Attack followups",\n);`;
source = source.slice(0, callStart) + replacement + source.slice(callEnd);

const tempPath = "/tmp/stage3b-attack-eleven-patch.mjs";
await writeFile(tempPath, source, "utf8");
await import(pathToFileURL(tempPath).href);
