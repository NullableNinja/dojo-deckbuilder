import { readFile, writeFile } from "node:fs/promises";

const path = "app/playtest.tsx";
let source = await readFile(path, "utf8");

const pendingAnchor = '  | { kind: "fire-drill-zone"; sourceCardId: string; defenseId: string; originalZone: string; alternativeZones: string[] };';
const pendingReplacement = '  | { kind: "fire-drill-zone"; sourceCardId: string; defenseId: string; originalZone: string; alternativeZones: string[] }\n  | { kind: "air-horn-reaction"; sourceCardId: string; reactionCardId: string; reactionKind: "consumable" | "defense" };';
if (!source.includes(pendingReplacement)) {
  if (source.split(pendingAnchor).length !== 2) throw new Error("PendingChoice anchor drifted");
  source = source.replace(pendingAnchor, pendingReplacement);
}

const matchAnchor = '  nonHonorSceneChangedThisRound?: boolean;\n  exchangeSequence?: number;';
const matchReplacement = '  nonHonorSceneChangedThisRound?: boolean;\n  airHornPassedReactionIds?: string[];\n  airHornAiConsumableSpentThisStrike?: boolean;\n  airHornAiDefenseSpentThisStrike?: boolean;\n  exchangeSequence?: number;';
if (!source.includes(matchReplacement)) {
  if (source.split(matchAnchor).length !== 2) throw new Error("Match Air Horn fields anchor drifted");
  source = source.replace(matchAnchor, matchReplacement);
}

const declareStart = '  const declareAttack = () => setMatch((current) => {';
const playSupportMarker = '\n\n  const playSupport = (id: string) => setMatch((current) => {';
const startIndex = source.indexOf(declareStart);
const endIndex = source.indexOf(playSupportMarker, startIndex);
if (startIndex < 0 || endIndex < 0) throw new Error("declareAttack boundaries drifted");
let declareBlock = source.slice(startIndex, endIndex);
if (!declareBlock.endsWith('\n  });')) throw new Error("declareAttack closing anchor drifted");
declareBlock = declareBlock.replace(declareStart, '  const resolvePlayerAttackState = (current: Match): Match => {');
declareBlock = declareBlock.slice(0, -'\n  });'.length) + '\n  };';

const consumableAnchor = '    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);\n    const aiConsumableReaction = autoPlayAiDefensiveConsumable(aiIncomingReaction.board, Math.max(0, baseAttackPower - fighterStat(aiIncomingReaction.board, "DEF")));';
const consumableReplacement = `    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);
    const playerAirHorn = firstEventReactionCard(current.player.hand.map(cardFor).filter((candidate): candidate is CardEntry => Boolean(candidate && isCoreConsumableCard(candidate))), "cancel-reaction") as CardEntry | null;
    const expectedIncomingDamage = Math.max(0, baseAttackPower - fighterStat(aiIncomingReaction.board, "DEF"));
    const aiConsumableCandidate = current.airHornAiConsumableSpentThisStrike
      ? null
      : chooseAiDefensiveConsumable(aiIncomingReaction.board.hand.map(cardFor).filter((candidate): candidate is CardEntry => Boolean(candidate && isCoreConsumableCard(candidate))), {
          ...stage3cConsumableContext(aiIncomingReaction.board),
          missingHp: Math.max(0, aiIncomingReaction.board.maxHp - aiIncomingReaction.board.hp),
          expectedIncomingDamage,
          friendlyTargetCount: 1,
          opponentTargetCount: 1,
        }) as CardEntry | null;
    if (aiConsumableCandidate && playerAirHorn && !(current.airHornPassedReactionIds ?? []).includes(aiConsumableCandidate.id)) {
      return write(current, \`${"${aiConsumableCandidate.name}"} is played as the computer's Reaction. Air Horn can cancel it before resolution.\`, {
        pendingChoice: { kind: "air-horn-reaction", sourceCardId: playerAirHorn.id, reactionCardId: aiConsumableCandidate.id, reactionKind: "consumable" },
      });
    }
    const aiConsumableReaction = current.airHornAiConsumableSpentThisStrike
      ? { board: aiIncomingReaction.board, card: null as CardEntry | null, notes: ["Air Horn canceled the computer's Consumable Reaction"] }
      : autoPlayAiDefensiveConsumable(aiIncomingReaction.board, expectedIncomingDamage);`;
