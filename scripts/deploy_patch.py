from pathlib import Path

root = Path('.')

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label} anchor missing')
    return text.replace(old, new, 1)

resolver_path = root / 'app/effect-resolvers.ts'
resolver = resolver_path.read_text()
resolver = replace_once(resolver, '''  name?: string;\n  subtype?: string;''', '''  name?: string;\n  cardType?: string;\n  subtype?: string;\n  focusValue?: string | number | null;''', 'EffectCardLike choice fields')
if 'export type DeckLookPlan =' not in resolver:
    resolver += r'''

export function mandatoryDiscardChoiceCount(card: EffectCardLike) {
  const text = String(card.rulesText ?? "");
  if (/\bmay\s+discard\b/i.test(text)) return 0;
  const match = text.match(/Draw\s+\d+\s+cards?,\s*then\s+discard\s+(\d+)\s+cards?/i);
  return match ? Number(match[1]) : 0;
}

export function discardChoiceFollowup(source: EffectCardLike, discarded: EffectCardLike) {
  const text = String(source.rulesText ?? "");
  let focus = 0;
  let nextAttackPower = 0;
  let nextDefenseGuard = 0;
  const notes: string[] = [];

  const zeroFocus = text.match(/If you discarded a card with Focus Value 0, gain (\d+) Focus/i);
  if (zeroFocus && Number(discarded.focusValue ?? 0) === 0) {
    focus += Number(zeroFocus[1]);
    notes.push(`Focus Value 0: +${zeroFocus[1]} Focus`);
  }
  const technique = text.match(/If you discarded a Technique, your next Attack this turn gets \+(\d+) Attack Power/i);
  if (technique && String(discarded.cardType ?? '').toLocaleLowerCase() === 'technique') {
    nextAttackPower += Number(technique[1]);
    notes.push(`Technique discarded: next Attack +${technique[1]} Attack Power`);
  }
  const item = text.match(/If you discarded an Item, your next Defense this round gets \+(\d+) Guard/i);
  if (item && String(discarded.cardType ?? '').toLocaleLowerCase() === 'item') {
    nextDefenseGuard += Number(item[1]);
    notes.push(`Item discarded: next Defense +${item[1]} Guard`);
  }
  return { focus, nextAttackPower, nextDefenseGuard, notes };
}

export type DeckLookPlan =
  | { kind: 'pick-discard'; count: number; filter: 'defense-or-kata'; optional: false; noMatchFocus: number }
  | { kind: 'reorder'; count: number; distinctTypeFocus: number }
  | { kind: 'pick-reorder'; count: number; filter: 'technique'; optional: false }
  | { kind: 'pick-shuffle'; count: number; filter: 'item'; optional: true };

export function deckLookPlan(card: EffectCardLike): DeckLookPlan | null {
  const text = String(card.rulesText ?? '').replace(/\s+/g, ' ').trim();
  let match = text.match(/Look at the top (\d+) cards? of your deck\. Put one Defense or Kata into your hand and discard the rest\. If you found neither, gain (\d+) Focus/i);
  if (match) return { kind: 'pick-discard', count: Number(match[1]), filter: 'defense-or-kata', optional: false, noMatchFocus: Number(match[2]) };

  match = text.match(/Look at the top (\d+) cards? of your deck and put them back in any order\. If they contain three different card types, gain (\d+) Focus/i);
  if (match) return { kind: 'reorder', count: Number(match[1]), distinctTypeFocus: Number(match[2]) };

  match = text.match(/Look at the top (\d+) cards? of your deck\. Put 1 Technique into your hand; return the rest in any order/i);
  if (match) return { kind: 'pick-reorder', count: Number(match[1]), filter: 'technique', optional: false };

  match = text.match(/Look at the top (\d+) cards? of your deck\. You may reveal an Item and put it into your hand\. Shuffle the rest/i);
  if (match) return { kind: 'pick-shuffle', count: Number(match[1]), filter: 'item', optional: true };

  match = text.match(/Look at the top (\d+) cards? of your deck\. Put them back in either order\. If they have different card types, gain (\d+) Focus/i);
  if (match) return { kind: 'reorder', count: Number(match[1]), distinctTypeFocus: Number(match[2]) };
  return null;
}
'''
resolver_path.write_text(resolver)

