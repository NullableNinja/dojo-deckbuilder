import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../app/playtest.tsx", import.meta.url);
let source = await readFile(path, "utf8");

const replaceOnce = (label, before, after) => {
  if (source.includes(after)) return;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one source match, found ${count}`);
  source = source.replace(before, after);
};

replaceOnce(
  "structured resolver import",
  "targetNextDefensePenalty, targetSpeedPenaltyUntilHonor, type DeckLookPlan } from \"./effect-resolvers\";",
  "targetNextDefensePenalty, targetSpeedPenaltyUntilHonor, structuredFocusIfFastest, type DeckLookPlan } from \"./effect-resolvers\";",
);

const playerPlay = "    let nextPlayer = markCompletedTask(applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id], focus: current.player.focus + locationModifier.value, lastAttackHit: false }, card, \"player\"));";
replaceOnce(
  "player Footwork resolver",
  playerPlay,
  `${playerPlay}\n    const playerFastestFocus = structuredFocusIfFastest(card, fighterStat(nextPlayer, \"Speed\"), fighterStat(current.ai, \"Speed\"));\n    if (playerFastestFocus) nextPlayer = { ...nextPlayer, focus: nextPlayer.focus + playerFastestFocus };`,
);

const aiPlay = "    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], focus: nextAi.focus + locationModifier.value, lastAttackHit: false }, card, \"ai\");";
replaceOnce(
  "AI Footwork resolver",
  aiPlay,
  `${aiPlay}\n    const aiFastestFocus = structuredFocusIfFastest(card, fighterStat(nextAi, \"Speed\"), fighterStat(nextPlayer, \"Speed\"));\n    if (aiFastestFocus) nextAi = { ...nextAi, focus: nextAi.focus + aiFastestFocus };`,
);

await writeFile(path, source, "utf8");
console.log("Patched Quick Duel to resolve Footwork Drill's canonical fastest-Focus effect for both fighters.");
