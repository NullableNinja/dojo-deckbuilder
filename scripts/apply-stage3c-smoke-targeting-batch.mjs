import { readFile, writeFile } from "node:fs/promises";

const path = "app/playtest.tsx";
let source = await readFile(path, "utf8");

function replaceOnce(haystack, before, after, label) {
  const first = haystack.indexOf(before);
  if (first < 0) throw new Error(`Missing anchor: ${label}`);
  if (haystack.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous anchor: ${label}`);
  return haystack.slice(0, first) + after + haystack.slice(first + before.length);
}

function patchSegment(haystack, startMarker, endMarker, patcher, label) {
  const start = haystack.indexOf(startMarker);
  const end = haystack.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Missing segment: ${label}`);
  const segment = haystack.slice(start, end);
  const patched = patcher(segment);
  if (patched === segment) throw new Error(`No changes made in segment: ${label}`);
  return haystack.slice(0, start) + patched + haystack.slice(end);
}

source = replaceOnce(
  source,
  'import { chooseAiDefensiveConsumable } from "./stage3c-consumable-reaction-ai.ts";',
  'import { chooseAiDefensiveConsumable } from "./stage3c-consumable-reaction-ai.ts";\nimport { hasUntargetableStatus } from "./stage3c-consumable-event-reactions.ts";',
  "Smoke event import",
);

source = patchSegment(source, "  const runAiTurn = () => setMatch((current) => {", "\n\n  useEffect(() => {", (segment) => {
  return replaceOnce(
    segment,
    "    const prepared = prepareAiTurn(current);\n    const availableAttacks = stage3cRestrictionBlocks(prepared.ai.stage3cRestrictions, \"attack\")",
    "    const prepared = prepareAiTurn(current);\n    if (hasUntargetableStatus(prepared.player.stage3cStatuses)) return finishAiTurn(prepared, \"Computer cannot legally target you through the Smoke Bomb and skips its Attack sequence.\", settings.locations);\n    const availableAttacks = stage3cRestrictionBlocks(prepared.ai.stage3cRestrictions, \"attack\")",
    "AI target legality",
  );
}, "runAiTurn");

source = patchSegment(source, "  const declareAttack = () => setMatch((current) => {", "\n\n  const playSupport =", (segment) => {
  let next = replaceOnce(
    segment,
    "    if (!card || !isAttack(card) || !current.player.hand.includes(card.id)) return current;\n    const anyZone = attackHasFlexibleZone(current.player, card);",
    "    if (!card || !isAttack(card) || !current.player.hand.includes(card.id)) return current;\n    if (hasUntargetableStatus(current.ai.stage3cStatuses)) return write(current, `${cardFor(current.ai.fighterId)?.name ?? \"The opponent\"} is Untargetable. ${card.name} stays in your hand.`, { selectedAttackId: null });\n    const anyZone = attackHasFlexibleZone(current.player, card);",
    "player pre-existing target legality",
  );
  next = replaceOnce(
    next,
    "    const aiConsumableReaction = autoPlayAiDefensiveConsumable(aiIncomingReaction.board, Math.max(0, baseAttackPower - fighterStat(aiIncomingReaction.board, \"DEF\")));\n    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);\n    const defenseId = bestDefense(aiConsumableReaction.board, zone, Math.max(0, baseAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value, armorPenalty);",
    "    const aiConsumableReaction = autoPlayAiDefensiveConsumable(aiIncomingReaction.board, Math.max(0, baseAttackPower - fighterStat(aiIncomingReaction.board, \"DEF\")));\n    const targetInvalidated = hasUntargetableStatus(aiConsumableReaction.board.stage3cStatuses);\n    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);\n    const defenseId = targetInvalidated ? null : bestDefense(aiConsumableReaction.board, zone, Math.max(0, baseAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value, armorPenalty);",
    "AI Smoke target invalidation",
  );
  next = replaceOnce(next, "    const hit = attackPower > defensePower;", "    const hit = !targetInvalidated && attackPower > defensePower;", "Smoke cannot hit");
  next = next.replace("    if (!hit && armedEquipment.blockedFocus) nextPlayer = gainFocus(nextPlayer, armedEquipment.blockedFocus);", "    if (!hit && !targetInvalidated && armedEquipment.blockedFocus) nextPlayer = gainFocus(nextPlayer, armedEquipment.blockedFocus);");
  next = next.replace("    if (!hit) nextAi = { ...nextAi, blockedSinceLastTurn: true, blockedThisRound: true };", "    if (!hit && !targetInvalidated) nextAi = { ...nextAi, blockedSinceLastTurn: true, blockedThisRound: true };");
  next = next.replace("resolveConsumableAttackFollowupStatuses(nextPlayer.stage3cStatuses ?? [], { blocked: !hit, interferencePrevented: false })", "resolveConsumableAttackFollowupStatuses(nextPlayer.stage3cStatuses ?? [], { blocked: !hit && !targetInvalidated, interferencePrevented: false })");
  next = replaceOnce(
    next,
    "    const result = hit\n      ? `${card.name} hits ${aiFighter?.name ?? \"the opponent\"} for ${damage}.${defenseCard ? ` ${defenseCard.name} is discarded after this strike.` : \"\"}`",
    "    const result = targetInvalidated\n      ? `${aiConsumableReaction.card?.name ?? \"Reaction\"} makes ${aiFighter?.name ?? \"the opponent\"} Untargetable; ${card.name} loses its target.`\n      : hit\n      ? `${card.name} hits ${aiFighter?.name ?? \"the opponent\"} for ${damage}.${defenseCard ? ` ${defenseCard.name} is discarded after this strike.` : \"\"}`",
    "Smoke result log",
  );
  return next;
}, "declareAttack");

