from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


playtest_path = Path("app/playtest.tsx")
text = playtest_path.read_text()

old = 'import { characterAllowedAttackZones, characterAttackModifier, characterCanEquip, characterDamageReduction, type CharacterRuntimeChoice, type CharacterRuntimeEvent } from "./character-runtime";\n'
new = old + 'import { commitQuickDuelCharacterPurchase, previewQuickDuelCharacterPurchasePrice } from "./quick-duel-character-purchase-host";\n'
text = replace_once(text, old, new, "purchase host import")

old = '''function marketPriceFor(board: Board, card: CardEntry | undefined) {
  if (!card) return Number.POSITIVE_INFINITY;
  const certificationDiscount = beltHasReward(board, "market-discount") && !board.boughtCardThisAscend ? 1 : 0;
  const printedCost = cardCost(card);
  const qualified = qualifiedNextPurchaseDiscount(board.stage3cStatuses, printedCost);
  const base = printedCost + (board.stage3cPurchaseCostModifier ?? 0) + (card.cardType === "Item" ? (board.nextItemCostPenalty ?? 0) : 0) - certificationDiscount + qualified.amount;
  return Math.max(qualified.minimumFinalCost || 0, base, 0);
}
'''
new = '''function marketBasePriceFor(board: Board, card: CardEntry | undefined) {
  if (!card) return Number.POSITIVE_INFINITY;
  const certificationDiscount = beltHasReward(board, "market-discount") && !board.boughtCardThisAscend ? 1 : 0;
  const printedCost = cardCost(card);
  const qualified = qualifiedNextPurchaseDiscount(board.stage3cStatuses, printedCost);
  const base = printedCost + (board.stage3cPurchaseCostModifier ?? 0) + (card.cardType === "Item" ? (board.nextItemCostPenalty ?? 0) : 0) - certificationDiscount + qualified.amount;
  return Math.max(qualified.minimumFinalCost || 0, base, 0);
}
function marketPriceFor(board: Board, card: CardEntry | undefined) {
  if (!card) return Number.POSITIVE_INFINITY;
  return previewQuickDuelCharacterPurchasePrice(board, marketBasePriceFor(board, card));
}
'''
text = replace_once(text, old, new, "market pricing composition")

old = '''    const price = marketPriceFor(current.player, revealed);
    if (buy && marketFocusAvailable(current.player, revealed) >= price) {
      const focusBefore = current.player.focus;
      let player: Board = spendMarketFocus(current.player, revealed, price);
      player = stage3cConsumePurchase(markCompletedTask({ ...player, discard: [...player.discard, revealed.id], purchasedTypes: [...player.purchasedTypes, revealed.cardType], cardsBought: player.cardsBought + 1, boughtCardThisAscend: true }), revealed);
      return write(current, `Dojo Raffle Ticket purchase: ${revealed.name} for ${price} Focus (${focusBefore} → ${player.focus}).`, { player, pendingChoice: null, marketPurchasedThisRound: true });
    }
'''
new = '''    const basePrice = marketBasePriceFor(current.player, revealed);
    const price = previewQuickDuelCharacterPurchasePrice(current.player, basePrice);
    if (buy && marketFocusAvailable(current.player, revealed) >= price) {
      const focusBefore = current.player.focus;
      const characterPurchase = commitQuickDuelCharacterPurchase(current.player, current.ai, revealed, basePrice, "player");
      let player: Board = spendMarketFocus(characterPurchase.self, revealed, characterPurchase.price);
      player = stage3cConsumePurchase(markCompletedTask({ ...player, discard: [...player.discard, revealed.id], purchasedTypes: [...player.purchasedTypes, revealed.cardType], cardsBought: player.cardsBought + 1, boughtCardThisAscend: true }), revealed);
      return write(current, `Dojo Raffle Ticket purchase: ${revealed.name} for ${characterPurchase.price} Focus (${focusBefore} → ${player.focus}).`, { player, ai: characterPurchase.opponent, pendingChoice: null, marketPurchasedThisRound: true });
    }
'''
text = replace_once(text, old, new, "raffle purchase commit")

