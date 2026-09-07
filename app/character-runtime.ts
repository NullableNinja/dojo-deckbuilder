import cardEffectsJson from "./data/card-effects.json";
import {
  characterDecision,
  characterUsageScope,
  greenCharacterAbilityUnlocked,
  type CharacterStructuredEffect,
} from "./character-effect-resolvers";

export type CharacterRuntimeActor = "player" | "ai";
export type CharacterRuntimeZone = "High" | "Mid" | "Low";
export type CharacterRuntimeEventType =
  | "roundStart"
  | "turnStart"
  | "initiate"
  | "cardPlayed"
  | "discarded"
  | "speedChanged"
  | "attackDeclared"
  | "incomingAttackDeclared"
  | "hit"
  | "block"
  | "damageIncoming"
  | "equip"
  | "kataPlayed"
  | "comboReveal"
  | "purchaseAttempt"
  | "promotion"
  | "sceneChange"
  | "reboot"
  | "hide";

export type CharacterRuntimeCard = {
  id: string;
  name?: string;
  cardType?: string;
  subtype?: string;
  zone?: string | null;
  tags?: string[];
  rulesText?: string | null;
};

export type CharacterRuntimeBoard = {
  fighterId: string;
  belt: number;
  hp: number;
  maxHp: number;
  xp: number;
  focus: number;
  tempSpeed: number;
  nextAttackBonus: number;
  nextDefenseCardBonus?: number;
  nextAttackAnyZone: boolean;
  nextAttackHasFlow: boolean;
  attacksThisTurn: number;
  zonesPlayed: string[];
  cardsThisTurn: string[];
  equipment: string[];
  exhaustedEquipment?: string[];
  hand: string[];
  deck: string[];
  discard: string[];
  destroyed?: string[];
  usedConsumableThisRound?: boolean;
  wasHitSinceLastTurn: boolean;
  damageReductionUsed: boolean;
  reversalAttackBonus?: number;
  nextInitiateFocus?: number;
  borrowedEquipmentId: string | null;
  abilityUsedRound: boolean;
  usedCharacterEffectIdsThisTurn?: string[];
  usedCharacterEffectIdsThisRound?: string[];
  usedCharacterEffectIdsThisGame?: string[];
  characterMarks?: Record<string, unknown>;
};

export type CharacterRuntimeEvent = {
  type: CharacterRuntimeEventType;
  card?: CharacterRuntimeCard | null;
  zone?: CharacterRuntimeZone | string;
  printedZone?: CharacterRuntimeZone | string | null;
  previousAttackZone?: CharacterRuntimeZone | string | null;
  attackPower?: number;
  damage?: number;
  opponentXp?: number;
  blocked?: boolean;
  changedZone?: boolean;
  wasReduced?: boolean;
  usedConsumableThisTurn?: boolean;
  playedKataEarlierThisTurn?: boolean;
  differentZoneFromPreviousAttack?: boolean;
  firstAttackThisTurn?: boolean;
  firstKataThisTurn?: boolean;
  secondKataThisTurn?: boolean;
  thirdDifferentCardTypeThisTurn?: boolean;
  completedBeltExam?: boolean;
  sceneChanged?: boolean;
  noCombatDamagePreviousTurn?: boolean;
  opponentModifiedCard?: boolean;
  discardedOutsideHide?: boolean;
  discardedJunk?: boolean;
  destroyedJunk?: boolean;
  noPrintedNumericEffect?: boolean;
  hasWeaponEquipped?: boolean;
  revealIds?: string[];
  candidateIds?: string[];
  replacementId?: string | null;
  selectedId?: string | null;
  selectedZone?: CharacterRuntimeZone | string | null;
  selectedMode?: string | null;
  optionalAccepted?: boolean;
  modifierBonus?: number;
  targetId?: string | null;
};

export type CharacterRuntimeChoice = {
  resolver: string;
  effectId: string;
  prompt: string;
  options: string[];
  optional: boolean;
};

export type CharacterRuntimeResult = {
  self: CharacterRuntimeBoard;
  opponent: CharacterRuntimeBoard;
  event: CharacterRuntimeEvent;
  choices: CharacterRuntimeChoice[];
  notes: string[];
};

type RuntimeRegistry = {
  cards?: Record<string, { name?: string; effects?: CharacterStructuredEffect[] }>;
};

const registry = cardEffectsJson as unknown as RuntimeRegistry;

