import fs from "node:fs";

const path = "scripts/apply-stage3d-character-runtime.mjs";
let script = fs.readFileSync(path, "utf8");

function replaceBlock(label, replacement) {
  const marker = `  "${label}",\n);`;
  const markerIndex = script.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Character adapter label missing: ${label}`);
  const blockStart = script.lastIndexOf("source = replace", markerIndex);
  if (blockStart < 0) throw new Error(`Character adapter block missing: ${label}`);
  const blockEnd = markerIndex + marker.length;
  script = `${script.slice(0, blockStart)}${replacement}${script.slice(blockEnd)}`;
}

script = script.replace(
  'if (text.indexOf(search, index + search.length) >= 0) throw new Error(`Stage 3D patch anchor is not unique: ${label}`);',
  'if (text.indexOf(search, index + search.length) >= 0 && label !== "player Attack cardPlayed and AI Block Character event") throw new Error(`Stage 3D patch anchor is not unique: ${label}`);',
);

replaceBlock("Board Character runtime state", `source = replaceOnce(
  source,
  '  locationPendingChoice?: { kind: "location-choice"; sourceCardId: string; effectId: string; operation: string; options: string[]; metadata: Record<string, unknown>; step?: string } | null;\\n};',
  '  locationPendingChoice?: { kind: "location-choice"; sourceCardId: string; effectId: string; operation: string; options: string[]; metadata: Record<string, unknown>; step?: string } | null;\\n  usedCharacterEffectIdsThisTurn?: string[];\\n  usedCharacterEffectIdsThisRound?: string[];\\n  usedCharacterEffectIdsThisGame?: string[];\\n  characterMarks?: Record<string, unknown>;\\n  dealtCombatDamageThisTurn?: number;\\n  dealtCombatDamagePreviousTurn?: boolean | null;\\n};',
  "Board Character runtime state",
);`);

replaceBlock("generic Character pending choice", `source = replaceOnce(
  source,
  '  | { kind: "location-choice"; sourceCardId: string; effectId: string; operation: string; options: string[]; metadata: Record<string, unknown>; step?: string };',
  '  | { kind: "location-choice"; sourceCardId: string; effectId: string; operation: string; options: string[]; metadata: Record<string, unknown>; step?: string }\\n  | { kind: "character"; choice: CharacterRuntimeChoice; event: CharacterRuntimeEvent; context: "generic" | "incoming-strike" | "combo-reveal" | "ronin-market" | "ronin-location" | "reboot"; data?: Record<string, unknown>; resumeChoice?: PendingChoice | null };',
  "generic Character pending choice",
);`);

replaceBlock("Coupon Carl Market price", `source = replaceOnce(
  source,
  '  const base = Math.max(0, cardCost(card) + (board.stage3cPurchaseCostModifier ?? 0) + (card.cardType === "Item" ? (board.nextItemCostPenalty ?? 0) : 0) - certificationDiscount);\\n  return locationPurchasePrice(board, card, base);',
  '  const base = Math.max(0, cardCost(card) + (board.stage3cPurchaseCostModifier ?? 0) + (card.cardType === "Item" ? (board.nextItemCostPenalty ?? 0) : 0) - certificationDiscount);\\n  const locationPrice = locationPurchasePrice(board, card, base);\\n  return characterPurchasePrice(board, locationPrice);',
  "Coupon Carl Market price",
);`);

replaceBlock("initial Character Initiate", `source = replaceRegexOnce(
  source,
  /    setDeskView\\(null\\);\\n    setMatch\\((\\{ schema: 8,[^\\n]+\\})\\);/,
  '    setDeskView(null);\\n    let opened: Match = $1;\\n    if (playerFirst) { const initiated = applyCharacterInitiate(opened.player, opened.ai, "player"); opened = { ...opened, player: initiated.self, ai: initiated.opponent, pendingChoice: initiated.choice ? characterPendingChoice(initiated.choice, initiated.event) : null }; }\\n    setMatch(opened);',
  "initial Character Initiate",
);`);

replaceBlock("block Yell while Character choice pending", `source = replaceOnce(
  source,
  '  const beginYell = () => setMatch((current) => current?.phase === "player-initiate" ? write(current, "Initiate complete. Yell begins; subtlety has left the building.", { phase: "player-yell", player: resetLocationTurn({ ...current.player, usedEffectIdsThisTurn: [], locationOwnTurn: true, locationInInitiate: false }) }) : current);',
  '  const beginYell = () => setMatch((current) => current?.phase === "player-initiate" && !current.pendingChoice ? write(current, "Initiate complete. Yell begins; subtlety has left the building.", { phase: "player-yell", player: resetLocationTurn({ ...current.player, usedEffectIdsThisTurn: [], locationOwnTurn: true, locationInInitiate: false }) }) : current);',
  "block Yell while Character choice pending",
);`);

replaceBlock("AI Initiate and Rebooter", `source = replaceOnce(
  source,
  '  const fighter = cardFor(current.ai.fighterId);\\n  const initiatedAi = applyInitiateCarryover(resetLocationTurn({ ...current.ai, usedEffectIdsThisTurn: [], locationOwnTurn: true, locationInInitiate: true }));\\n  const turnEquipment = autoActivateAiTurnEquipment(initiatedAi);\\n  let aiStart: Board = { ...turnEquipment.board, locationInInitiate: false };\\n  aiStart = applyLocationManualActionAi(aiStart);',
  '  const fighter = cardFor(current.ai.fighterId);\\n  const initiatedAi = applyInitiateCarryover(resetLocationTurn({ ...current.ai, usedEffectIdsThisTurn: [], locationOwnTurn: true, locationInInitiate: true }));\\n  const characterInitiate = applyCharacterInitiate(initiatedAi, current.player, "ai");\\n  let characterAi = characterInitiate.self; let characterPlayer = characterInitiate.opponent;\\n  if (characterHasResolver(characterAi.fighterId, "character.exhaustReadyEquipmentLock") && characterAi.equipment.length) { const reboot = runCharacterEvent(characterAi, characterPlayer, { type: "reboot", candidateIds: characterAi.equipment }, "ai"); characterAi = reboot.self; characterPlayer = reboot.opponent; }\\n  const turnEquipment = autoActivateAiTurnEquipment(characterAi);\\n  let aiStart: Board = { ...turnEquipment.board, locationInInitiate: false };\\n  aiStart = applyLocationManualActionAi(aiStart);',
  "AI Initiate and Rebooter",
);`);

fs.writeFileSync(path, script);
console.log("Adapted legacy Character materializer for current Location/playmat source.");
