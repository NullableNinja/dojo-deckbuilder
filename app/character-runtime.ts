import cardEffectsJson from "./data/card-effects.json";
import {
  characterUsageScope,
  greenCharacterAbilityUnlocked,
  type CharacterStructuredEffect,
} from "./character-effect-resolvers";

export type CharacterRuntimeActor = "player" | "ai";
export type CharacterRuntimeZone = "High" | "Mid" | "Low";
export type CharacterRuntimeEventType =
  | "roundStart" | "turnStart" | "initiate" | "cardPlayed" | "discarded" | "speedChanged"
  | "attackDeclared" | "incomingAttackDeclared" | "hit" | "block" | "damageIncoming" | "equip"
  | "kataPlayed" | "comboReveal" | "purchaseAttempt" | "promotion" | "sceneChange" | "reboot" | "hide";

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

type Registry = { cards?: Record<string, { name?: string; effects?: CharacterStructuredEffect[] }> };
const registry = cardEffectsJson as unknown as Registry;

const resolverEvents: Record<string, CharacterRuntimeEventType[]> = {
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

const effectsFor = (fighterId: string) => registry.cards?.[fighterId]?.effects ?? [];
const hasTag = (card: CharacterRuntimeCard | null | undefined, tag: string) => (card?.tags ?? []).some((value) => value.toLowerCase() === tag.toLowerCase());
const markMap = (board: CharacterRuntimeBoard) => ({ ...(board.characterMarks ?? {}) });
const hasMark = (board: CharacterRuntimeBoard, key: string) => Boolean(markMap(board)[key]);
const mark = (board: CharacterRuntimeBoard, key: string, value: unknown = true) => ({ ...board, characterMarks: { ...markMap(board), [key]: value } });

function draw(board: CharacterRuntimeBoard, amount: number) {
  const deck = [...board.deck];
  const hand = [...board.hand];
  while (amount-- > 0 && deck.length) { const id = deck.pop(); if (id) hand.push(id); }
  return { ...board, deck, hand };
}

function discard(board: CharacterRuntimeBoard, amount: number, selectedId?: string | null) {
  const hand = [...board.hand];
  const pile = [...board.discard];
  while (amount-- > 0 && hand.length) {
    const wanted = selectedId ? hand.indexOf(selectedId) : -1;
    const [id] = hand.splice(wanted >= 0 ? wanted : 0, 1);
    if (id) pile.push(id);
  }
  return { ...board, hand, discard: pile };
}

const cycle = (board: CharacterRuntimeBoard, draws = 1, discards = 1, selectedId?: string | null) => discard(draw(board, draws), discards, selectedId);
const idFor = (effect: CharacterStructuredEffect) => String(effect.id ?? effect.resolver ?? "character-effect");

function usage(board: CharacterRuntimeBoard, effect: CharacterStructuredEffect) {
  const scope = characterUsageScope(String(effect.resolver ?? ""));
  if (scope === "turn") return board.usedCharacterEffectIdsThisTurn ?? [];
  if (scope === "round") return board.usedCharacterEffectIdsThisRound ?? [];
  if (scope === "game") return board.usedCharacterEffectIdsThisGame ?? [];
  return [];
}

function isAvailable(board: CharacterRuntimeBoard, effect: CharacterStructuredEffect, event: CharacterRuntimeEventType) {
  const resolver = String(effect.resolver ?? "");
  return Boolean(resolver)
    && (resolverEvents[resolver] ?? []).includes(event)
    && greenCharacterAbilityUnlocked(resolver, board.belt)
    && !usage(board, effect).includes(idFor(effect));
}

function consume(board: CharacterRuntimeBoard, effect: CharacterStructuredEffect) {
  const scope = characterUsageScope(String(effect.resolver ?? ""));
  if (scope === "none") return board;
  const key = scope === "turn" ? "usedCharacterEffectIdsThisTurn" : scope === "round" ? "usedCharacterEffectIdsThisRound" : "usedCharacterEffectIdsThisGame";
  const current = usage(board, effect);
  const id = idFor(effect);
  return { ...board, [key]: current.includes(id) ? current : [...current, id] };
}

function makeChoice(effect: CharacterStructuredEffect, prompt: string, options: string[], optional = true): CharacterRuntimeChoice {
  return { resolver: String(effect.resolver ?? ""), effectId: idFor(effect), prompt, options, optional };
}

function conditionalPowerSatisfied(effect: CharacterStructuredEffect, board: CharacterRuntimeBoard, event: Partial<CharacterRuntimeEvent>) {
  const kinds = new Set((effect.conditions ?? []).map((condition) => condition.kind));
  if (kinds.has("firstAttackThisTurn") && !(event.firstAttackThisTurn ?? board.attacksThisTurn === 0)) return false;
  if (kinds.has("playedKataThisTurn") && !event.playedKataEarlierThisTurn) return false;
  if (kinds.has("wasHitSinceLastTurn") && !board.wasHitSinceLastTurn) return false;
  return true;
}

export function resetCharacterTurn(board: CharacterRuntimeBoard) {
  const nextMarks = markMap(board);
  for (const key of Object.keys(nextMarks)) if (key.startsWith("turn:")) delete nextMarks[key];
  return { ...board, usedCharacterEffectIdsThisTurn: [], characterMarks: nextMarks };
}

export function resetCharacterRound(board: CharacterRuntimeBoard) {
  const nextMarks = markMap(board);
  for (const key of Object.keys(nextMarks)) if (key.startsWith("turn:") || key.startsWith("round:")) delete nextMarks[key];
  return { ...board, usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [], characterMarks: nextMarks };
}

export function characterCanEquip(board: CharacterRuntimeBoard, card: CharacterRuntimeCard) {
  const restricted = effectsFor(board.fighterId).some((effect) => effect.resolver === "character.cannotEquipWeapons" && greenCharacterAbilityUnlocked(String(effect.resolver), board.belt));
  return !(restricted && (card.subtype === "Weapon" || hasTag(card, "Weapon")));
}

export function characterAllowedAttackZones(board: CharacterRuntimeBoard, card: CharacterRuntimeCard, printedZones: string[]) {
  const zones = new Set(printedZones);
  const all = ["High", "Mid", "Low"];
  if (board.nextAttackAnyZone) all.forEach((zone) => zones.add(zone));
  for (const effect of effectsFor(board.fighterId)) {
    if (!isAvailable(board, effect, "attackDeclared")) continue;
    const resolver = String(effect.resolver ?? "");
    const first = board.attacksThisTurn === 0;
    if (resolver === "character.firstSpinAttackRound" && first && hasTag(card, "Spin")) all.forEach((zone) => zones.add(zone));
    if (resolver === "character.firstHighAttackToMid" && first && printedZones.includes("High")) zones.add("Mid");
    if (["character.declaredAttackZoneChange", "character.discardToChangeDeclaredZone", "character.afterAttackDifferentZone"].includes(resolver)) all.forEach((zone) => zones.add(zone));
  }
  return [...zones];
}

export function characterPurchasePrice(board: CharacterRuntimeBoard, printedPrice: number) {
  const effect = effectsFor(board.fighterId).find((entry) => entry.resolver === "character.marketDiscountFloor" && isAvailable(board, entry, "purchaseAttempt"));
  return effect && printedPrice >= 5 ? Math.max(4, printedPrice - Math.max(1, Number(effect.amount ?? 1))) : printedPrice;
}

export function characterAttackModifier(board: CharacterRuntimeBoard, opponent: CharacterRuntimeBoard, card: CharacterRuntimeCard, event: Partial<CharacterRuntimeEvent> = {}) {
  let power = 0;
  let damage = 0;
  const notes: string[] = [];
  const first = event.firstAttackThisTurn ?? board.attacksThisTurn === 0;
  for (const effect of effectsFor(board.fighterId)) {
    if (!isAvailable(board, effect, "attackDeclared")) continue;
    const resolver = String(effect.resolver ?? "");
    const amount = Number(effect.amount ?? 1);
    if (resolver === "character.firstAttackAfterConsumable" && first && (event.usedConsumableThisTurn ?? board.usedConsumableThisRound)) { power += amount; notes.push("Character: first Attack after Consumable +1 Attack Power"); }
    if (resolver === "character.firstKickDifferentZone" && first && hasTag(card, "Kick") && event.differentZoneFromPreviousAttack) { power += amount; notes.push("Character: different-zone Kick +1 Attack Power"); }
    if (resolver === "character.firstUnarmedAttack" && first && !event.hasWeaponEquipped) { power += amount; notes.push("Character: first unarmed Attack +1 Attack Power"); }
    if (resolver === "character.conditionalAttackPower" && conditionalPowerSatisfied(effect, board, event)) { power += amount; notes.push("Character: conditional first Attack +1 Attack Power"); }
    if (resolver === "character.green.linkedZoneChangePower" && event.changedZone) { power += amount; notes.push("Character: changed-zone Attack +1 Attack Power"); }
    if (resolver === "character.green.linkedRecycleLowAttack" && hasMark(board, "turn:recycledJunk") && event.zone === "Low") { power += amount; notes.push("Character: recycled Junk powers Low Attack +1"); }
  }
  return { power, damage, notes };
}

export function characterDamageReduction(board: CharacterRuntimeBoard, incomingDamage: number) {
  let self = board;
  let damage = incomingDamage;
  const notes: string[] = [];
  for (const effect of effectsFor(board.fighterId)) {
    if (!isAvailable(self, effect, "damageIncoming") || damage <= 0) continue;
    const resolver = String(effect.resolver ?? "");
    const amount = Math.max(0, Number(effect.amount ?? 1));
    if (resolver === "character.damageThreshold" && damage >= 4 || resolver === "character.firstHitDamagePrevention") {
      damage = Math.max(0, damage - amount);
      self = mark(consume(self, effect), "round:preventedHit");
      notes.push("Character reduces the Hit by 1");
    }
  }
  return { board: self, damage, notes };
}

export function applyCharacterRuntimeEvent(selfInput: CharacterRuntimeBoard, opponentInput: CharacterRuntimeBoard, eventInput: CharacterRuntimeEvent, actor: CharacterRuntimeActor = "player"): CharacterRuntimeResult {
  let self = selfInput;
  let opponent = opponentInput;
  let event = { ...eventInput };
  const choices: CharacterRuntimeChoice[] = [];
  const notes: string[] = [];

  for (const effect of effectsFor(self.fighterId)) {
    if (!isAvailable(self, effect, event.type)) continue;
    const resolver = String(effect.resolver ?? "");
    const amount = Number(effect.amount ?? 1);
    let activated = false;

    switch (resolver) {
      case "character.reversalAfterBlock":
        if (event.blocked !== false) { self = { ...self, reversalAttackBonus: (self.reversalAttackBonus ?? 0) + amount }; activated = true; }
        break;
      case "character.speedChangeNextAttackZone": self = { ...self, nextAttackAnyZone: true }; activated = true; break;
      case "character.green.linkedChangedAttackHit":
        if (event.changedZone || hasMark(self, "turn:changedAttack")) { self = { ...self, focus: self.focus + amount }; activated = true; }
        break;
      case "character.incomingAttackSlowChoice": {
        const accept = event.optionalAccepted ?? (actor === "ai" ? true : undefined);
        if (accept === undefined) choices.push(makeChoice(effect, "Lose 1 Speed until end of round to reduce this Attack by 1 Power?", ["accept", "skip"]));
        else if (accept) { self = mark({ ...self, tempSpeed: self.tempSpeed - 1 }, "round:reducedIncomingAttack"); event.attackPower = Math.max(0, Number(event.attackPower ?? 0) - 1); activated = true; }
        break;
      }
      case "character.green.linkedReducedAttackBlockCycle":
        if ((event.blocked ?? true) && hasMark(self, "round:reducedIncomingAttack")) { self = cycle(self, 1, 1, event.selectedId); activated = true; }
        break;
      case "character.discardOutsideHideNextAttack":
        if (event.discardedOutsideHide) { self = mark({ ...self, nextAttackBonus: self.nextAttackBonus + amount }, "turn:discardPoweredAttack"); activated = true; }
        break;
      case "character.green.linkedAttackHitRecycle":
        if (hasMark(self, "turn:discardPoweredAttack") && event.selectedId && self.discard.includes(event.selectedId)) { const pile = [...self.discard]; pile.splice(pile.indexOf(event.selectedId), 1); self = { ...self, discard: pile, deck: [event.selectedId, ...self.deck] }; activated = true; }
        break;
      case "character.opponentModificationCycle":
        if (event.opponentModifiedCard) { self = mark(cycle(self, 1, 1, event.selectedId), "round:modifiedCardType", event.card?.cardType ?? ""); activated = true; }
        break;
      case "character.green.repeatModifiedCardTypeBonus":
        if (markMap(self)["round:modifiedCardType"] === event.card?.cardType) {
          if (event.card?.cardType === "Attack") self = { ...self, nextAttackBonus: self.nextAttackBonus + amount };
          else if (event.card?.cardType === "Defense") self = { ...self, nextDefenseCardBonus: (self.nextDefenseCardBonus ?? 0) + amount };
          activated = true;
        }
        break;
      case "character.marketDiscountFloor":
        if (Number(event.modifierBonus ?? 0) < 0) activated = true;
        break;
      case "character.damageThreshold":
      case "character.firstHitDamagePrevention": {
        const reduced = characterDamageReduction(self, Number(event.damage ?? 0));
        if (reduced.damage !== Number(event.damage ?? 0)) { self = reduced.board; event.damage = reduced.damage; notes.push(...reduced.notes); }
        break;
      }
      case "character.green.delayedDamagePreventionFocus":
        if (hasMark(self, "round:preventedHit")) { self = { ...self, nextInitiateFocus: (self.nextInitiateFocus ?? 0) + amount }; activated = true; }
        break;
      case "character.forcedJunkDiscardDestroyChoice":
      case "character.discardJunkDestroyChoice": {
        if (!event.discardedJunk || !event.selectedId) break;
        const accept = event.optionalAccepted ?? (actor === "ai" ? true : undefined);
        if (accept === undefined) choices.push(makeChoice(effect, "Destroy the Junk instead of discarding it?", [event.selectedId, "skip"]));
        else if (accept) { const pile = [...self.discard]; const index = pile.indexOf(event.selectedId); if (index >= 0) pile.splice(index, 1); self = mark({ ...self, discard: pile, destroyed: [...(self.destroyed ?? []), event.selectedId] }, "round:destroyedJunk"); activated = true; }
        break;
      }
      case "character.green.linkedJunkDestroyCycle":
        if (event.destroyedJunk || hasMark(self, "round:destroyedJunk")) { self = cycle(self, 1, 1, event.selectedId); activated = true; }
        break;
      case "character.twoZoneSpeed": {
        const zones = new Set([...self.zonesPlayed, String(event.zone ?? "")].filter(Boolean));
        if (zones.size >= 2) { self = mark({ ...self, tempSpeed: self.tempSpeed + amount }, "round:twoZoneSpeed"); activated = true; }
        break;
      }
      case "character.green.linkedSpeedTempoFlow":
        if (hasMark(self, "round:twoZoneSpeed")) { self = { ...self, nextAttackHasFlow: true }; activated = true; }
        break;
      case "character.declaredAttackZoneChange":
      case "character.firstHighAttackToMid":
      case "character.discardToChangeDeclaredZone":
      case "character.firstSpinAttackRound": {
        const first = event.firstAttackThisTurn ?? self.attacksThisTurn === 0;
        if (resolver === "character.firstHighAttackToMid" && !first) break;
        if (resolver === "character.firstSpinAttackRound" && (!first || !hasTag(event.card, "Spin"))) break;
        const changed = Boolean(event.selectedZone && event.selectedZone !== event.printedZone);
        if (resolver === "character.discardToChangeDeclaredZone" && changed) {
          if (!event.selectedId || !self.hand.includes(event.selectedId)) { choices.push(makeChoice(effect, "Discard a card to change the declared Attack zone.", self.hand)); break; }
          self = discard(self, 1, event.selectedId);
        }
        if (changed) { event.changedZone = true; self = mark(self, "turn:changedAttack"); activated = true; }
        break;
      }
      case "character.green.linkedZoneChangePower":
        if (event.changedZone) { event.attackPower = Number(event.attackPower ?? 0) + amount; activated = true; }
        break;
      case "character.xpTrailFirstHit":
        if ((event.firstAttackThisTurn ?? self.attacksThisTurn === 0) && opponent.xp > self.xp) { event.damage = Number(event.damage ?? 0) + amount; activated = true; }
        break;
      case "character.firstAttackAfterConsumable":
        if ((event.firstAttackThisTurn ?? self.attacksThisTurn === 0) && (event.usedConsumableThisTurn ?? self.usedConsumableThisRound)) { event.attackPower = Number(event.attackPower ?? 0) + amount; self = mark(self, "turn:consumableAttack"); activated = true; }
        break;
      case "character.green.linkedAttackHitPenalty":
        if (hasMark(self, "turn:consumableAttack")) { opponent = { ...opponent, nextAttackBonus: opponent.nextAttackBonus - amount }; activated = true; }
        break;
      case "character.green.linkedChangedAttackHitCycle":
        if (event.changedZone || hasMark(self, "turn:changedAttack")) { self = cycle(self, 1, 1, event.selectedId); activated = true; }
        break;
      case "character.ignoreTemporaryAttackBonusesOnceGame": {
        const accept = event.optionalAccepted ?? (actor === "ai" ? true : undefined);
        if (accept === undefined) choices.push(makeChoice(effect, "Ignore temporary Attack bonuses for this strike?", ["accept", "skip"]));
        else if (accept) { event.attackPower = Math.max(0, Number(event.attackPower ?? 0) - Math.max(0, Number(event.modifierBonus ?? 0))); activated = true; }
        break;
      }
      case "character.noNumericEffectNextAttack":
        if (event.noPrintedNumericEffect) { self = mark({ ...self, nextAttackBonus: self.nextAttackBonus + amount }, "turn:noNumericAttack"); activated = true; }
        break;
      case "character.green.linkedAttackHitFocus":
        if (hasMark(self, "turn:noNumericAttack")) { self = { ...self, focus: self.focus + amount }; activated = true; }
        break;
      case "character.junkDiscardToBottomCycle":
        if (event.discardedJunk && event.selectedId && self.discard.includes(event.selectedId)) { const pile = [...self.discard]; pile.splice(pile.indexOf(event.selectedId), 1); self = mark(cycle({ ...self, discard: pile, deck: [event.selectedId, ...self.deck] }, 1, 1, event.selectedMode), "turn:recycledJunk"); activated = true; }
        break;
      case "character.green.linkedRecycleLowAttack":
        if (hasMark(self, "turn:recycledJunk") && event.zone === "Low") { event.attackPower = Number(event.attackPower ?? 0) + amount; activated = true; }
        break;
      case "character.firstKickDifferentZone":
        if ((event.firstAttackThisTurn ?? self.attacksThisTurn === 0) && hasTag(event.card, "Kick") && event.differentZoneFromPreviousAttack) { event.attackPower = Number(event.attackPower ?? 0) + amount; self = mark(self, "turn:kickBonus"); activated = true; }
        break;
      case "character.green.linkedKickHitSpeed":
        if (hasMark(self, "turn:kickBonus")) { self = { ...self, tempSpeed: self.tempSpeed + amount }; activated = true; }
        break;
      case "character.cannotEquipWeapons": if (event.card && !characterCanEquip(self, event.card)) { self = mark(self, "round:equipRejected", event.card.id); activated = true; } break;
      case "character.firstUnarmedAttack":
        if ((event.firstAttackThisTurn ?? self.attacksThisTurn === 0) && !event.hasWeaponEquipped) { event.attackPower = Number(event.attackPower ?? 0) + amount; activated = true; }
        break;
      case "character.speedChangeCycle": self = cycle(self, 1, 1, event.selectedId); activated = true; break;
      case "character.comboRevealChoice": {
        const options = event.revealIds ?? [];
        if (options.length >= 2) { const selected = event.selectedId ?? (actor === "ai" ? options[0] : null); if (!selected) choices.push(makeChoice(effect, "Choose one revealed Combo to attempt to learn.", options, false)); else { event.selectedId = selected; activated = true; } }
        break;
      }
      case "character.firstKataDefenseZone":
        if (event.firstKataThisTurn) { const zone = event.selectedZone ?? (actor === "ai" ? "Mid" : null); if (!zone) choices.push(makeChoice(effect, "Choose the additional zone for your next Defense.", ["High", "Mid", "Low"], false)); else { self = mark(self, "turn:nextDefenseExtraZone", zone); activated = true; } }
        break;
      case "character.revealConsumableCycle": {
        const options = event.candidateIds ?? [];
        const selected = event.selectedId ?? (actor === "ai" ? options[0] : null);
        if (options.length && !selected) choices.push(makeChoice(effect, "Reveal a Consumable to draw 1 then discard 1?", [...options, "skip"]));
        else if (selected && selected !== "skip") { self = cycle(self, 1, 1, event.selectedMode); activated = true; }
        break;
      }
      case "character.noWeaponOffenseDefenseChoice": {
        if (event.hasWeaponEquipped) break;
        const selected = event.selectedMode ?? (actor === "ai" ? "attack" : null);
        if (!selected) choices.push(makeChoice(effect, "Choose your first-card bonus this round.", ["attack", "defense"], false));
        else { self = mark(self, "round:mimenMode", selected); self = selected === "attack" ? { ...self, nextAttackBonus: self.nextAttackBonus + 1 } : { ...self, nextDefenseCardBonus: (self.nextDefenseCardBonus ?? 0) + 1 }; activated = true; }
        break;
      }
      case "character.green.linkedChosenCardOutcomeCycle": {
        const mode = markMap(self)["round:mimenMode"];
        if (mode === "attack" && event.type === "hit" || mode === "defense" && event.type === "block") { self = cycle(self, 1, 1, event.selectedId); activated = true; }
        break;
      }
      case "character.equipFromHandNextDefense": self = mark({ ...self, nextDefenseCardBonus: (self.nextDefenseCardBonus ?? 0) + amount }, "round:clipEquip"); activated = true; break;
      case "character.linkedDefenseBlockCycle": if (hasMark(self, "round:clipEquip") && (event.blocked ?? true)) { self = cycle(self, 1, 1, event.selectedId); activated = true; } break;
      case "character.firstKataSpeed": if (event.firstKataThisTurn) { self = { ...self, tempSpeed: self.tempSpeed + amount }; activated = true; } break;
      case "character.green.secondKataCycle": if (event.secondKataThisTurn) { self = { ...cycle(self, 1, 1, event.selectedId), focus: self.focus + 1 }; activated = true; } break;
      case "character.conditionalAttackPower":
        if (conditionalPowerSatisfied(effect, self, event)) { event.attackPower = Number(event.attackPower ?? 0) + amount; self = mark(self, "turn:conditionalAttack"); activated = true; }
        break;
      case "character.green.linkedAttackHitRewardChoice":
        if (hasMark(self, "turn:conditionalAttack")) { const mode = event.selectedMode ?? (actor === "ai" ? "focus" : null); if (!mode) choices.push(makeChoice(effect, "Choose the Hit reward.", ["cycle", "focus"], false)); else if (mode === "focus") { self = { ...self, focus: self.focus + 1 }; activated = true; } else { self = cycle(self, 1, 1, event.selectedId); activated = true; } }
        break;
      case "character.revealReplacementOnceGame": {
        const accept = event.optionalAccepted ?? (actor === "ai" ? true : undefined);
        if (accept === undefined) choices.push(makeChoice(effect, "Discard this reveal and replace it from the same deck?", ["accept", "skip"]));
        else if (accept && event.replacementId) { event.selectedId = event.replacementId; activated = true; }
        break;
      }
      case "character.equipDiscardPermanentUntilHide": {
        const options = event.candidateIds ?? [];
        const selected = event.selectedId ?? (actor === "ai" ? options[0] : null);
        if (options.length && !selected) choices.push(makeChoice(effect, "Equip a permanent Item/Gear from your discard until Hide?", [...options, "skip"]));
        else if (selected && selected !== "skip" && self.discard.includes(selected)) { const pile = [...self.discard]; pile.splice(pile.indexOf(selected), 1); self = { ...self, discard: pile, equipment: [...self.equipment, selected], borrowedEquipmentId: selected }; activated = true; }
        break;
      }
      case "character.green.linkedPreventedHitRetaliation": if (hasMark(self, "round:preventedHit")) { self = { ...self, nextAttackBonus: self.nextAttackBonus + amount }; activated = true; } break;
      case "character.secondKickNextKickFlow": {
        const count = Number(markMap(self)["turn:kickCount"] ?? 0) + (hasTag(event.card, "Kick") ? 1 : 0); self = mark(self, "turn:kickCount", count); if (count === 2) { self = { ...self, nextAttackHasFlow: true }; activated = true; } break;
      }
      case "character.noCombatDamagePreviousTurnCycle": if (event.noCombatDamagePreviousTurn) { self = cycle(self, 1, 1, event.selectedId); activated = true; } break;
      case "character.examRequirementSpeed": if (event.completedBeltExam) { self = { ...self, tempSpeed: self.tempSpeed + amount }; activated = true; } break;
      case "character.green.promotionCycle": self = cycle(self, 2, 1, event.selectedId); activated = true; break;
      case "character.reduceLargeAttackModifier": if (Number(event.modifierBonus ?? 0) >= 2) { event.attackPower = Math.max(0, Number(event.attackPower ?? 0) - amount); self = mark(self, "round:nerfhammerReduced"); activated = true; } break;
      case "character.green.linkedReductionRetaliation": if (hasMark(self, "round:nerfhammerReduced")) { self = { ...self, nextAttackBonus: self.nextAttackBonus + amount }; activated = true; } break;
      case "character.exhaustReadyEquipmentLock": {
        const options = event.candidateIds ?? self.equipment; const selected = event.selectedId ?? (actor === "ai" ? options[0] : null);
        if (options.length && !selected) choices.push(makeChoice(effect, "Choose Equipment to exhaust then immediately ready.", options, false));
        else if (selected && self.equipment.includes(selected)) { self = mark(self, `turn:rebootLocked:${selected}`); activated = true; }
        break;
      }
      case "character.green.linkedRebootCycle": if (Object.keys(markMap(self)).some((key) => key.startsWith("turn:rebootLocked:"))) { self = cycle(self, 1, 1, event.selectedMode); activated = true; } break;
      case "character.thirdDifferentCardTypeCycle": if (event.thirdDifferentCardTypeThisTurn) { self = cycle(self, 1, 1, event.selectedId); activated = true; } break;
      case "character.afterAttackDifferentZone": if (event.card?.cardType === "Attack") { self = { ...self, nextAttackAnyZone: true }; activated = true; } break;
      case "character.sceneChangeCycle": if (event.sceneChanged !== false) { self = cycle(self, 1, 1, event.selectedId); activated = true; } break;
      default: break;
    }

    if (activated) { self = consume(self, effect); notes.push(resolver); }
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
      events: [...new Set((card.effects ?? []).flatMap((effect) => resolverEvents[String(effect.resolver ?? "")] ?? []))],
    }));
}