const RESOLVER_EVENTS: Record<string, CharacterRuntimeEventType[]> = {
  "character.reversalAfterBlock": ["block"],
  "character.speedChangeNextAttackZone": ["speedChanged"],
  "character.green.linkedChangedAttackHit": ["hit"],
  "character.incomingAttackSlowChoice": ["incomingAttackDeclared"],
  "character.green.linkedReducedAttackBlockCycle": ["block"],
  "character.discardOutsideHideNextAttack": ["discarded"],
  "character.green.linkedAttackHitRecycle": ["hit"],
  "character.opponentModificationCycle": ["cardPlayed"],
  "character.green.repeatModifiedCardTypeBonus": ["cardPlayed"],
  "character.marketDiscountFloor": ["purchaseAttempt"],
  "character.damageThreshold": ["damageIncoming"],
  "character.green.delayedDamagePreventionFocus": ["damageIncoming"],
  "character.forcedJunkDiscardDestroyChoice": ["discarded"],
  "character.twoZoneSpeed": ["cardPlayed"],
  "character.green.linkedSpeedTempoFlow": ["cardPlayed"],
  "character.declaredAttackZoneChange": ["attackDeclared"],
  "character.green.linkedZoneChangePower": ["attackDeclared"],
  "character.xpTrailFirstHit": ["hit"],
  "character.firstAttackAfterConsumable": ["attackDeclared"],
  "character.green.linkedAttackHitPenalty": ["hit"],
  "character.firstHighAttackToMid": ["attackDeclared"],
  "character.green.linkedChangedAttackHitCycle": ["hit"],
  "character.ignoreTemporaryAttackBonusesOnceGame": ["incomingAttackDeclared"],
  "character.discardJunkDestroyChoice": ["discarded"],
  "character.green.linkedJunkDestroyCycle": ["discarded"],
  "character.noNumericEffectNextAttack": ["cardPlayed"],
  "character.green.linkedAttackHitFocus": ["hit"],
  "character.junkDiscardToBottomCycle": ["discarded"],
  "character.green.linkedRecycleLowAttack": ["attackDeclared"],
  "character.firstKickDifferentZone": ["attackDeclared"],
  "character.green.linkedKickHitSpeed": ["hit"],
  "character.cannotEquipWeapons": ["equip"],
  "character.firstUnarmedAttack": ["attackDeclared"],
  "character.speedChangeCycle": ["speedChanged"],
  "character.comboRevealChoice": ["comboReveal"],
  "character.firstKataDefenseZone": ["kataPlayed"],
  "character.revealConsumableCycle": ["initiate"],
  "character.noWeaponOffenseDefenseChoice": ["initiate"],
  "character.green.linkedChosenCardOutcomeCycle": ["hit", "block"],
  "character.discardToChangeDeclaredZone": ["attackDeclared"],
  "character.equipFromHandNextDefense": ["equip"],
  "character.linkedDefenseBlockCycle": ["block"],
  "character.firstKataSpeed": ["kataPlayed"],
  "character.green.secondKataCycle": ["kataPlayed"],
  "character.conditionalAttackPower": ["attackDeclared"],
  "character.green.linkedAttackHitRewardChoice": ["hit"],
  "character.revealReplacementOnceGame": ["sceneChange", "purchaseAttempt"],
  "character.equipDiscardPermanentUntilHide": ["initiate"],
  "character.firstHitDamagePrevention": ["damageIncoming"],
  "character.green.linkedPreventedHitRetaliation": ["damageIncoming"],
  "character.secondKickNextKickFlow": ["cardPlayed"],
  "character.noCombatDamagePreviousTurnCycle": ["initiate"],
  "character.examRequirementSpeed": ["cardPlayed"],
  "character.green.promotionCycle": ["promotion"],
  "character.reduceLargeAttackModifier": ["incomingAttackDeclared"],
  "character.green.linkedReductionRetaliation": ["incomingAttackDeclared"],
  "character.exhaustReadyEquipmentLock": ["reboot"],
  "character.green.linkedRebootCycle": ["reboot"],
  "character.thirdDifferentCardTypeCycle": ["cardPlayed"],
  "character.afterAttackDifferentZone": ["cardPlayed"],
  "character.sceneChangeCycle": ["sceneChange"],
  "character.firstSpinAttackRound": ["attackDeclared"],
};

function effectsFor(fighterId: string): CharacterStructuredEffect[] {
  return registry.cards?.[fighterId]?.effects ?? [];
}

function marks(board: CharacterRuntimeBoard) {
  return { ...(board.characterMarks ?? {}) };
}

function draw(board: CharacterRuntimeBoard, amount: number) {
  let deck = [...board.deck];
  const hand = [...board.hand];
  for (let index = 0; index < amount && deck.length; index += 1) {
    const cardId = deck.pop();
    if (cardId) hand.push(cardId);
  }
  return { ...board, deck, hand };
}