source = patchSegment(source, "  const playSupport = (id: string) => setMatch((current) => {", "\n\n  const practiceDefense =", (segment) => {
  return replaceOnce(
    segment,
    "    if (destroyedAfterUse) nextPlayer = destroyResolvedConsumable(nextPlayer, card);\n    else if (returnedAfterUse) nextPlayer = returnResolvedConsumable(nextPlayer, card);\n    const pendingDiscard = null;",
    "    if (destroyedAfterUse) nextPlayer = destroyResolvedConsumable(nextPlayer, card);\n    else if (returnedAfterUse) nextPlayer = returnResolvedConsumable(nextPlayer, card);\n    if (current.phase === \"defense-window\" && current.pendingStrike && hasUntargetableStatus(nextPlayer.stage3cStatuses)) {\n      const cancelled = write(current, `${card.name} makes you Untargetable. ${cardFor(current.pendingStrike.cardId)?.name ?? \"The declared Attack\"} loses its target.`, { player: nextPlayer, pendingStrike: null, pendingChoice: null });\n      return finishAiTurn(cancelled, \"The computer has no legal Quick Duel target for its remaining Attacks.\", settings.locations);\n    }\n    const pendingDiscard = null;",
    "player Smoke reaction cancellation",
  );
}, "playSupport");