playtest_path = root / 'app/playtest.tsx'
playtest = playtest_path.read_text()
old_import = 'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, attackPiercing, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor } from "./effect-resolvers";'
new_import = 'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, attackPiercing, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, deckLookPlan, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, discardChoiceFollowup, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, mandatoryDiscardChoiceCount, optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor, type DeckLookPlan } from "./effect-resolvers";'
playtest = replace_once(playtest, old_import, new_import, 'playtest deck-choice import')
old_choice = '''type PendingChoice =\n  | { kind: "destroy-junk"; sourceCardId: string; remaining: number }\n  | { kind: "discard-draw"; sourceCardId: string; remaining: number; draw: number };'''
new_choice = '''type PendingChoice =\n  | { kind: "destroy-junk"; sourceCardId: string; remaining: number }\n  | { kind: "discard-draw"; sourceCardId: string; remaining: number; draw: number }\n  | { kind: "discard-hand"; sourceCardId: string; remaining: number }\n  | { kind: "deck-pick"; sourceCardId: string; revealed: string[]; filter: "defense-or-kata" | "technique" | "item"; optional: boolean; restAction: "discard" | "reorder" | "shuffle" }\n  | { kind: "deck-order"; sourceCardId: string; revealed: string[]; ordered: string[]; bonusFocus: number };'''
playtest = replace_once(playtest, old_choice, new_choice, 'PendingChoice deck union')

# Player on-play discards are always explicit choices. AI retains its deterministic heuristic.
playtest = replace_once(playtest, '''    if (effect.kind === "discard" && next.hand.length) {\n      if (owner === "player" && timing === "onPlay" && card.name === "Morning-Shift Meditation") continue;''', '''    if (effect.kind === "discard" && next.hand.length) {\n      if (owner === "player" && timing === "onPlay") continue;''', 'generic player discard guard')