function discardSelected(board: CharacterRuntimeBoard, amount: number, selectedId?: string | null) {
  let hand = [...board.hand];
  const discard = [...board.discard];
  for (let index = 0; index < amount && hand.length; index += 1) {
    const desiredIndex = selectedId ? hand.indexOf(selectedId) : -1;
    const removeIndex = desiredIndex >= 0 ? desiredIndex : 0;
    const [cardId] = hand.splice(removeIndex, 1);
    if (cardId) discard.push(cardId);
  }
  return { ...board, hand, discard };
}

function cycle(board: CharacterRuntimeBoard, drawAmount: number, discardAmount: number, selectedId?: string | null) {
  return discardSelected(draw(board, drawAmount), discardAmount, selectedId);
}

function effectId(effect: CharacterStructuredEffect, fallback: string) {
  return String(effect.id ?? fallback);
}

function usageList(board: CharacterRuntimeBoard, scope: ReturnType<typeof characterUsageScope>) {
  if (scope === "turn") return board.usedCharacterEffectIdsThisTurn ?? [];
  if (scope === "round") return board.usedCharacterEffectIdsThisRound ?? [];
  if (scope === "game") return board.usedCharacterEffectIdsThisGame ?? [];
  return [];
}

function consume(board: CharacterRuntimeBoard, effect: CharacterStructuredEffect) {
  const resolver = String(effect.resolver ?? "");
  const id = effectId(effect, resolver);
  const scope = characterUsageScope(resolver);
  if (scope === "none") return board;
  const key = scope === "turn" ? "usedCharacterEffectIdsThisTurn" : scope === "round" ? "usedCharacterEffectIdsThisRound" : "usedCharacterEffectIdsThisGame";
  const current = usageList(board, scope);
  return { ...board, [key]: current.includes(id) ? current : [...current, id] };
}

function available(board: CharacterRuntimeBoard, effect: CharacterStructuredEffect, eventType: CharacterRuntimeEventType) {
  const resolver = String(effect.resolver ?? "");
  if (!resolver || !(RESOLVER_EVENTS[resolver] ?? []).includes(eventType)) return false;
  if (!greenCharacterAbilityUnlocked(resolver, board.belt)) return false;
  const id = effectId(effect, resolver);
  return !usageList(board, characterUsageScope(resolver)).includes(id);
}

function choice(resolver: string, effect: CharacterStructuredEffect, prompt: string, options: string[], optional = true): CharacterRuntimeChoice {
  return { resolver, effectId: effectId(effect, resolver), prompt, options, optional };
}

function hasTag(card: CharacterRuntimeCard | null | undefined, tag: string) {
  return (card?.tags ?? []).some((value) => value.toLowerCase() === tag.toLowerCase());
}

function mark(board: CharacterRuntimeBoard, key: string, value: unknown) {
  return { ...board, characterMarks: { ...marks(board), [key]: value } };
}

function markTruthy(board: CharacterRuntimeBoard, key: string) {
  return Boolean(marks(board)[key]);
}

function clearMark(board: CharacterRuntimeBoard, key: string) {
  const nextMarks = marks(board);
  delete nextMarks[key];
  return { ...board, characterMarks: nextMarks };
}

export function resetCharacterTurn(board: CharacterRuntimeBoard) {
  return { ...board, usedCharacterEffectIdsThisTurn: [] };
}

export function resetCharacterRound(board: CharacterRuntimeBoard) {
  const kept = marks(board);
  for (const key of Object.keys(kept)) if (key.startsWith("round:")) delete kept[key];
  return { ...board, usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [], characterMarks: kept };
}

export function characterCanEquip(board: CharacterRuntimeBoard, card: CharacterRuntimeCard) {
  const hasRestriction = effectsFor(board.fighterId).some((effect) => effect.resolver === "character.cannotEquipWeapons" && greenCharacterAbilityUnlocked(String(effect.resolver), board.belt));
  return !(hasRestriction && (card.subtype === "Weapon" || hasTag(card, "Weapon")));
}