if (!declareBlock.includes(consumableReplacement)) {
  if (declareBlock.split(consumableAnchor).length !== 2) throw new Error("AI Consumable Reaction anchor drifted");
  declareBlock = declareBlock.replace(consumableAnchor, consumableReplacement);
}

const defenseAnchor = '    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);\n    const defenseId = bestDefense(aiConsumableReaction.board, zone, Math.max(0, baseAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value, armorPenalty);\n    const defenseCard = defenseId ? cardFor(defenseId) : null;\n    const postDefensePower = afterDefenseAttackPowerBonus(card, Boolean(defenseCard));';
const defenseReplacement = `    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);
    const defenseId = current.airHornAiDefenseSpentThisStrike
      ? null
      : bestDefense(aiConsumableReaction.board, zone, Math.max(0, baseAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value, armorPenalty);
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    if (defenseCard && playerAirHorn && !(current.airHornPassedReactionIds ?? []).includes(defenseCard.id)) {
      return write(current, \`${"${defenseCard.name}"} is played as the computer's one Defense for this strike. Air Horn can cancel it before Guard or printed effects resolve.\`, {
        pendingChoice: { kind: "air-horn-reaction", sourceCardId: playerAirHorn.id, reactionCardId: defenseCard.id, reactionKind: "defense" },
      });
    }
    const postDefensePower = afterDefenseAttackPowerBonus(card, Boolean(defenseCard));`;
if (!declareBlock.includes(defenseReplacement)) {
  if (declareBlock.split(defenseAnchor).length !== 2) throw new Error("AI Defense Reaction anchor drifted");
  declareBlock = declareBlock.replace(defenseAnchor, defenseReplacement);
}

const finalChangesAnchor = '{ player: nextPlayer, ai: nextAi, selectedAttackId: null, pendingChoice, exchangeSequence: (current.exchangeSequence ?? 0) + 1, lastExchange, winner: !nextPlayer.hp ? "ai" : nextAi.hp ? null : "player" }';
const finalChangesReplacement = '{ player: nextPlayer, ai: nextAi, selectedAttackId: null, pendingChoice, airHornPassedReactionIds: [], airHornAiConsumableSpentThisStrike: false, airHornAiDefenseSpentThisStrike: false, exchangeSequence: (current.exchangeSequence ?? 0) + 1, lastExchange, winner: !nextPlayer.hp ? "ai" : nextAi.hp ? null : "player" }';
if (!declareBlock.includes(finalChangesReplacement)) {
  if (declareBlock.split(finalChangesAnchor).length !== 2) throw new Error("declareAttack final state anchor drifted");
  declareBlock = declareBlock.replace(finalChangesAnchor, finalChangesReplacement);
}