source = patchSegment(source, "  const resolveReversal = () => setMatch((current) => {", "\n\n  const chooseAttack =", (segment) => {
  let next = replaceOnce(
    segment,
    "    if (!card || !isAttack(card) || !current.player.hand.includes(card.id)) return current;\n    const zone = attackHasFlexibleZone(current.player, card) ? current.selectedZone : card.zone?.split(\",\")[0] ?? \"High\";",
    "    if (!card || !isAttack(card) || !current.player.hand.includes(card.id)) return current;\n    if (hasUntargetableStatus(current.ai.stage3cStatuses)) return write(current, `${cardFor(current.ai.fighterId)?.name ?? \"The opponent\"} is Untargetable, so the Reversal cannot be declared.`, { selectedAttackId: null });\n    const zone = attackHasFlexibleZone(current.player, card) ? current.selectedZone : card.zone?.split(\",\")[0] ?? \"High\";",
    "reversal pre-existing target legality",
  );
  next = replaceOnce(
    next,
    "    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, \"ATK\") + current.player.nextAttackBonus + stage3cReversalBonus + (current.player.reversalAttackBonus ?? 0) + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);\n    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);\n    const defenseId = bestDefense(current.ai, zone, Math.max(0, baseAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value);",
    "    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, \"ATK\") + current.player.nextAttackBonus + stage3cReversalBonus + (current.player.reversalAttackBonus ?? 0) + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);\n    const aiConsumableReaction = autoPlayAiDefensiveConsumable(current.ai, Math.max(0, baseAttackPower - fighterStat(current.ai, \"DEF\")));\n    const reactingAi = aiConsumableReaction.board;\n    const targetInvalidated = hasUntargetableStatus(reactingAi.stage3cStatuses);\n    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);\n    const defenseId = targetInvalidated ? null : bestDefense(reactingAi, zone, Math.max(0, baseAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value);",
    "reversal AI Reaction",
  );
  next = next.replace("locationDefenseModifier(location, defenseCard, current.ai, zone)", "locationDefenseModifier(location, defenseCard, reactingAi, zone)");
  next = next.replace("defenseCardRuleModifier(current.ai, current.player, defenseCard, card)", "defenseCardRuleModifier(reactingAi, current.player, defenseCard, card)");
  next = next.replace("fighterStat(current.ai, \"DEF\")", "fighterStat(reactingAi, \"DEF\")");
  next = next.replace("stage3cIncomingAttackDefenseBonus(current.ai)", "stage3cIncomingAttackDefenseBonus(reactingAi)");
  next = next.replace("(current.ai.nextDefenseCardBonus ?? 0)", "(reactingAi.nextDefenseCardBonus ?? 0)");
  next = next.replace("reduceDamageForFighter(current.ai, rawDamage)", "reduceDamageForFighter(reactingAi, rawDamage)");
  next = replaceOnce(next, "    const hit = attackPower > defensePower;", "    const hit = !targetInvalidated && attackPower > defensePower;", "reversal Smoke cannot hit");
  next = next.replace("    if (!hit) nextAi = { ...nextAi, blockedSinceLastTurn: true, blockedThisRound: true };", "    if (!hit && !targetInvalidated) nextAi = { ...nextAi, blockedSinceLastTurn: true, blockedThisRound: true };");
  next = next.replace("resolveConsumableAttackFollowupStatuses(nextPlayer.stage3cStatuses ?? [], { blocked: !hit, interferencePrevented: false })", "resolveConsumableAttackFollowupStatuses(nextPlayer.stage3cStatuses ?? [], { blocked: !hit && !targetInvalidated, interferencePrevented: false })");
  next = next.replace("    const modifiers = [...locationModifier.notes", "    const modifiers = [...aiConsumableReaction.notes, ...locationModifier.notes");
  next = replaceOnce(
    next,
    "    const result = hit ? `Reversal! ${card.name} hits ${cardFor(current.ai.fighterId)?.name ?? \"the computer\"} for ${damage}.` : `Reversal! ${card.name} is blocked${defenseCard ? ` by ${defenseCard.name}` : \" by base DEF\"}.`;",
    "    const result = targetInvalidated ? `Reversal! ${aiConsumableReaction.card?.name ?? \"Reaction\"} makes ${cardFor(current.ai.fighterId)?.name ?? \"the computer\"} Untargetable; ${card.name} loses its target.` : hit ? `Reversal! ${card.name} hits ${cardFor(current.ai.fighterId)?.name ?? \"the computer\"} for ${damage}.` : `Reversal! ${card.name} is blocked${defenseCard ? ` by ${defenseCard.name}` : \" by base DEF\"}.`;",
    "reversal Smoke result",
  );
  return next;
}, "resolveReversal");

await writeFile(path, source);

const testPath = "tests/stage3c-smoke-bomb-play-surface.test.mjs";
await writeFile(testPath, `import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\nimport { canPlayCoreConsumableInPhase } from "../app/stage3c-consumable-play-window.ts";\n\nconst cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];\nconst smoke = cards.find((entry) => entry.catalogId === "DDB-CON-CORE-049");\nconst playtest = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");\n\ntest("Smoke Bomb is legal in the live incoming-Attack Reaction Window", () => {\n  assert.equal(canPlayCoreConsumableInPhase(smoke, "defense-window", { friendlyTargetCount: 1, opponentTargetCount: 1 }), true);\n});\n\ntest("Quick Duel refuses Attacks against an already-Untargetable opponent", () => {\n  assert.match(playtest, /hasUntargetableStatus\\(current\\.ai\\.stage3cStatuses\\)/);\n  assert.match(playtest, /hasUntargetableStatus\\(prepared\\.player\\.stage3cStatuses\\)/);\n});\n\ntest("Smoke Bomb invalidates a declared strike without counting it as a Block", () => {\n  assert.match(playtest, /const targetInvalidated = hasUntargetableStatus/);\n  assert.match(playtest, /blocked: !hit && !targetInvalidated/);\n  assert.match(playtest, /makes you Untargetable/);\n});\n`);

console.log("Smoke Bomb target-invalidation batch applied.");