old = '''    const card = cardFor(id);
    const slot = current.market.indexOf(id);
    const price = marketPriceFor(current.player, card);
    if (!card || slot < 0 || marketFocusAvailable(current.player, card) < price) return current;
    const focusBefore = current.player.focus;
    let nextPlayer: Board = spendMarketFocus(current.player, card, price);
    nextPlayer = stage3cConsumePurchase(markCompletedTask({ ...nextPlayer, discard: [...nextPlayer.discard, id], purchasedTypes: [...nextPlayer.purchasedTypes, card.cardType], cardsBought: nextPlayer.cardsBought + 1, boughtCardThisAscend: true, nextItemCostPenalty: card.cardType === "Item" ? 0 : nextPlayer.nextItemCostPenalty }), card);
    const refilled = refillPurchasedMarketSlot(current.market, current.marketDeck, current.marketDiscard, slot);
    const purchased = write(current, `Bought ${card.name} for ${price} Focus (${focusBefore} → ${nextPlayer.focus}). The top Market card immediately fills the slot.`, { player: nextPlayer, ...refilled, marketPurchasedThisRound: true });
'''
new = '''    const card = cardFor(id);
    const slot = current.market.indexOf(id);
    if (!card || slot < 0) return current;
    const basePrice = marketBasePriceFor(current.player, card);
    const price = previewQuickDuelCharacterPurchasePrice(current.player, basePrice);
    if (marketFocusAvailable(current.player, card) < price) return current;
    const focusBefore = current.player.focus;
    const characterPurchase = commitQuickDuelCharacterPurchase(current.player, current.ai, card, basePrice, "player");
    let nextPlayer: Board = spendMarketFocus(characterPurchase.self, card, characterPurchase.price);
    nextPlayer = stage3cConsumePurchase(markCompletedTask({ ...nextPlayer, discard: [...nextPlayer.discard, id], purchasedTypes: [...nextPlayer.purchasedTypes, card.cardType], cardsBought: nextPlayer.cardsBought + 1, boughtCardThisAscend: true, nextItemCostPenalty: card.cardType === "Item" ? 0 : nextPlayer.nextItemCostPenalty }), card);
    const refilled = refillPurchasedMarketSlot(current.market, current.marketDeck, current.marketDiscard, slot);
    const purchased = write(current, `Bought ${card.name} for ${characterPurchase.price} Focus (${focusBefore} → ${nextPlayer.focus}). The top Market card immediately fills the slot.`, { player: nextPlayer, ai: characterPurchase.opponent, ...refilled, marketPurchasedThisRound: true });
'''
text = replace_once(text, old, new, "player Market purchase commit")

old = '''  const affordableNow = match.market.filter((id) => cardFor(id) && cardCost(cardFor(id)) <= player.focus).length;
'''
new = '''  const affordableNow = match.market.filter((id) => {
    const card = cardFor(id);
    return Boolean(card && marketFocusAvailable(player, card) >= marketPriceFor(player, card));
  }).length;
'''
text = replace_once(text, old, new, "Market affordability count")

old = '''            <div className="ascend-market-grid">{match.market.map((id) => { const card = cardFor(id); if (!card) return null; const affordable = player.focus >= cardCost(card); return <PlayCard key={id} card={card} selected={match.phase === "player-ascend" && affordable} disabled={match.phase !== "player-ascend" || !affordable} onClick={() => buyMarket(id)} onInspect={() => setInspectedId(id)} />; })}</div>
'''
new = '''            <div className="ascend-market-grid">{match.market.map((id) => { const card = cardFor(id); if (!card) return null; const affordable = marketFocusAvailable(player, card) >= marketPriceFor(player, card); return <PlayCard key={id} card={card} selected={match.phase === "player-ascend" && affordable} disabled={match.phase !== "player-ascend" || !affordable} onClick={() => buyMarket(id)} onInspect={() => setInspectedId(id)} />; })}</div>
'''
text = replace_once(text, old, new, "Market card affordability UI")