const handler = `

  const declareAttack = () => setMatch((current) => current ? resolvePlayerAttackState(current) : current);

  const resolvePlayerAirHornChoice = (useAirHorn: boolean) => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice || choice.kind !== "air-horn-reaction") return current;
    const reaction = cardFor(choice.reactionCardId);
    const airHorn = cardFor(choice.sourceCardId);
    if (!reaction || !airHorn || !current.player.hand.includes(airHorn.id)) {
      const passed = write(current, "Air Horn is no longer available; the announced Reaction resolves.", {
        pendingChoice: null,
        airHornPassedReactionIds: [...new Set([...(current.airHornPassedReactionIds ?? []), choice.reactionCardId])],
      });
      return resolvePlayerAttackState(passed);
    }
    if (!useAirHorn) {
      const passed = write(current, \`Air Horn held. ${"${reaction.name}"} remains on the Dojo Stack and resolves normally.\`, {
        pendingChoice: null,
        airHornPassedReactionIds: [...new Set([...(current.airHornPassedReactionIds ?? []), reaction.id])],
      });
      return resolvePlayerAttackState(passed);
    }

    let player: Board = {
      ...current.player,
      hand: removeOne(current.player.hand, airHorn.id),
      playArea: [...current.player.playArea, airHorn.id],
      usedConsumableThisRound: true,
      reactionItemUsedSinceLastTurn: true,
    };
    player = returnResolvedConsumable(player, airHorn);
    let ai = current.ai;
    let airHornAiConsumableSpentThisStrike = Boolean(current.airHornAiConsumableSpentThisStrike);
    let airHornAiDefenseSpentThisStrike = Boolean(current.airHornAiDefenseSpentThisStrike);

    if (choice.reactionKind === "consumable") {
      if (ai.hand.includes(reaction.id)) {
        let cancelledAi: Board = {
          ...ai,
          hand: removeOne(ai.hand, reaction.id),
          playArea: [...ai.playArea, reaction.id],
          usedConsumableThisRound: true,
          reactionItemUsedSinceLastTurn: true,
        };
        cancelledAi = returnResolvedConsumable(cancelledAi, reaction);
        ai = cancelledAi;
      }
      airHornAiConsumableSpentThisStrike = true;
    } else {
      if (ai.hand.includes(reaction.id)) {
        ai = stage3cConsumeDefenseStatuses(markCompletedTask({
          ...ai,
          hand: removeOne(ai.hand, reaction.id),
          discard: [...ai.discard, reaction.id],
          xp: ai.xp + 1,
          defendedThisRound: true,
          playedDefenseSinceLastTurn: true,
          nextDefenseCardBonus: 0,
        }));
      }
      airHornAiDefenseSpentThisStrike = true;
    }

    const intercepted = write(current, \`Air Horn cancels ${"${reaction.name}"} before it resolves. ${"${choice.reactionKind === \"defense\" ? \"That was the computer's one Defense card for this strike.\" : \"The canceled Consumable returns to supply without applying its effect.\"}"}\`, {
      player,
      ai,
      pendingChoice: null,
      airHornAiConsumableSpentThisStrike,
      airHornAiDefenseSpentThisStrike,
    });
    return resolvePlayerAttackState(intercepted);
  });`;

source = source.slice(0, startIndex) + declareBlock + handler + source.slice(endIndex);

const titleAnchor = '  const effectChoiceTitle = match.pendingChoice?.kind === "destroy-junk" ? "Choose Junk to destroy"';
const titleReplacement = '  const effectChoiceTitle = match.pendingChoice?.kind === "air-horn-reaction" ? "Sound the Air Horn?"\n    : match.pendingChoice?.kind === "destroy-junk" ? "Choose Junk to destroy"';
if (!source.includes(titleReplacement)) {
  if (source.split(titleAnchor).length !== 2) throw new Error("effectChoiceTitle anchor drifted");
  source = source.replace(titleAnchor, titleReplacement);
}

const promptAnchor = '  const effectChoicePrompt = match.pendingChoice?.kind === "destroy-junk" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} requires ${match.pendingChoice.remaining} more Junk card${match.pendingChoice.remaining === 1 ? "" : "s"} from your hand or discard pile.`';
const promptReplacement = '  const effectChoicePrompt = match.pendingChoice?.kind === "air-horn-reaction" ? `${cardFor(match.pendingChoice.reactionCardId)?.name ?? "The computer Reaction"} was just played. Use Air Horn now to cancel it before the Dojo Stack resolves, or allow it to resolve normally.`\n    : match.pendingChoice?.kind === "destroy-junk" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} requires ${match.pendingChoice.remaining} more Junk card${match.pendingChoice.remaining === 1 ? "" : "s"} from your hand or discard pile.`';
if (!source.includes(promptReplacement)) {
  if (source.split(promptAnchor).length !== 2) throw new Error("effectChoicePrompt anchor drifted");
  source = source.replace(promptAnchor, promptReplacement);
}

