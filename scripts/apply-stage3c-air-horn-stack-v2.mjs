import { readFile, writeFile } from "node:fs/promises";

const path = "app/playtest.tsx";
let source = await readFile(path, "utf8");

const importAnchor = 'import { chooseAiDefensiveConsumable } from "./stage3c-consumable-reaction-ai.ts";\n';
const importLine = 'import { firstEventReactionCard } from "./stage3c-consumable-event-reactions.ts";\n';
if (!source.includes(importLine)) {
  if (source.split(importAnchor).length !== 2) throw new Error("Air Horn import anchor drifted");
  source = source.replace(importAnchor, importAnchor + importLine);
}

const supportAnchor = '    if (isCoreConsumableCard(card) && (current.player.stage3cRestrictions ?? []).includes("consumable")) return current;\n    const locationModifier = locationFocusModifier(cardFor(current.locationId), card, current.player);';
const supportReplacement = `    if (isCoreConsumableCard(card) && (current.player.stage3cRestrictions ?? []).includes("consumable")) return current;
    const aiAirHorn = current.phase === "defense-window" && String(card.timing ?? "").trim().toLocaleLowerCase() === "reaction"
      ? firstEventReactionCard(current.ai.hand.map(cardFor).filter((candidate): candidate is CardEntry => Boolean(candidate && isCoreConsumableCard(candidate))), "cancel-reaction") as CardEntry | null
      : null;
    if (aiAirHorn) {
      let cancelledPlayer: Board = {
        ...current.player,
        hand: removeOne(current.player.hand, card.id),
        playArea: [...current.player.playArea, card.id],
        usedConsumableThisRound: true,
        reactionItemUsedSinceLastTurn: true,
        lastAttackHit: false,
      };
      cancelledPlayer = returnResolvedConsumable(cancelledPlayer, card);
      let reactingAi: Board = {
        ...current.ai,
        hand: removeOne(current.ai.hand, aiAirHorn.id),
        playArea: [...current.ai.playArea, aiAirHorn.id],
        usedConsumableThisRound: true,
        reactionItemUsedSinceLastTurn: true,
      };
      reactingAi = returnResolvedConsumable(reactingAi, aiAirHorn);
      return write(current, \`${"${aiAirHorn.name}"} cancels ${"${card.name}"} before it resolves. Both one-use Consumables complete their normal supply lifecycle.\`, { player: cancelledPlayer, ai: reactingAi });
    }
    const locationModifier = locationFocusModifier(cardFor(current.locationId), card, current.player);`;
if (!source.includes(supportReplacement)) {
  if (source.split(supportAnchor).length !== 2) throw new Error(`Air Horn support anchor drifted: ${source.split(supportAnchor).length - 1} matches`);
  source = source.replace(supportAnchor, supportReplacement);
}

const defenseAnchor = `    const pending = current.pendingStrike;
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    const aiCard = cardFor(pending.cardId)!;
    let nextPlayer = { ...current.player };`;
const defenseReplacement = `    const pending = current.pendingStrike;
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    const aiCard = cardFor(pending.cardId)!;
    if (defenseCard) {
      const aiAirHorn = firstEventReactionCard(current.ai.hand.map(cardFor).filter((candidate): candidate is CardEntry => Boolean(candidate && isCoreConsumableCard(candidate))), "cancel-reaction") as CardEntry | null;
      if (aiAirHorn) {
        const cancelledPlayer = stage3cConsumeDefenseStatuses(markCompletedTask({
          ...current.player,
          hand: removeOne(current.player.hand, defenseCard.id),
          discard: [...current.player.discard, defenseCard.id],
          xp: current.player.xp + 1,
          defendedThisRound: true,
          playedDefenseSinceLastTurn: true,
          nextDefenseCardBonus: 0,
        }));
        let reactingAi: Board = {
          ...current.ai,
          hand: removeOne(current.ai.hand, aiAirHorn.id),
          playArea: [...current.ai.playArea, aiAirHorn.id],
          usedConsumableThisRound: true,
          reactionItemUsedSinceLastTurn: true,
        };
        reactingAi = returnResolvedConsumable(reactingAi, aiAirHorn);
        const intercepted = write(current, \`${"${aiAirHorn.name}"} cancels ${"${defenseCard.name}"} after it is played but before Guard or printed effects resolve. The incoming Attack continues against standing DEF and Equipment.\`, { player: cancelledPlayer, ai: reactingAi });
        return resolveDefenseState(intercepted, null, prevention, skipOptionalPrompt);
      }
    }
    let nextPlayer = { ...current.player };`;
if (!source.includes(defenseReplacement)) {
  if (source.split(defenseAnchor).length !== 2) throw new Error(`Air Horn defense anchor drifted: ${source.split(defenseAnchor).length - 1} matches`);
  source = source.replace(defenseAnchor, defenseReplacement);
}

await writeFile(path, source);

const test = `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");

test("AI Air Horn cancels a player Reaction Consumable before structured effects resolve and returns both Consumables to supply", () => {
  const playSupport = source.slice(source.indexOf("const playSupport ="), source.indexOf("const useDefensePractice ="));
  const cancellation = playSupport.indexOf("if (aiAirHorn)");
  const applyEffects = playSupport.indexOf("applyCardEffects(supportEntryBoard");
  assert.ok(cancellation >= 0 && applyEffects > cancellation, "Air Horn interception must happen before the target Reaction resolves");
  assert.match(playSupport, /cancelledPlayer = returnResolvedConsumable\\(cancelledPlayer, card\\)/, "cancelled Consumable must follow the canonical supply lifecycle");
  assert.match(playSupport, /reactingAi = returnResolvedConsumable\\(reactingAi, aiAirHorn\\)/, "Air Horn must follow the canonical supply lifecycle");
  const cancellationBlock = playSupport.slice(cancellation, applyEffects);
  assert.doesNotMatch(cancellationBlock, /discard: \\[\.\.\.current\.player\.discard, card\.id\\]/, "cancelled Consumable must not be incorrectly sent to the fighter discard pile");
});

test("AI Air Horn cancels a player Defense before Guard and printed effects resolve, then resumes the strike with no Defense card", () => {
  const start = source.indexOf("const resolveDefenseState =");
  const end = source.indexOf("const resolveDefense =", start);
  const resolveDefenseState = source.slice(start, end);
  const cancellation = resolveDefenseState.indexOf("if (aiAirHorn)");
  const defenseMath = resolveDefenseState.indexOf("const matchingArmor");
  assert.ok(cancellation >= 0 && defenseMath > cancellation, "Air Horn must intercept the played Defense before defense math/effects");
  assert.match(resolveDefenseState, /discard: \\[\.\.\.current\.player\.discard, defenseCard\.id\\]/, "cancelled Defense must still leave the hand and go to its normal discard destination");
  assert.match(resolveDefenseState, /return resolveDefenseState\\(intercepted, null, prevention, skipOptionalPrompt\\)/, "the strike must resume with no Defense card after cancellation");
});
`;
await writeFile("tests/stage3c-air-horn-play-surface.test.mjs", test);