# Add reusable deck-look state transitions immediately after drawCards.
draw_anchor = '''function fighterStat(board: Board, stat: "ATK" | "DEF" | "Speed") {'''
helpers = r'''
function cardMatchesDeckFilter(card: CardEntry | undefined, filter: "defense-or-kata" | "technique" | "item") {
  if (!card) return false;
  if (filter === "defense-or-kata") return isDefense(card) || isKata(card);
  if (filter === "technique") return card.cardType.toLocaleLowerCase() === "technique";
  return card.cardType.toLocaleLowerCase() === "item";
}

function revealDeckTop(board: Board, count: number) {
  const take = Math.min(Math.max(0, count), board.deck.length);
  const revealed = take ? board.deck.slice(-take).reverse() : [];
  return { board: { ...board, deck: take ? board.deck.slice(0, -take) : board.deck }, revealed };
}

function deckOrderFocusBonus(revealed: string[], plan: Extract<DeckLookPlan, { kind: "reorder" }>) {
  if (revealed.length !== plan.count) return 0;
  const types = new Set(revealed.map((id) => cardFor(id)?.cardType ?? "Unknown"));
  return types.size === revealed.length ? plan.distinctTypeFocus : 0;
}

function beginPlayerDeckLook(board: Board, source: CardEntry) {
  const plan = deckLookPlan(source);
  if (!plan || !board.deck.length) return { board, pendingChoice: null as PendingChoice | null, note: "" };
  const revealedState = revealDeckTop(board, plan.count);
  let next = revealedState.board;
  const revealed = revealedState.revealed;
  if (!revealed.length) return { board, pendingChoice: null as PendingChoice | null, note: "" };

  if (plan.kind === "reorder") {
    return {
      board: next,
      pendingChoice: { kind: "deck-order", sourceCardId: source.id, revealed, ordered: [], bonusFocus: deckOrderFocusBonus(revealed, plan) } as PendingChoice,
      note: `Looked at ${revealed.length} card${revealed.length === 1 ? "" : "s"}. Choose their future draw order.`,
    };
  }

  const eligible = revealed.filter((id) => cardMatchesDeckFilter(cardFor(id), plan.filter));
  if (!eligible.length) {
    if (plan.kind === "pick-discard") {
      next = { ...next, discard: [...next.discard, ...revealed], focus: next.focus + plan.noMatchFocus };
      return { board: next, pendingChoice: null as PendingChoice | null, note: `No Defense or Kata found; all revealed cards were discarded and +${plan.noMatchFocus} Focus applied.` };
    }
    if (plan.kind === "pick-reorder") {
      return { board: next, pendingChoice: { kind: "deck-order", sourceCardId: source.id, revealed, ordered: [], bonusFocus: 0 } as PendingChoice, note: "No Technique found. Return the revealed cards in the order you choose." };
    }
    next = { ...next, deck: shuffle([...next.deck, ...revealed]) };
    return { board: next, pendingChoice: null as PendingChoice | null, note: "No Item found; the revealed cards were shuffled back into your deck." };
  }

  const restAction = plan.kind === "pick-discard" ? "discard" : plan.kind === "pick-reorder" ? "reorder" : "shuffle";
  return {
    board: next,
    pendingChoice: { kind: "deck-pick", sourceCardId: source.id, revealed, filter: plan.filter, optional: plan.optional, restAction } as PendingChoice,
    note: `Looked at ${revealed.length} card${revealed.length === 1 ? "" : "s"}. Choose ${plan.optional ? "an eligible card or skip" : "the card to keep"}.`,
  };
}

function resolveAiDeckLook(board: Board, source: CardEntry) {
  const plan = deckLookPlan(source);
  if (!plan || !board.deck.length) return board;
  const revealedState = revealDeckTop(board, plan.count);
  let next = revealedState.board;
  const revealed = revealedState.revealed;
  if (!revealed.length) return board;

  if (plan.kind === "reorder") {
    const ordered = [...revealed].sort((left, right) => cardCost(cardFor(right)) - cardCost(cardFor(left)));
    return { ...next, deck: [...next.deck, ...ordered.reverse()], focus: next.focus + deckOrderFocusBonus(revealed, plan) };
  }

  const eligible = revealed.filter((id) => cardMatchesDeckFilter(cardFor(id), plan.filter)).sort((left, right) => cardCost(cardFor(right)) - cardCost(cardFor(left)));
  const selected = eligible[0];
  if (!selected) {
    if (plan.kind === "pick-discard") return { ...next, discard: [...next.discard, ...revealed], focus: next.focus + plan.noMatchFocus };
    if (plan.kind === "pick-reorder") return { ...next, deck: [...next.deck, ...revealed.reverse()] };
    return { ...next, deck: shuffle([...next.deck, ...revealed]) };
  }
  const rest = removeOne(revealed, selected);
  if (plan.kind === "pick-discard") return { ...next, hand: [...next.hand, selected], discard: [...next.discard, ...rest] };
  if (plan.kind === "pick-reorder") return { ...next, hand: [...next.hand, selected], deck: [...next.deck, ...rest.reverse()] };
  return { ...next, hand: [...next.hand, selected], deck: shuffle([...next.deck, ...rest]) };
}

'''
if 'function beginPlayerDeckLook(' not in playtest:
    playtest = replace_once(playtest, draw_anchor, helpers + draw_anchor, 'deck look helper insertion')