export function characterAllowedAttackZones(board: CharacterRuntimeBoard, card: CharacterRuntimeCard, printedZones: string[]) {
  const zones = new Set(printedZones);
  const all = ["High", "Mid", "Low"];
  if (board.nextAttackAnyZone) all.forEach((zone) => zones.add(zone));
  for (const effect of effectsFor(board.fighterId)) {
    if (!available(board, effect, "attackDeclared")) continue;
    const resolver = String(effect.resolver ?? "");
    const firstAttack = board.attacksThisTurn === 0;
    if (resolver === "character.firstSpinAttackRound" && hasTag(card, "Spin")) all.forEach((zone) => zones.add(zone));
    if (resolver === "character.firstHighAttackToMid" && firstAttack && printedZones.includes("High")) zones.add("Mid");
    if (resolver === "character.declaredAttackZoneChange" || resolver === "character.discardToChangeDeclaredZone" || resolver === "character.afterAttackDifferentZone") all.forEach((zone) => zones.add(zone));
  }
  return [...zones];
}

export function characterPurchasePrice(board: CharacterRuntimeBoard, printedPrice: number) {
  const effect = effectsFor(board.fighterId).find((entry) => entry.resolver === "character.marketDiscountFloor" && available(board, entry, "purchaseAttempt"));
  if (!effect || printedPrice < 5) return printedPrice;
  return Math.max(4, printedPrice - Math.max(1, Number(effect.amount ?? 1)));
}

export function characterAttackModifier(board: CharacterRuntimeBoard, opponent: CharacterRuntimeBoard, card: CharacterRuntimeCard, event: Partial<CharacterRuntimeEvent> = {}) {
  let power = 0;
  let damage = 0;
  const notes: string[] = [];
  const firstAttack = event.firstAttackThisTurn ?? board.attacksThisTurn === 0;
  for (const effect of effectsFor(board.fighterId)) {
    if (!available(board, effect, "attackDeclared")) continue;
    const resolver = String(effect.resolver ?? "");
    const amount = Number(effect.amount ?? 1);
    if (resolver === "character.firstAttackAfterConsumable" && firstAttack && (event.usedConsumableThisTurn ?? board.usedConsumableThisRound)) { power += amount; notes.push("first Attack after Consumable +1 Attack Power"); }
    if (resolver === "character.firstKickDifferentZone" && firstAttack && hasTag(card, "Kick") && Boolean(event.differentZoneFromPreviousAttack)) { power += amount; notes.push("different-zone Kick +1 Attack Power"); }
    if (resolver === "character.firstUnarmedAttack" && firstAttack && !event.hasWeaponEquipped) { power += amount; notes.push("first unarmed Attack +1 Attack Power"); }
    if (resolver === "character.conditionalAttackPower" && firstAttack && Boolean(event.playedKataEarlierThisTurn)) { power += amount; notes.push("Kata setup +1 Attack Power"); }
    if (resolver === "character.green.linkedZoneChangePower" && Boolean(event.changedZone)) { power += amount; notes.push("changed-zone Attack +1 Attack Power"); }
    if (resolver === "character.green.linkedRecycleLowAttack" && markTruthy(board, "turn:recycledJunk") && String(event.zone ?? "") === "Low") { power += amount; notes.push("recycled Junk powers Low Attack +1"); }
  }
  if (board.nextAttackBonus) power += board.nextAttackBonus;
  return { power, damage, notes };
}

export function characterDamageReduction(board: CharacterRuntimeBoard, incomingDamage: number) {
  let self = board;
  let damage = incomingDamage;
  const notes: string[] = [];
  for (const effect of effectsFor(board.fighterId)) {
    if (!available(self, effect, "damageIncoming") || damage <= 0) continue;
    const resolver = String(effect.resolver ?? "");
    const amount = Math.max(0, Number(effect.amount ?? 1));
    if (resolver === "character.damageThreshold" && damage >= 4) {
      damage = Math.max(0, damage - amount); self = consume(self, effect); self = mark(self, "round:preventedHit", true); notes.push("damage threshold reduced by 1");
    }
    if (resolver === "character.firstHitDamagePrevention") {
      damage = Math.max(0, damage - amount); self = consume(self, effect); self = mark(self, "round:preventedHit", true); notes.push("first Hit reduced by 1");
    }
  }
  return { board: self, damage, notes };
}