old = '''  const aiPurchase = current.market.filter((id) => marketPriceFor(current.ai, cardFor(id)) <= marketFocusAvailable(current.ai, cardFor(id))).sort((left, right) => aiMarketScore(cardFor(right)!, current.ai) - aiMarketScore(cardFor(left)!, current.ai))[0];
  const purchasedCard = aiPurchase ? cardFor(aiPurchase) : null;
  let aiAfterPurchase = purchasedCard ? stage3cConsumePurchase(markCompletedTask({ ...spendMarketFocus(current.ai, purchasedCard, marketPriceFor(current.ai, purchasedCard)), discard: [...current.ai.discard, purchasedCard.id], purchasedTypes: [...current.ai.purchasedTypes, purchasedCard.cardType], cardsBought: current.ai.cardsBought + 1 }), purchasedCard) : current.ai;
'''
new = '''  const aiPurchase = current.market.filter((id) => marketPriceFor(current.ai, cardFor(id)) <= marketFocusAvailable(current.ai, cardFor(id))).sort((left, right) => aiMarketScore(cardFor(right)!, current.ai) - aiMarketScore(cardFor(left)!, current.ai))[0];
  const purchasedCard = aiPurchase ? cardFor(aiPurchase) : null;
  const aiBasePrice = purchasedCard ? marketBasePriceFor(current.ai, purchasedCard) : Number.POSITIVE_INFINITY;
  const characterPurchase = purchasedCard ? commitQuickDuelCharacterPurchase(current.ai, current.player, purchasedCard, aiBasePrice, "ai") : null;
  let aiAfterPurchase = purchasedCard && characterPurchase ? stage3cConsumePurchase(markCompletedTask({ ...spendMarketFocus(characterPurchase.self, purchasedCard, characterPurchase.price), discard: [...characterPurchase.self.discard, purchasedCard.id], purchasedTypes: [...characterPurchase.self.purchasedTypes, purchasedCard.cardType], cardsBought: characterPurchase.self.cardsBought + 1 }), purchasedCard) : current.ai;
  const playerAfterPurchase = characterPurchase?.opponent ?? current.player;
'''
text = replace_once(text, old, new, "AI Market purchase commit")

old = '''  const hostedHide = publishQuickDuelPlaytestLifecycleEvent({ ...current, ai: aiAfterPurchase }, "ai", "onHide", quickDuelHostOperations, cardFor).match;
'''
new = '''  const hostedHide = publishQuickDuelPlaytestLifecycleEvent({ ...current, player: playerAfterPurchase, ai: aiAfterPurchase }, "ai", "onHide", quickDuelHostOperations, cardFor).match;
'''
text = replace_once(text, old, new, "AI purchase opponent projection")

playtest_path.write_text(text)

runtime_path = Path("app/character-runtime.ts")
runtime = runtime_path.read_text()
old = '''      case "character.revealReplacementOnceGame": {
        const accept = event.optionalAccepted ?? (actor === "ai" ? true : undefined);
        if (accept === undefined) choices.push(makeChoice(effect, "Discard this reveal and replace it from the same deck?", ["accept", "skip"], true, "optionalAccepted"));
        else if (accept && event.replacementId) { event.selectedId = event.replacementId; activated = true; }
        break;
      }
'''
new = '''      case "character.revealReplacementOnceGame": {
        if (!event.replacementId) break;
        const accept = event.optionalAccepted ?? (actor === "ai" ? true : undefined);
        if (accept === undefined) choices.push(makeChoice(effect, "Discard this reveal and replace it from the same deck?", ["accept", "skip"], true, "optionalAccepted"));
        else if (accept) { event.selectedId = event.replacementId; activated = true; }
        break;
      }
'''
runtime = replace_once(runtime, old, new, "Ronin reveal guard")
runtime_path.write_text(runtime)