# Support play now queues mandatory discard choices and deck decisions.
old_support = '''    const destroyedAfterUse = destroysAfterUse(card);\n    if (destroyedAfterUse) nextPlayer = destroyResolvedConsumable(nextPlayer, card);\n    const pendingDiscard = card.name === "Morning-Shift Meditation" && nextPlayer.hand.length ? { sourceCardId: id, remaining: 1 } : null;\n    const junkCount = destroyJunkChoiceCount(card);\n    const hasJunk = [...nextPlayer.hand, ...nextPlayer.discard].some((candidate) => isJunk(cardFor(candidate)));\n    const pendingChoice: PendingChoice | null = !pendingDiscard && junkCount && hasJunk ? { kind: "destroy-junk", sourceCardId: id, remaining: junkCount } : null;\n    const defensePenalty = targetNextDefensePenalty(card);\n    const nextAi = defensePenalty ? { ...current.ai, nextDefenseCardBonus: (current.ai.nextDefenseCardBonus ?? 0) - defensePenalty } : current.ai;\n    return write(current, `${card.name} played. ${pendingDiscard ? "Draw 1 card, then choose a card to discard." : pendingChoice ? `Choose ${junkCount} Junk card${junkCount === 1 ? "" : "s"} from your hand or discard pile to destroy.` : cardEffectNote(card)}${destroyedAfterUse ? " Destroyed after use; it will not enter your discard pile." : ""}${locationModifier.notes.length ? ` ${locationModifier.notes.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, pendingDiscard, pendingChoice });'''
new_support = '''    const destroyedAfterUse = destroysAfterUse(card);\n    if (destroyedAfterUse) nextPlayer = destroyResolvedConsumable(nextPlayer, card);\n    const pendingDiscard = null;\n    const junkCount = destroyJunkChoiceCount(card);\n    const mandatoryDiscard = mandatoryDiscardChoiceCount(card);\n    const hasJunk = [...nextPlayer.hand, ...nextPlayer.discard].some((candidate) => isJunk(cardFor(candidate)));\n    let pendingChoice: PendingChoice | null = junkCount && hasJunk\n      ? { kind: "destroy-junk", sourceCardId: id, remaining: junkCount }\n      : mandatoryDiscard && nextPlayer.hand.length\n        ? { kind: "discard-hand", sourceCardId: id, remaining: Math.min(mandatoryDiscard, nextPlayer.hand.length) }\n        : null;\n    let deckNote = "";\n    if (!pendingChoice && deckLookPlan(card)) {\n      const deckChoice = beginPlayerDeckLook(nextPlayer, card);\n      nextPlayer = deckChoice.board;\n      pendingChoice = deckChoice.pendingChoice;\n      deckNote = deckChoice.note;\n    }\n    const defensePenalty = targetNextDefensePenalty(card);\n    const nextAi = defensePenalty ? { ...current.ai, nextDefenseCardBonus: (current.ai.nextDefenseCardBonus ?? 0) - defensePenalty } : current.ai;\n    const choiceNote = pendingChoice?.kind === "destroy-junk" ? `Choose ${junkCount} Junk card${junkCount === 1 ? "" : "s"} from your hand or discard pile to destroy.` : pendingChoice?.kind === "discard-hand" ? `Choose ${pendingChoice.remaining} card${pendingChoice.remaining === 1 ? "" : "s"} from your hand to discard.` : deckNote || cardEffectNote(card);\n    return write(current, `${card.name} played. ${choiceNote}${destroyedAfterUse ? " Destroyed after use; it will not enter your discard pile." : ""}${locationModifier.notes.length ? ` ${locationModifier.notes.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, pendingDiscard, pendingChoice });'''
playtest = replace_once(playtest, old_support, new_support, 'playSupport choice expansion')