export function applyCharacterRuntimeEvent(
  selfInput: CharacterRuntimeBoard,
  opponentInput: CharacterRuntimeBoard,
  eventInput: CharacterRuntimeEvent,
  actor: CharacterRuntimeActor = "player",
): CharacterRuntimeResult {
  let self = selfInput;
  let opponent = opponentInput;
  let event = { ...eventInput };
  const choices: CharacterRuntimeChoice[] = [];
  const notes: string[] = [];

  for (const effect of effectsFor(self.fighterId)) {
    if (!available(self, effect, event.type)) continue;
    const resolver = String(effect.resolver ?? "");
    const amount = Number(effect.amount ?? 1);
    let activated = false;

    switch (resolver) {
      case "character.reversalAfterBlock":
        if (event.blocked !== false) { self = { ...self, reversalAttackBonus: (self.reversalAttackBonus ?? 0) + amount }; activated = true; }
        break;
      case "character.speedChangeNextAttackZone":
        self = { ...self, nextAttackAnyZone: true }; activated = true; break;
      case "character.green.linkedChangedAttackHit":
        if (event.changedZone || markTruthy(self, "turn:changedAttack")) { self = { ...self, focus: self.focus + amount }; activated = true; }
        break;
      case "character.incomingAttackSlowChoice": {
        const accept = event.optionalAccepted ?? (actor === "ai" ? characterDecision(resolver, actor, ["accept", "skip"], 0) === "accept" : undefined);
        if (accept === undefined) { choices.push(choice(resolver, effect, "Lose 1 Speed until end of round to reduce this Attack by 1 Power?", ["accept", "skip"])); break; }
        if (accept) { self = { ...self, tempSpeed: self.tempSpeed - 1 }; event.attackPower = Math.max(0, Number(event.attackPower ?? 0) - 1); self = mark(self, "round:reducedIncomingAttack", true); activated = true; }
        break;
      }
      case "character.green.linkedReducedAttackBlockCycle":
        if ((event.blocked ?? true) && markTruthy(self, "round:reducedIncomingAttack")) { self = cycle(self, 1, 1, event.selectedId); activated = true; }
        break;
      case "character.discardOutsideHideNextAttack":
        if (event.discardedOutsideHide) { self = { ...self, nextAttackBonus: self.nextAttackBonus + amount }; self = mark(self, "turn:discardPoweredAttack", true); activated = true; }
        break;
      case "character.green.linkedAttackHitRecycle":
        if (markTruthy(self, "turn:discardPoweredAttack") && event.selectedId && self.discard.includes(event.selectedId)) { self = { ...self, discard: self.discard.filter((id, index) => id !== event.selectedId || self.discard.indexOf(id) !== index), deck: [event.selectedId, ...self.deck] }; activated = true; }
        break;
      case "character.opponentModificationCycle":
        if (event.opponentModifiedCard) { self = cycle(self, 1, 1, event.selectedId); self = mark(self, "round:modifiedCardType", event.card?.cardType ?? ""); activated = true; }
        break;
      case "character.green.repeatModifiedCardTypeBonus":
        if (markTruthy(self, "round:modifiedCardType") && marks(self)["round:modifiedCardType"] === event.card?.cardType) { self = { ...self, nextAttackBonus: self.nextAttackBonus + amount, nextDefenseCardBonus: (self.nextDefenseCardBonus ?? 0) + amount }; activated = true; }
        break;
      case "character.damageThreshold":
      case "character.firstHitDamagePrevention": {
        const reduced = characterDamageReduction(self, Number(event.damage ?? 0));
        if (reduced.damage !== event.damage) { self = reduced.board; event.damage = reduced.damage; notes.push(...reduced.notes); }
        break;
      }
      case "character.green.delayedDamagePreventionFocus":
        if (markTruthy(self, "round:preventedHit")) { self = { ...self, nextInitiateFocus: (self.nextInitiateFocus ?? 0) + amount }; activated = true; }
        break;
      case "character.forcedJunkDiscardDestroyChoice":
      case "character.discardJunkDestroyChoice": {
        if (!event.discardedJunk || !event.selectedId) break;
        const accept = event.optionalAccepted ?? (actor === "ai");
        if (event.optionalAccepted === undefined && actor === "player") { choices.push(choice(resolver, effect, "Destroy the Junk instead of discarding it?", [event.selectedId, "skip"])); break; }
        if (accept) { self = { ...self, discard: self.discard.filter((id) => id !== event.selectedId), destroyed: [...(self.destroyed ?? []), event.selectedId] }; self = mark(self, "round:destroyedJunk", true); activated = true; }
        break;
      }
      case "character.green.linkedJunkDestroyCycle":
        if (event.destroyedJunk || markTruthy(self, "round:destroyedJunk")) { self = cycle(self, 1, 1, event.selectedId); activated = true; }
        break;
      case "character.twoZoneSpeed": {
        const zones = new Set([...self.zonesPlayed, event.zone ?? ""].filter(Boolean));
        if (zones.size >= 2) { self = { ...self, tempSpeed: self.tempSpeed + amount }; self = mark(self, "round:twoZoneSpeed", true); activated = true; }
        break;
      }
      case "character.green.linkedSpeedTempoFlow":
        if (markTruthy(self, "round:twoZoneSpeed") && self.tempSpeed > 0) { self = { ...self, nextAttackHasFlow: true }; activated = true; }
        break;
      case "character.declaredAttackZoneChange":
      case "character.firstHighAttackToMid":
      case "character.discardToChangeDeclaredZone":
      case "character.firstSpinAttackRound": {
        const changed = Boolean(event.selectedZone && event.selectedZone !== event.printedZone);
        if (resolver === "character.firstHighAttackToMid" && !(event.firstAttackThisTurn ?? self.attacksThisTurn === 0) || resolver === "character.firstSpinAttackRound" && !hasTag(event.card, "Spin")) break;
        if (resolver === "character.discardToChangeDeclaredZone" && changed) {
          if (!event.selectedId || !self.hand.includes(event.selectedId)) { choices.push(choice(resolver, effect, "Discard a card to change the declared Attack zone.", self.hand, true)); break; }
          self = discardSelected(self, 1, event.selectedId);
        }
        if (changed) { event.changedZone = true; self = mark(self, "turn:changedAttack", true); activated = true; }
        break;
      }
      case "character.green.linkedZoneChangePower":
        if (event.changedZone) { event.attackPower = Number(event.attackPower ?? 0) + amount; activated = true; }
        break;
      case "character.xpTrailFirstHit":
        if ((event.firstAttackThisTurn ?? self.attacksThisTurn === 0) && opponent.xp > self.xp) { event.damage = Number(event.damage ?? 0) + amount; activated = true; }
        break;
      case "character.firstAttackAfterConsumable":
        if ((event.firstAttackThisTurn ?? self.attacksThisTurn === 0) && (event.usedConsumableThisTurn ?? self.usedConsumableThisRound)) { event.attackPower = Number(event.attackPower ?? 0) + amount; self = mark(self, "turn:consumableAttack", true); activated = true; }
        break;
      case "character.green.linkedAttackHitPenalty":
        if (markTruthy(self, "turn:consumableAttack")) { opponent = { ...opponent, nextAttackBonus: opponent.nextAttackBonus - amount }; activated = true; }
        break;
      case "character.green.linkedChangedAttackHitCycle":
        if (event.changedZone || markTruthy(self, "turn:changedAttack")) { self = cycle(self, 1, 1, event.selectedId); activated = true; }
        break;
      case "character.ignoreTemporaryAttackBonusesOnceGame": {
        const accept = event.optionalAccepted ?? (actor === "ai");
        if (event.optionalAccepted === undefined && actor === "player") { choices.push(choice(resolver, effect, "Ignore temporary Attack bonuses for this strike?", ["accept", "skip"])); break; }
        if (accept) { event.attackPower = Math.max(0, Number(event.attackPower ?? 0) - Math.max(0, Number(event.modifierBonus ?? 0))); activated = true; }
        break;
      }
      case "character.noNumericEffectNextAttack":
        if (event.noPrintedNumericEffect) { self = { ...self, nextAttackBonus: self.nextAttackBonus + amount }; self = mark(self, "turn:noNumericAttack", true); activated = true; }
        break;
      case "character.green.linkedAttackHitFocus":
        if (markTruthy(self, "turn:noNumericAttack")) { self = { ...self, focus: self.focus + amount }; activated = true; }
        break;
      case "character.junkDiscardToBottomCycle":
        if (event.discardedJunk && event.selectedId && self.discard.includes(event.selectedId)) { self = { ...self, discard: self.discard.filter((id) => id !== event.selectedId), deck: [event.selectedId, ...self.deck] }; self = cycle(self, 1, 1, event.selectedMode); self = mark(self, "turn:recycledJunk", true); activated = true; }
        break;
      case "character.green.linkedRecycleLowAttack":
        if (markTruthy(self, "turn:recycledJunk") && event.zone === "Low") { event.attackPower = Number(event.attackPower ?? 0) + amount; activated = true; }
        break;
      case "character.firstKickDifferentZone":
        if ((event.firstAttackThisTurn ?? self.attacksThisTurn === 0) && hasTag(event.card, "Kick") && event.differentZoneFromPreviousAttack) { event.attackPower = Number(event.attackPower ?? 0) + amount; self = mark(self, "turn:kickBonus", true); activated = true; }
        break;
      case "character.green.linkedKickHitSpeed":
        if (markTruthy(self, "turn:kickBonus")) { self = { ...self, tempSpeed: self.tempSpeed + amount }; activated = true; }
        break;
      case "character.cannotEquipWeapons":
        if (event.card && !characterCanEquip(self, event.card)) { self = mark(self, "round:equipRejected", event.card.id); activated = true; }
        break;
      case "character.firstUnarmedAttack":
        if ((event.firstAttackThisTurn ?? self.attacksThisTurn === 0) && !event.hasWeaponEquipped) { event.attackPower = Number(event.attackPower ?? 0) + amount; activated = true; }
        break;
      case "character.speedChangeCycle":
        self = cycle(self, 1, 1, event.selectedId); activated = true; break;
      case "character.comboRevealChoice": {
        const options = event.revealIds ?? [];
        if (options.length >= 2) {
          const selected = event.selectedId ?? (actor === "ai" ? characterDecision(resolver, actor, options, 0) : null);
          if (!selected) choices.push(choice(resolver, effect, "Choose one revealed Combo to attempt to learn.", options, false));
          else { event.selectedId = selected; activated = true; }
        }
        break;
      }
      case "character.firstKataDefenseZone":
        if (event.firstKataThisTurn) {
          const zone = event.selectedZone ?? (actor === "ai" ? "Mid" : null);
          if (!zone) choices.push(choice(resolver, effect, "Choose the additional zone for your next Defense.", ["High", "Mid", "Low"], false));
          else { self = mark(self, "turn:nextDefenseExtraZone", zone); activated = true; }
        }
        break;
      case "character.revealConsumableCycle": {
        const options = event.candidateIds ?? [];
        if (options.length) {
          const selected = event.selectedId ?? (actor === "ai" ? options[0] : null);
          if (!selected) choices.push(choice(resolver, effect, "Reveal a Consumable to draw 1 then discard 1?", [...options, "skip"]));
          else if (selected !== "skip") { self = cycle(self, 1, 1, event.selectedMode); activated = true; }
        }
        break;
      }
      case "character.noWeaponOffenseDefenseChoice": {
        if (event.hasWeaponEquipped) break;
        const selected = event.selectedMode ?? (actor === "ai" ? "attack" : null);
        if (!selected) choices.push(choice(resolver, effect, "Choose your first-card bonus this round.", ["attack", "defense"], false));
        else { self = mark(self, "round:mimenMode", selected); if (selected === "attack") self = { ...self, nextAttackBonus: self.nextAttackBonus + 1 }; else self = { ...self, nextDefenseCardBonus: (self.nextDefenseCardBonus ?? 0) + 1 }; activated = true; }
        break;
      }
      case "character.green.linkedChosenCardOutcomeCycle": {
        const mode = marks(self)["round:mimenMode"];
        if ((mode === "attack" && event.type === "hit") || (mode === "defense" && event.type === "block")) { self = cycle(self, 1, 1, event.selectedId); activated = true; }
        break;
      }
      case "character.equipFromHandNextDefense":
        self = { ...self, nextDefenseCardBonus: (self.nextDefenseCardBonus ?? 0) + amount }; self = mark(self, "round:clipEquip", true); activated = true; break;
      case "character.linkedDefenseBlockCycle":
        if (markTruthy(self, "round:clipEquip") && (event.blocked ?? true)) { self = cycle(self, 1, 1, event.selectedId); activated = true; }
        break;
      case "character.firstKataSpeed":
        if (event.firstKataThisTurn) { self = { ...self, tempSpeed: self.tempSpeed + amount }; activated = true; }
        break;
      case "character.green.secondKataCycle":
        if (event.secondKataThisTurn) { self = cycle(self, 1, 1, event.selectedId); self = { ...self, focus: self.focus + 1 }; activated = true; }
        break;
      case "character.conditionalAttackPower":
        if ((event.firstAttackThisTurn ?? self.attacksThisTurn === 0) && event.playedKataEarlierThisTurn) { event.attackPower = Number(event.attackPower ?? 0) + amount; self = mark(self, "turn:kataAttack", true); activated = true; }
        break;
      case "character.green.linkedAttackHitRewardChoice":
        if (markTruthy(self, "turn:kataAttack")) {
          const mode = event.selectedMode ?? (actor === "ai" ? "focus" : null);
          if (!mode) choices.push(choice(resolver, effect, "Choose the Hit reward.", ["cycle", "focus"], false));
          else if (mode === "focus") { self = { ...self, focus: self.focus + 1 }; activated = true; }
          else { self = cycle(self, 1, 1, event.selectedId); activated = true; }
        }
        break;
      case "character.revealReplacementOnceGame": {
        const accept = event.optionalAccepted ?? (actor === "ai");
        if (event.optionalAccepted === undefined && actor === "player") { choices.push(choice(resolver, effect, "Discard this reveal and replace it from the same deck?", ["accept", "skip"])); break; }
        if (accept && event.replacementId) { event.selectedId = event.replacementId; activated = true; }
        break;
      }
      case "character.equipDiscardPermanentUntilHide": {
        const options = event.candidateIds ?? [];
        const selected = event.selectedId ?? (actor === "ai" ? options[0] : null);
        if (options.length && !selected) choices.push(choice(resolver, effect, "Equip a permanent Item/Gear from your discard until Hide?", [...options, "skip"]));
        else if (selected && selected !== "skip" && self.discard.includes(selected)) { self = { ...self, discard: self.discard.filter((id) => id !== selected), equipment: [...self.equipment, selected], borrowedEquipmentId: selected }; activated = true; }
        break;
      }
      case "character.green.linkedPreventedHitRetaliation":
        if (markTruthy(self, "round:preventedHit")) { self = { ...self, nextAttackBonus: self.nextAttackBonus + amount }; activated = true; }
        break;
      case "character.secondKickNextKickFlow": {
        const kickCount = Number(marks(self)["turn:kickCount"] ?? 0) + (hasTag(event.card, "Kick") ? 1 : 0);
        self = mark(self, "turn:kickCount", kickCount);
        if (kickCount === 2) { self = { ...self, nextAttackHasFlow: true }; activated = true; }
        break;
      }
      case "character.noCombatDamagePreviousTurnCycle":
        if (event.noCombatDamagePreviousTurn) { self = cycle(self, 1, 1, event.selectedId); activated = true; }
        break;
      case "character.examRequirementSpeed":
        if (event.completedBeltExam) { self = { ...self, tempSpeed: self.tempSpeed + amount }; activated = true; }
        break;
      case "character.green.promotionCycle":
        self = cycle(self, 2, 1, event.selectedId); activated = true; break;
      case "character.reduceLargeAttackModifier":
        if (Number(event.modifierBonus ?? 0) >= 2) { event.attackPower = Math.max(0, Number(event.attackPower ?? 0) - amount); self = mark(self, "round:nerfhammerReduced", true); activated = true; }
        break;
      case "character.green.linkedReductionRetaliation":
        if (markTruthy(self, "round:nerfhammerReduced")) { self = { ...self, nextAttackBonus: self.nextAttackBonus + amount }; activated = true; }
        break;
      case "character.exhaustReadyEquipmentLock": {
        const options = event.candidateIds ?? self.equipment;
        const selected = event.selectedId ?? (actor === "ai" ? options[0] : null);
        if (options.length && !selected) choices.push(choice(resolver, effect, "Choose Equipment to exhaust then immediately ready.", options, false));
        else if (selected && self.equipment.includes(selected)) { self = mark(self, `turn:rebootLocked:${selected}`, true); activated = true; }
        break;
      }
      case "character.green.linkedRebootCycle":
        if (Object.keys(marks(self)).some((key) => key.startsWith("turn:rebootLocked:"))) { self = cycle(self, 1, 1, event.selectedMode); activated = true; }
        break;
      case "character.thirdDifferentCardTypeCycle":
        if (event.thirdDifferentCardTypeThisTurn) { self = cycle(self, 1, 1, event.selectedId); activated = true; }
        break;
      case "character.afterAttackDifferentZone":
        if (event.card?.cardType === "Attack") { self = { ...self, nextAttackAnyZone: true }; activated = true; }
        break;
      case "character.sceneChangeCycle":
        if (event.sceneChanged !== false) { self = cycle(self, 1, 1, event.selectedId); activated = true; }
        break;
      default:
        break;
    }

    if (activated) {
      self = consume(self, effect);
      notes.push(resolver);
    }
  }

  if (event.type === "hide" && self.borrowedEquipmentId) {
    const borrowed = self.borrowedEquipmentId;
    self = { ...self, equipment: self.equipment.filter((id) => id !== borrowed), discard: [...self.discard, borrowed], borrowedEquipmentId: null };
  }

  return { self, opponent, event, choices, notes };
}

export function characterRuntimeCoverage() {
  return Object.entries(registry.cards ?? {})
    .filter(([id]) => id.startsWith("DDB-CHR-CORE-"))
    .map(([cardId, card]) => ({
      cardId,
      name: card.name ?? cardId,
      resolvers: (card.effects ?? []).map((effect) => String(effect.resolver ?? "")).filter(Boolean),
      events: [...new Set((card.effects ?? []).flatMap((effect) => RESOLVER_EVENTS[String(effect.resolver ?? "")] ?? []))],
    }));
}