const uiAnchor = '<div className="effect-choice-options">{match.pendingChoice?.kind === "prevent-combat-damage" ? <button type="button" onClick={usePendingEquipmentChoice}>';
const uiReplacement = '<div className="effect-choice-options">{match.pendingChoice?.kind === "air-horn-reaction" ? <><button type="button" onClick={() => resolvePlayerAirHornChoice(true)}><span>REACTION</span><b>USE AIR HORN</b><small>Cancel {cardFor(match.pendingChoice.reactionCardId)?.name ?? "the Reaction"} before it resolves</small></button><button type="button" onClick={() => resolvePlayerAirHornChoice(false)}><span>PASS</span><b>ALLOW REACTION</b><small>Keep Air Horn in hand and resolve the announced Reaction</small></button></> : match.pendingChoice?.kind === "prevent-combat-damage" ? <button type="button" onClick={usePendingEquipmentChoice}>';
if (!source.includes(uiReplacement)) {
  if (source.split(uiAnchor).length !== 2) throw new Error("effect-choice UI anchor drifted");
  source = source.replace(uiAnchor, uiReplacement);
}

await writeFile(path, source);

const test = `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");

test("player Air Horn pauses the declared Attack before an AI Consumable Reaction resolves", () => {
  const resolver = source.slice(source.indexOf("const resolvePlayerAttackState ="), source.indexOf("const declareAttack ="));
  const candidate = resolver.indexOf("const aiConsumableCandidate");
  const autoResolve = resolver.indexOf("const aiConsumableReaction =");
  assert.ok(candidate >= 0 && autoResolve > candidate);
  assert.match(resolver.slice(candidate, autoResolve), /pendingChoice: \{ kind: "air-horn-reaction"[^]*reactionKind: "consumable"/);
  assert.match(resolver, /airHornAiConsumableSpentThisStrike[^]*\? \{ board: aiIncomingReaction\.board/);
});

test("player Air Horn can cancel the AI's one Defense without allowing a replacement Defense", () => {
  const resolver = source.slice(source.indexOf("const resolvePlayerAttackState ="), source.indexOf("const declareAttack ="));
  assert.match(resolver, /const defenseId = current\.airHornAiDefenseSpentThisStrike\s*\? null\s*: bestDefense/);
  assert.match(resolver, /pendingChoice: \{ kind: "air-horn-reaction"[^]*reactionKind: "defense"/);
  const handler = source.slice(source.indexOf("const resolvePlayerAirHornChoice ="), source.indexOf("const playSupport ="));
  assert.match(handler, /airHornAiDefenseSpentThisStrike = true/);
  assert.match(handler, /return resolvePlayerAttackState\(intercepted\)/, "Air Horn decision must resume the same declared strike immediately");
});

test("Air Horn player choice preserves normal lifecycle destinations", () => {
  const handler = source.slice(source.indexOf("const resolvePlayerAirHornChoice ="), source.indexOf("const playSupport ="));
  assert.match(handler, /player = returnResolvedConsumable\(player, airHorn\)/);
  assert.match(handler, /cancelledAi = returnResolvedConsumable\(cancelledAi, reaction\)/, "canceled Consumable returns to supply");
  assert.match(handler, /discard: \[\.\.\.ai\.discard, reaction\.id\]/, "canceled Defense goes to normal discard");
  assert.match(handler, /stage3cConsumeDefenseStatuses\(markCompletedTask/, "the one played Defense consumes its one-Defense/next-Defense state even when canceled");
});

test("Air Horn choice is an explicit two-button Dojo Stack decision", () => {
  assert.match(source, /Sound the Air Horn\?/);
  assert.match(source, /resolvePlayerAirHornChoice\(true\)[^]*USE AIR HORN/);
  assert.match(source, /resolvePlayerAirHornChoice\(false\)[^]*ALLOW REACTION/);
});
`;
await writeFile("tests/stage3c-player-air-horn-play-surface.test.mjs", test);