# Refactor explicit choice resolver to support hand and revealed-deck decisions.
old_resolver_head = '''  const resolvePendingChoice = (cardId: string, source: "hand" | "discard" = "hand") => setMatch((current) => {\n    const choice = current?.pendingChoice;\n    if (!current || !choice) return current;\n    const selected = cardFor(cardId);\n    const sourceCards = source === "hand" ? current.player.hand : current.player.discard;\n    if (!selected || !sourceCards.includes(cardId)) return current;'''
new_resolver_head = '''  const resolvePendingChoice = (cardId: string, source: "hand" | "discard" | "deck" = "hand") => setMatch((current) => {\n    const choice = current?.pendingChoice;\n    if (!current || !choice) return current;\n    const selected = cardFor(cardId);\n    if (!selected) return current;'''
playtest = replace_once(playtest, old_resolver_head, new_resolver_head, 'resolvePendingChoice head')
# Add source validation specifically to Junk branch.
playtest = replace_once(playtest, '''    if (choice.kind === "destroy-junk") {\n      if (!isJunk(selected)) return current;''', '''    if (choice.kind === "destroy-junk") {\n      const sourceCards = source === "discard" ? current.player.discard : current.player.hand;\n      if (!sourceCards.includes(cardId) || !isJunk(selected)) return current;''', 'destroy junk source validation')
# Add mandatory discard and deck branches before legacy discard-draw.
branch_anchor = '''    if (choice.kind === "discard-draw") {'''
branches = r'''    if (choice.kind === "discard-hand") {
      if (!current.player.hand.includes(cardId)) return current;
      const sourceCard = cardFor(choice.sourceCardId);
      const followup = sourceCard ? discardChoiceFollowup(sourceCard, selected) : { focus: 0, nextAttackPower: 0, nextDefenseGuard: 0, notes: [] as string[] };
      const player = {
        ...current.player,
        hand: removeOne(current.player.hand, cardId),
        discard: [...current.player.discard, cardId],
        focus: current.player.focus + followup.focus,
        nextAttackBonus: current.player.nextAttackBonus + followup.nextAttackPower,
        nextDefenseCardBonus: (current.player.nextDefenseCardBonus ?? 0) + followup.nextDefenseGuard,
      };
      const remaining = choice.remaining - 1;
      const pendingChoice = remaining > 0 && player.hand.length ? { ...choice, remaining } : null;
      return write(current, `${selected.name} discarded for ${sourceCard?.name ?? "the printed effect"}.${followup.notes.length ? ` ${followup.notes.join("; ")}.` : ""}${pendingChoice ? ` Choose ${remaining} more.` : " Choice resolved."}`, { player, pendingChoice });
    }

    if (choice.kind === "deck-pick") {
      if (source !== "deck" || !choice.revealed.includes(cardId) || !cardMatchesDeckFilter(selected, choice.filter)) return current;
      const rest = removeOne(choice.revealed, cardId);
      let player: Board = { ...current.player, hand: [...current.player.hand, cardId] };
      let pendingChoice: PendingChoice | null = null;
      if (choice.restAction === "discard") player = { ...player, discard: [...player.discard, ...rest] };
      if (choice.restAction === "shuffle") player = { ...player, deck: shuffle([...player.deck, ...rest]) };
      if (choice.restAction === "reorder" && rest.length) pendingChoice = { kind: "deck-order", sourceCardId: choice.sourceCardId, revealed: rest, ordered: [], bonusFocus: 0 };
      return write(current, `${selected.name} moved from the revealed cards to your hand.${pendingChoice ? " Now choose the order for the remaining revealed cards." : choice.restAction === "discard" ? " The rest were discarded." : choice.restAction === "shuffle" ? " The rest were shuffled back." : ""}`, { player, pendingChoice });
    }

    if (choice.kind === "deck-order") {
      if (source !== "deck" || !choice.revealed.includes(cardId) || choice.ordered.includes(cardId) && choice.revealed.filter((id) => id === cardId).length <= choice.ordered.filter((id) => id === cardId).length) return current;
      const remainingRevealed = removeOne(choice.revealed, cardId);
      const ordered = [...choice.ordered, cardId];
      if (remainingRevealed.length) {
        return write(current, `${selected.name} filed as draw position ${ordered.length}. Choose the next card.`, { pendingChoice: { ...choice, revealed: remainingRevealed, ordered } });
      }
      const player = { ...current.player, deck: [...current.player.deck, ...ordered.slice().reverse()], focus: current.player.focus + choice.bonusFocus };
      return write(current, `Deck order certified: ${ordered.map((id) => cardFor(id)?.name ?? "Unknown").join(" → ")}.${choice.bonusFocus ? ` Different card types grant +${choice.bonusFocus} Focus.` : ""}`, { player, pendingChoice: null });
    }

'''
playtest = replace_once(playtest, branch_anchor, branches + branch_anchor, 'deck choice resolver branches')

