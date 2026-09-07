import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../app/playtest.tsx", import.meta.url);
let source = await readFile(path, "utf8");
const marker = "STAGE3D_LOCATION_COMPILE_FIX";
if (source.includes(marker)) {
  console.log("Stage 3D Location compile fix already applied.");
  process.exit(0);
}

function replaceOnce(needle, replacement, label) {
  const matches = source.split(needle).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected exactly one match, found ${matches}`);
  source = source.replace(needle, replacement);
}

replaceOnce(
  '    let player = { ...emptyBoard(fighterId), xp: 1, locationController: "player" as const };',
  '    let player: Board = { ...emptyBoard(fighterId), xp: 1, locationController: "player" }; // STAGE3D_LOCATION_COMPILE_FIX',
  "begin player Board annotation",
);
replaceOnce(
  '    let ai = { ...emptyBoard(choices[Math.floor(Math.random() * choices.length)].id), xp: 1, hp: challenge.aiHp, maxHp: challenge.aiHp, statBoost: challenge.statBoost, locationController: "ai" as const };',
  '    let ai: Board = { ...emptyBoard(choices[Math.floor(Math.random() * choices.length)].id), xp: 1, hp: challenge.aiHp, maxHp: challenge.aiHp, statBoost: challenge.statBoost, locationController: "ai" };',
  "begin AI Board annotation",
);
replaceOnce(
  '  const resetBoard = (board: Board, controller: "player" | "ai") => stage3cAdvanceRound(resetLocationRound({',
  '  const resetBoard = (board: Board, controller: "player" | "ai"): Board => stage3cAdvanceRound(resetLocationRound({',
  "round reset Board return annotation",
);
replaceOnce(
  '  let aiStart = { ...turnEquipment.board, locationInInitiate: false };',
  '  let aiStart: Board = { ...turnEquipment.board, locationInInitiate: false };',
  "AI start Board annotation",
);
replaceOnce(
  '  let nextAi = practiceId ? {',
  '  let nextAi: Board = practiceId ? {',
  "AI prepared Board annotation",
);
replaceOnce(
  '    const locationModifier = locationFocusModifier(cardFor(current.locationId), card, nextAi);\n    if (isKata(card)) nextAi = stage3cConsumeKata(nextAi);\n    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], focus: nextAi.focus + locationModifier.value, lastAttackHit: false }, card, "ai", "onPlay", isCoreConsumableCard(card) ? stage3cConsumableContext(nextAi) : {});',
  '    if (isKata(card)) nextAi = stage3cConsumeKata(nextAi);\n    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], lastAttackHit: false }, card, "ai", "onPlay", isCoreConsumableCard(card) ? stage3cConsumableContext(nextAi) : {});',
  "remove stale AI Location Focus path",
);

await writeFile(path, source);
console.log("Applied guarded Stage 3D Location compile fixes.");