# Optional Item lookup uses the same skip action; legacy discard/draw remains optional too.
old_skip = '''  const skipPendingChoice = () => setMatch((current) => {\n    if (!current?.pendingChoice || current.pendingChoice.kind !== "discard-draw") return current;\n    return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: discard/draw declined.`, { pendingChoice: null });\n  });'''
new_skip = '''  const skipPendingChoice = () => setMatch((current) => {\n    if (!current?.pendingChoice) return current;\n    if (current.pendingChoice.kind === "discard-draw") return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: discard/draw declined.`, { pendingChoice: null });\n    if (current.pendingChoice.kind === "deck-pick" && current.pendingChoice.optional) {\n      const player = { ...current.player, deck: shuffle([...current.player.deck, ...current.pendingChoice.revealed]) };\n      return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional search"}: no card taken; revealed cards shuffled back.`, { player, pendingChoice: null });\n    }\n    return current;\n  });'''
playtest = replace_once(playtest, old_skip, new_skip, 'skip deck choice')

# AI resolves these deck effects instead of ignoring them.
old_ai_support = '''    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], focus: nextAi.focus + locationModifier.value }, card, "ai");\n    if (destroysAfterUse(card)) nextAi = destroyResolvedConsumable(nextAi, card);'''
new_ai_support = '''    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], focus: nextAi.focus + locationModifier.value }, card, "ai");\n    nextAi = resolveAiDeckLook(nextAi, card);\n    if (destroysAfterUse(card)) nextAi = destroyResolvedConsumable(nextAi, card);'''
playtest = replace_once(playtest, old_ai_support, new_ai_support, 'AI deck look resolution')

# Expand render-time option generation for hand and revealed-deck choices.
old_options = '''  const pendingChoiceOptions = match.pendingChoice?.kind === "destroy-junk"\n    ? [\n        ...player.hand.map((id, index) => ({ id, source: "hand" as const, index })).filter((entry) => isJunk(cardFor(entry.id))),\n        ...player.discard.map((id, index) => ({ id, source: "discard" as const, index })).filter((entry) => isJunk(cardFor(entry.id))),\n      ]\n    : match.pendingChoice?.kind === "discard-draw"\n      ? player.hand.map((id, index) => ({ id, source: "hand" as const, index }))\n      : [];'''
new_options = '''  const pendingChoiceOptions = match.pendingChoice?.kind === "destroy-junk"\n    ? [\n        ...player.hand.map((id, index) => ({ id, source: "hand" as const, index })).filter((entry) => isJunk(cardFor(entry.id))),\n        ...player.discard.map((id, index) => ({ id, source: "discard" as const, index })).filter((entry) => isJunk(cardFor(entry.id))),\n      ]\n    : match.pendingChoice?.kind === "discard-draw" || match.pendingChoice?.kind === "discard-hand"\n      ? player.hand.map((id, index) => ({ id, source: "hand" as const, index }))\n      : match.pendingChoice?.kind === "deck-pick"\n        ? match.pendingChoice.revealed.map((id, index) => ({ id, source: "deck" as const, index })).filter((entry) => cardMatchesDeckFilter(cardFor(entry.id), match.pendingChoice!.kind === "deck-pick" ? match.pendingChoice!.filter : "item"))\n        : match.pendingChoice?.kind === "deck-order"\n          ? match.pendingChoice.revealed.map((id, index) => ({ id, source: "deck" as const, index }))\n          : [];\n  const effectChoiceTitle = match.pendingChoice?.kind === "destroy-junk" ? "Choose Junk to destroy"\n    : match.pendingChoice?.kind === "discard-draw" ? "Discard to draw?"\n      : match.pendingChoice?.kind === "discard-hand" ? "Choose what to discard"\n        : match.pendingChoice?.kind === "deck-pick" ? "Choose from the revealed cards"\n          : match.pendingChoice?.kind === "deck-order" ? "Set your draw order" : "Resolve printed effect";\n  const effectChoicePrompt = match.pendingChoice?.kind === "destroy-junk" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} requires ${match.pendingChoice.remaining} more Junk card${match.pendingChoice.remaining === 1 ? "" : "s"} from your hand or discard pile.`\n    : match.pendingChoice?.kind === "discard-draw" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Attack"} lets you discard ${match.pendingChoice.remaining} card${match.pendingChoice.remaining === 1 ? "" : "s"} to draw ${match.pendingChoice.draw}. You may decline.`\n      : match.pendingChoice?.kind === "discard-hand" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} requires ${match.pendingChoice.remaining} more discard${match.pendingChoice.remaining === 1 ? "" : "s"}. You choose the card.`\n        : match.pendingChoice?.kind === "deck-pick" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} revealed ${match.pendingChoice.revealed.length} card${match.pendingChoice.revealed.length === 1 ? "" : "s"}. ${match.pendingChoice.optional ? "Take an eligible card or skip." : "Choose the eligible card to put into your hand."}`\n          : match.pendingChoice?.kind === "deck-order" ? `Choose the card you want to draw ${match.pendingChoice.ordered.length ? `in position ${match.pendingChoice.ordered.length + 1}` : "first"}. ${match.pendingChoice.revealed.length} card${match.pendingChoice.revealed.length === 1 ? " remains" : "s remain"}.` : "Resolve the printed effect.";\n  const effectChoiceCanSkip = match.pendingChoice?.kind === "discard-draw" || (match.pendingChoice?.kind === "deck-pick" && match.pendingChoice.optional);'''
playtest = replace_once(playtest, old_options, new_options, 'pendingChoice render options')

# Replace choice modal copy with generic labels for all choice kinds.
old_modal = '''    {match.pendingChoice && <div className="playtest-inspector-backdrop effect-choice-backdrop"><section className="effect-choice-dialog paper-stack" role="dialog" aria-modal="true" aria-labelledby="effect-choice-title"><span className="eyebrow">Printed effect · your decision</span><h2 id="effect-choice-title">{match.pendingChoice.kind === "destroy-junk" ? "Choose Junk to destroy" : "Discard to draw?"}</h2><p>{match.pendingChoice.kind === "destroy-junk" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} requires ${match.pendingChoice.remaining} more Junk card${match.pendingChoice.remaining === 1 ? "" : "s"} from your hand or discard pile.` : `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Attack"} lets you discard ${match.pendingChoice.remaining} card${match.pendingChoice.remaining === 1 ? "" : "s"} to draw ${match.pendingChoice.draw}. You may decline.`}</p><div className="effect-choice-options">{pendingChoiceOptions.map((entry) => { const option = cardFor(entry.id); if (!option) return null; return <button type="button" onClick={() => resolvePendingChoice(entry.id, entry.source)} key={`${entry.source}-${entry.id}-${entry.index}`}><span>{entry.source === "discard" ? "DISCARD PILE" : "HAND"}</span><b>{option.name}</b><small>{option.catalogId} · {option.subtype || option.cardType}</small></button>; })}</div>{match.pendingChoice.kind === "discard-draw" && <footer><button className="button ghost" onClick={skipPendingChoice}>Skip this optional effect</button></footer>}</section></div>}'''
new_modal = '''    {match.pendingChoice && <div className="playtest-inspector-backdrop effect-choice-backdrop"><section className="effect-choice-dialog paper-stack" role="dialog" aria-modal="true" aria-labelledby="effect-choice-title"><span className="eyebrow">Printed effect · your decision</span><h2 id="effect-choice-title">{effectChoiceTitle}</h2><p>{effectChoicePrompt}</p><div className="effect-choice-options">{pendingChoiceOptions.map((entry) => { const option = cardFor(entry.id); if (!option) return null; return <button type="button" onClick={() => resolvePendingChoice(entry.id, entry.source)} key={`${entry.source}-${entry.id}-${entry.index}`}><span>{entry.source === "discard" ? "DISCARD PILE" : entry.source === "deck" ? "REVEALED" : "HAND"}</span><b>{option.name}</b><small>{option.catalogId} · {option.subtype || option.cardType}</small></button>; })}</div>{effectChoiceCanSkip && <footer><button className="button ghost" onClick={skipPendingChoice}>Skip this optional effect</button></footer>}</section></div>}'''
playtest = replace_once(playtest, old_modal, new_modal, 'generic effect-choice modal')
playtest_path.write_text(playtest)

# Resolver tests for the newly supported language.
test_path = root / 'tests/effect-resolvers.test.mjs'
test_text = test_path.read_text()
old_test_import = test_text.split('\n', 2)[1]
if 'deckLookPlan' not in old_test_import:
    old_line = 'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, attackPiercing, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor } from "../app/effect-resolvers.ts";'
    new_line = 'import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, attackPiercing, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, deckLookPlan, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, discardChoiceFollowup, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, mandatoryDiscardChoiceCount, optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor } from "../app/effect-resolvers.ts";'
    test_text = replace_once(test_text, old_line, new_line, 'effect resolver test imports')
test_text += r'''

test("mandatory draw-discard effects pause for a player choice and apply typed followups", () => {
  assert.equal(mandatoryDiscardChoiceCount({ rulesText: "Draw 1 card, then discard 1 card." }), 1);
  assert.equal(mandatoryDiscardChoiceCount({ rulesText: "You may discard 1 card to draw 1 card." }), 0);
  const huddle = { rulesText: "Draw 1 card, then discard 1 card. If you discarded a Technique, your next Attack this turn gets +1 Attack Power. If you discarded an Item, your next Defense this round gets +1 Guard." };
  assert.equal(discardChoiceFollowup(huddle, { cardType: "Technique" }).nextAttackPower, 1);
  assert.equal(discardChoiceFollowup(huddle, { cardType: "Item" }).nextDefenseGuard, 1);
  assert.equal(discardChoiceFollowup({ rulesText: "If you discarded a card with Focus Value 0, gain 1 Focus." }, { focusValue: 0 }).focus, 1);
});

test("top-deck look/search/reorder patterns compile into explicit plans", () => {
  assert.deepEqual(deckLookPlan({ rulesText: "Look at the top 3 cards of your deck. Put one Defense or Kata into your hand and discard the rest. If you found neither, gain 1 Focus." }), { kind: "pick-discard", count: 3, filter: "defense-or-kata", optional: false, noMatchFocus: 1 });
  assert.deepEqual(deckLookPlan({ rulesText: "Look at the top 3 cards of your deck and put them back in any order. If they contain three different card types, gain 1 Focus." }), { kind: "reorder", count: 3, distinctTypeFocus: 1 });
  assert.deepEqual(deckLookPlan({ rulesText: "Look at the top 3 cards of your deck. Put 1 Technique into your hand; return the rest in any order." }), { kind: "pick-reorder", count: 3, filter: "technique", optional: false });
  assert.deepEqual(deckLookPlan({ rulesText: "Look at the top 5 cards of your deck. You may reveal an Item and put it into your hand. Shuffle the rest." }), { kind: "pick-shuffle", count: 5, filter: "item", optional: true });
  assert.deepEqual(deckLookPlan({ rulesText: "Look at the top 2 cards of your deck. Put them back in either order. If they have different card types, gain 1 Focus." }), { kind: "reorder", count: 2, distinctTypeFocus: 1 });
});
'''
test_path.write_text(test_text)

integration_path = root / 'tests/playtest-effect-integration.test.mjs'
integration = integration_path.read_text()
integration += r'''

test("Quick Duel gives the player control of mandatory discards and top-deck decisions", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /kind: "discard-hand"/);
  assert.match(source, /kind: "deck-pick"/);
  assert.match(source, /kind: "deck-order"/);
  assert.match(source, /mandatoryDiscardChoiceCount/);
  assert.match(source, /discardChoiceFollowup/);
  assert.match(source, /beginPlayerDeckLook/);
  assert.match(source, /resolveAiDeckLook/);
  assert.match(source, /Choose what to discard/);
  assert.match(source, /Set your draw order/);
});
'''
integration_path.write_text(integration)

(root / 'scripts/deploy_patch_message.txt').write_text('Automate hand discard and top-deck choice effects\n')
