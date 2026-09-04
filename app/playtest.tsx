import { useEffect, useMemo, useState } from "react";
import cardPlaceholderUrl from "./assets/art/card-placeholder-v2.webp";
import starterJabArtUrl from "./assets/starter/starter-jab-art-v2.webp";
import highGuardArtUrl from "./assets/starter/high-guard-art-v2.webp";
import cardsJson from "./data/cards.json";
import gameDefinitionJson from "./data/game-definition.json";
import rulesJson from "./data/rules.json";
import { compileCardEffects, describeEffectPlan } from "./card-effects";
import { afterDefenseNextAttackBonus, attackCanChooseAnyZone, attackPiercing, conditionalAttackPowerBonus, conditionalDefenseGuardBonus, conditionalHealAfterHit, defenseEquipmentBonus, destroyJunkChoiceCount, destroysAfterUse, equipmentConditionalAttackPowerBonus, equipmentPiercing, equipmentSpeedModifier, firstIncomingAttackPowerPenalty, locationAttackRuleModifiers, optionalDiscardDrawChoice, passiveEquipmentGuard, targetNextAttackPenalty, targetNextDefensePenalty, targetSpeedPenaltyUntilHonor } from "./effect-resolvers";
import { comboPayoffText, comboRequirementText, evaluateCombo } from "./combo-engine";
import "./combo-rack.css";
import "./playtest-board-v4.css";
import { fetchRulesManifest, rulesSyncState, type RulesSyncState } from "./rules-client";

type CardEntry = {
  id: string;
  name: string;
  cardType: string;
  subtype: string;
  category?: string | null;
  catalogId: string;
  deck: string;
  fpCost?: string | number | null;
  focusValue?: string | number | null;
  zone?: string | null;
  timing?: string | null;
  rulesText?: string | null;
  flavorText?: string | null;
  tags: string[];
  stats: Record<string, string | number>;
  image?: string | null;
  details: Record<string, string | number>;
};

type Board = {
  fighterId: string;
  hp: number;
  maxHp: number;
  xp: number;
  focus: number;
  belt: number;
  deck: string[];
  hand: string[];
  discard: string[];
  playArea: string[];
  equipment: string[];
  tempSpeed: number;
  nextAttackBonus: number;
  attacksThisTurn: number;
  attacksReceivedThisRound?: number;
  speedChangedThisRound?: boolean;
  nextDefenseCardBonus?: number;
  defensePracticeUsed: boolean;
  flowUsedThisTurn: boolean;
  nextAttackHasFlow: boolean;
  flowAfterFirstAttack: boolean;
  hitThisTurn: boolean;
  cardsThisTurn: string[];
  tempo: boolean;
  attackedThisRound: boolean;
  defendedThisRound: boolean;
  zonesPlayed: string[];
  purchasedTypes: string[];
  comboTriggered: boolean;
  completedTasks: number[];
  statBoost: number;
  damageReductionUsed: boolean;
  wasHitSinceLastTurn: boolean;
  borrowedEquipmentId: string | null;
  abilityUsedRound: boolean;
  reversalUsedRound: boolean;
  learnedCombos: string[];
  triggeredCombos: string[];
  comboAttemptedTurn: boolean;
  damageDealt: number;
  damageTaken: number;
  cardsBought: number;
  destroyed?: string[];
};

type PendingStrike = {
  cardId: string;
  zone: string;
  attackPower: number;
  damageModifier: number;
  piercing?: number;
  modifierNotes: string[];
  remainingAiAttacks: string[];
};

type PendingDiscard = {
  sourceCardId: string;
  remaining: number;
};

type PendingChoice =
  | { kind: "destroy-junk"; sourceCardId: string; remaining: number }
  | { kind: "discard-draw"; sourceCardId: string; remaining: number; draw: number };

type Match = {
  schema: 6;
  rulesVersion: string;
  player: Board;
  ai: Board;
  market: string[];
  marketDeck: string[];
  marketDiscard: string[];
  marketPurchasedThisRound: boolean;
  comboDeck: string[];
  comboOfferId: string | null;
  locations: string[];
  locationId: string;
  round: number;
  phase: "player-initiate" | "player-yell" | "player-ascend" | "ai-ready" | "defense-window" | "reversal-window";
  turnOrder: ["player" | "ai", "player" | "ai"];
  turnIndex: 0 | 1;
  selectedAttackId: string | null;
  selectedZone: string;
  pendingStrike: PendingStrike | null;
  pendingDiscard: PendingDiscard | null;
  pendingChoice?: PendingChoice | null;
  reversalRemainingAiAttacks: string[];
  log: string[];
  winner: "player" | "ai" | null;
};

type Difficulty = "student" | "certified" | "master";
type HouseSettings = { tempo: boolean; locations: boolean; openMarket: boolean; guided: boolean; autoAi: boolean; balancedMarket: boolean; difficulty: Difficulty };
type DeskView = "market" | "combo" | "belt";

const cards = (cardsJson as unknown as { cards: CardEntry[] }).cards;
const byId = new Map(cards.map((card) => [card.id, card]));
const byCatalogId = new Map(cards.map((card) => [card.catalogId, card]));
const gameDefinition = gameDefinitionJson as unknown as {
  rulesVersion: string;
  rulesRevision: string;
  mode: { startingHp: number };
  turn: { handSize: number };
  starterDeck: { catalogId: string; copies: number }[];
  economy: { defensePractice: { usesPerTurn: number }; market: { rowSize: number; refill: string; stagnationRefresh: string } };
};
const activeRulesRevision = gameDefinition.rulesRevision;
const characters = cards.filter((card) => card.cardType === "Character");
const starterIds = gameDefinition.starterDeck.flatMap(({ catalogId, copies }) => {
  const id = byCatalogId.get(catalogId)?.id;
  return id ? Array.from({ length: copies }, () => id) : [];
});
const marketPool = cards.filter((card) => card.cardType === "Technique" || card.cardType === "Item");
const comboPool = cards.filter((card) => card.cardType === "Combo");
const locationPool = cards.filter((card) => card.cardType === "Location");
const QUICK_DUEL_LOCATION_NAMES = new Set([
  "City Bus in Motion",
  "Community Ice Rink",
  "Concrete Stairwell",
  "Parking Garage Spiral",
  "Public Library",
  "Rain-Slick Alley",
  "River Dock",
  "School Gymnasium",
  "Strip-Mall McDojo",
  "Tournament Mat",
  "Traditional Dojo",
  "Yoga Studio",
]);
const quickDuelLocationPool = locationPool.filter((card) => QUICK_DUEL_LOCATION_NAMES.has(card.name));
const beltTable = (rulesJson as unknown as { chapters: { sections?: { id: string; content: { kind: string; rows?: (string | number)[][] }[] }[] }[] }).chapters
  .flatMap((chapter) => chapter.sections ?? [])
  .find((section) => section.id === "belt-table")?.content
  .find((entry) => entry.kind === "table")?.rows ?? [];
const belts = beltTable.slice(1).map(([name, xp, task, reward]) => ({ name: String(name), xp: Number(xp), task: String(task), reward: String(reward) }));
const DIFFICULTIES: Record<Difficulty, { label: string; eyebrow: string; detail: string; aiHp: number; statBoost: number }> = {
  student: { label: "Student", eyebrow: "Learn the mat", detail: "A shorter duel with a less ruthless opponent.", aiHp: 20, statBoost: 0 },
  certified: { label: "Certified", eyebrow: "Core test", detail: "The intended Quick Duel pressure with the complete hand economy.", aiHp: 25, statBoost: 0 },
  master: { label: "Grandmaster", eyebrow: "Bad decision", detail: "More HP, sharper stats, and no sympathy from the clipboard.", aiHp: 35, statBoost: 1 },
};

const cardArtModules = import.meta.glob<string>("./assets/cards/{attacks,defenses,katas,consumables,defense-equipment,gear,characters}/*.webp", { eager: true, query: "?url", import: "default" });
const CARD_ART = Object.fromEntries(Object.entries(cardArtModules).map(([path, url]) => [`/cards/${path.split("/cards/")[1]}`, url]));
const COMPLETE_CARD_ART_BY_CATALOG_ID = Object.fromEntries(
  Object.entries(cardArtModules).flatMap(([path, url]) => {
    const match = path.match(/\/(ddb-(?:atk|def|kat|con|deq)-core-\d{3})_/i);
    return match ? [[match[1].toUpperCase(), url]] : [];
  }),
);

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}

function numberValue(value: string | number | null | undefined) {
  const match = String(value ?? "").match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function cardFor(id: string) { return byId.get(id); }
function cardType(card: CardEntry) { return String(card.details.Type ?? card.subtype ?? "").toLowerCase(); }
function cardPower(card: CardEntry) { return numberValue(card.stats["Attack Power"] ?? card.stats.Guard ?? card.stats["Power / Guard"] ?? card.stats.Power); }
function isAttack(card: CardEntry) { return cardType(card) === "attack" || card.subtype === "Attack" || card.catalogId.includes("-ATK-"); }
function isDefense(card: CardEntry) { return cardType(card) === "defense" || card.subtype === "Defense" || card.catalogId.includes("-DEF-"); }
function isKata(card: CardEntry) { return cardType(card) === "kata" || card.subtype === "Kata" || card.catalogId.includes("-KAT-"); }
function isPermanent(card: CardEntry) { return ["Weapon", "Gear", "Defense Equipment"].includes(card.subtype); }
function hasTag(card: CardEntry, tag: string) { return card.tags.some((entry) => entry.toLocaleLowerCase().includes(tag.toLocaleLowerCase())); }
function isWeapon(card: CardEntry) { return card.subtype === "Weapon"; }
function matchesZone(card: CardEntry, zone: string) { return (card.zone ?? "").toLocaleLowerCase().includes("any") || (card.zone ?? "").toLocaleLowerCase().includes(zone.toLocaleLowerCase()); }
function removeOne(items: string[], id: string) { const index = items.indexOf(id); return index < 0 ? items : [...items.slice(0, index), ...items.slice(index + 1)]; }
function isJunk(card: CardEntry | undefined) { return Boolean(card && (card.subtype === "Junk" || card.cardType === "Junk" || hasTag(card, "Junk"))); }
function cardCost(card: CardEntry | undefined) { return numberValue(card?.fpCost); }
function cardFocus(card: CardEntry | undefined) { return numberValue(card?.focusValue); }

function curateOpeningMarket(ids: string[], balanced: boolean) {
  if (!balanced) return { market: ids.slice(0, gameDefinition.economy.market.rowSize), marketDeck: ids.slice(gameDefinition.economy.market.rowSize) };
  const affordable = ids.filter((id) => cardCost(cardFor(id)) <= 3);
  const accessibleTypes = [
    affordable.find((id) => isAttack(cardFor(id)!)),
    affordable.find((id) => isDefense(cardFor(id)!)),
    affordable.find((id) => isKata(cardFor(id)!)),
  ].filter((id): id is string => Boolean(id));
  const market = [...new Set(accessibleTypes)];
  for (const id of ids) {
    if (market.length >= gameDefinition.economy.market.rowSize) break;
    if (!market.includes(id)) market.push(id);
  }
  return { market, marketDeck: ids.filter((id) => !market.includes(id)) };
}

function revealMarketCards(marketDeck: string[], marketDiscard: string[], count: number) {
  let deck = [...marketDeck];
  let discard = [...marketDiscard];
  const revealed: string[] = [];
  while (revealed.length < count) {
    if (!deck.length && discard.length) {
      deck = shuffle(discard);
      discard = [];
    }
    const next = deck.shift();
    if (!next) break;
    revealed.push(next);
  }
  return { revealed, marketDeck: deck, marketDiscard: discard };
}

function refillPurchasedMarketSlot(market: string[], marketDeck: string[], marketDiscard: string[], slot: number) {
  const refill = revealMarketCards(marketDeck, marketDiscard, 1);
  const nextMarket = [...market];
  nextMarket[slot] = refill.revealed[0] ?? "";
  return { market: nextMarket.filter(Boolean), marketDeck: refill.marketDeck, marketDiscard: refill.marketDiscard };
}

function refreshMarketRow(market: string[], marketDeck: string[], marketDiscard: string[]) {
  let deck = [...marketDeck];
  let discard = [...marketDiscard, ...market.filter(Boolean)];
  const nextMarket: string[] = [];
  while (nextMarket.length < gameDefinition.economy.market.rowSize) {
    if (!deck.length && discard.length) {
      deck = shuffle(discard);
      discard = [];
    }
    const next = deck.shift();
    if (!next) break;
    nextMarket.push(next);
  }
  return { market: nextMarket, marketDeck: deck, marketDiscard: discard };
}

type CombatModifier = { value: number; notes: string[] };
type AttackModifier = { power: number; damage: number; notes: string[] };
type ComboModifier = AttackModifier & { focusOnHit: number; grantsFlow: boolean; speedOnTrigger: number; piercing: number; triggeredIds: string[] };

function comboAttackModifier(board: Board, card: CardEntry, zone: string, isReversal = false): ComboModifier {
  const result: ComboModifier = { power: 0, damage: 0, focusOnHit: 0, grantsFlow: false, speedOnTrigger: 0, piercing: 0, triggeredIds: [], notes: [] };
  const priorCards = board.cardsThisTurn.map(cardFor).filter(Boolean) as CardEntry[];
  const equipment = board.equipment.map(cardFor).filter(Boolean) as CardEntry[];
  for (const comboId of board.learnedCombos) {
    if (board.triggeredCombos.includes(comboId)) continue;
    const combo = cardFor(comboId);
    if (!combo) continue;
    const evaluation = evaluateCombo(combo, {
      priorCards,
      attacksThisTurn: board.attacksThisTurn,
      defendedThisRound: board.defendedThisRound,
      hitThisTurn: board.hitThisTurn,
      zonesPlayed: board.zonesPlayed,
      equipment,
      currentCard: card,
      currentZone: zone,
      isReversal,
    });
    if (!evaluation.eligible) continue;
    result.power += evaluation.power;
    result.damage += evaluation.damage;
    result.focusOnHit += evaluation.focusOnHit;
    result.grantsFlow ||= evaluation.grantsFlow;
    result.speedOnTrigger += evaluation.speedOnTrigger;
    result.piercing += evaluation.piercing;
    result.triggeredIds.push(combo.id);
    const payoffBits = [evaluation.power ? `+${evaluation.power} power` : "", evaluation.damage ? `+${evaluation.damage} damage` : "", evaluation.grantsFlow ? "Flow" : "", evaluation.focusOnHit ? `${evaluation.focusOnHit} Focus on Hit` : "", evaluation.speedOnTrigger ? `+${evaluation.speedOnTrigger} Speed` : "", evaluation.piercing ? `Piercing ${evaluation.piercing}` : ""].filter(Boolean);
    result.notes.push(`COMBO — ${combo.name}: ${payoffBits.join(", ")}`);
  }
  return result;
}

function locationAttackModifier(location: CardEntry | undefined, card: CardEntry, board: Board, zone: string): AttackModifier {
  if (!location) return { power: 0, damage: 0, notes: [] };
  const firstAttack = board.attacksThisTurn === 0;
  const equipped = board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));
  const parsed = locationAttackRuleModifiers(location, {
    zone,
    firstAttack,
    attackTags: card.tags,
    hasWeapon: equipped.some(isWeapon),
    equipmentTags: equipped.flatMap((item) => item.tags),
  });
  if (parsed.matched) return { power: parsed.power, damage: parsed.damage, notes: parsed.notes };

  // Legacy fallback for unusual Quick Duel stages whose printed sentence has not
  // yet been generalized. Keep this list small and delete entries as parsers land.
  let power = 0;
  let damage = 0;
  const notes: string[] = [];
  const applyPower = (amount: number, reason: string) => { power += amount; notes.push(`${reason} ${amount > 0 ? "+" : ""}${amount} Attack Power`); };
  if (location.name === "River Dock" && hasTag(card, "Push")) applyPower(2, "dock edge");
  if (location.name === "Yoga Studio") applyPower(-1, "indoor voice");
  return { power, damage, notes };
}

function locationDefenseModifier(location: CardEntry | undefined, card: CardEntry | null | undefined, board: Board, zone: string): CombatModifier {
  if (!location || !card) return { value: 0, notes: [] };
  const firstDefense = !board.defendedThisRound;
  let value = 0;
  const notes: string[] = [];
  const apply = (amount: number, reason: string) => { value += amount; notes.push(`${reason} ${amount > 0 ? "+" : ""}${amount}`); };
  if (location.name === "City Bus in Motion" && (hasTag(card, "Dodge") || hasTag(card, "Movement"))) apply(-1, "moving bus");
  if (location.name === "Community Ice Rink" && hasTag(card, "Dodge")) apply(1, "ice-rink Dodge");
  if (location.name === "River Dock" && zone === "Low") apply(1, "dockside Low Guard");
  if (location.name === "School Gymnasium" && firstDefense) apply(1, "first Defense");
  if (location.name === "Strip-Mall McDojo") apply(-1, "discount instruction");
  if (location.name === "Traditional Dojo" && firstDefense) apply(1, "first Defense");
  return { value, notes };
}

function locationFocusModifier(location: CardEntry | undefined, card: CardEntry, board: Board): CombatModifier {
  const kataAlreadyPlayed = board.cardsThisTurn.some((id) => { const played = cardFor(id); return played ? isKata(played) : false; });
  if (!location || !isKata(card) || kataAlreadyPlayed) return { value: 0, notes: [] };
  if (["Public Library", "Strip-Mall McDojo", "Traditional Dojo", "Yoga Studio"].includes(location.name)) return { value: 1, notes: [`${location.name} first-Kata Focus +1`] };
  return { value: 0, notes: [] };
}

function printedAttackRuleModifier(attacker: Board, defender: Board, card: CardEntry, zone: string): AttackModifier {
  const playedKata = attacker.cardsThisTurn.some((id) => { const prior = cardFor(id); return Boolean(prior && isKata(prior)); });
  const printed = conditionalAttackPowerBonus(card, {
    playedKata,
    firstAttack: attacker.attacksThisTurn === 0,
    matchingArmor: equipmentDefenseModifier(defender, zone).value > 0,
    targetEquipmentCount: defender.equipment.length,
  });
  const equipped = attacker.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));
  const equipment = equipmentConditionalAttackPowerBonus(equipped, {
    firstAttack: attacker.attacksThisTurn === 0,
    attackerSpeed: fighterStat(attacker, "Speed"),
    defenderSpeed: fighterStat(defender, "Speed"),
  });
  return {
    power: printed.amount + equipment.amount,
    damage: 0,
    notes: [...printed.notes, ...(equipment.amount ? [`${equipment.sources.join(" + ")} +${equipment.amount} Attack Power vs faster fighter`] : [])],
  };
}

function attackPiercingModifier(attacker: Board, defender: Board, card: CardEntry, zone: string, comboPiercing = 0) {
  const matchingArmor = equipmentDefenseModifier(defender, zone).value > 0;
  const direct = attackPiercing(card, { matchingArmor, targetEquipmentCount: defender.equipment.length, targetHasExhaustedEquipment: false, speedChangedThisRound: Boolean(attacker.speedChangedThisRound) });
  const equipped = attacker.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));
  const equipment = equipmentPiercing(equipped, { firstAttack: attacker.attacksThisTurn === 0, zone, matchingArmor });
  const value = direct.amount + equipment.amount + comboPiercing;
  const notes = [...direct.notes, ...equipment.sources, ...(comboPiercing ? [`Combo grants Piercing ${comboPiercing}`] : [])];
  return { value, notes };
}

function piercedArmorModifier(armor: CombatModifier, piercing: number): CombatModifier {
  const ignored = Math.min(Math.max(0, piercing), Math.max(0, armor.value));
  return { value: armor.value - ignored, notes: [...armor.notes, ...(ignored ? [`Piercing ${piercing} ignores ${ignored} Armor DEF`] : [])] };
}

function attackHasFlexibleZone(board: Board, card: CardEntry) {
  if (card.zone?.includes("Any")) return true;
  const equipped = board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));
  if (attackCanChooseAnyZone(card, board.attacksThisTurn === 0, equipped)) return true;
  return cardFor(board.fighterId)?.name === "Whirlwind Wynn" && board.attacksThisTurn === 0 && hasTag(card, "Spin");
}

function defenseCardRuleModifier(defender: Board, attacker: Board, defense: CardEntry, incomingAttack: CardEntry): CombatModifier {
  const weaponAttack = hasTag(incomingAttack, "Weapon") || attacker.equipment.some((id) => { const item = cardFor(id); return Boolean(item && isWeapon(item)); });
  const parsed = conditionalDefenseGuardBonus(defense, { weaponAttack, defenderAttackedThisRound: defender.attackedThisRound });
  return { value: parsed.amount, notes: parsed.notes };
}

function fighterAttackModifier(attacker: Board, defender: Board, card: CardEntry): AttackModifier {
  const fighter = cardFor(attacker.fighterId);
  if (!fighter) return { power: 0, damage: 0, notes: [] };
  const firstAttack = attacker.attacksThisTurn === 0;
  if (fighter.name === "El Pollo Rojo" && firstAttack && defender.xp > attacker.xp) return { power: 0, damage: 1, notes: ["El Pollo Rojo refuses to trail +1 damage"] };
  if (fighter.name === "Knuckleton the Brawler" && firstAttack && !attacker.equipment.some((id) => { const item = cardFor(id); return item ? isWeapon(item) : false; })) return { power: 0, damage: 1, notes: ["Knuckleton's first unarmed strike +1 damage"] };
  if (fighter.name === "Wavey Davey" && firstAttack && attacker.wasHitSinceLastTurn) return { power: 0, damage: 1, notes: ["Wavey Davey found the opening +1 damage"] };
  if (fighter.name === "Whirlwind Wynn" && firstAttack && hasTag(card, "Spin")) return { power: 0, damage: 0, notes: ["Whirlwind Wynn opens the Spin zone"] };
  return { power: 0, damage: 0, notes: [] };
}

function reduceDamageForFighter(board: Board, damage: number): { board: Board; damage: number; note: string | null } {
  const fighter = cardFor(board.fighterId);
  if (!fighter || board.damageReductionUsed || damage <= 0) return { board, damage, note: null };
  const protects = fighter.name === "Sentry Bobby" || (fighter.name === "Crash Test Dummy" && damage >= 4);
  if (!protects) return { board, damage, note: null };
  return { board: { ...board, damageReductionUsed: true }, damage: Math.max(0, damage - 1), note: `${fighter.name} reduces the Hit by 1` };
}

function drawCards(board: Board, count: number) {
  let deck = [...board.deck];
  let discard = [...board.discard];
  let hand = [...board.hand];
  for (let index = 0; index < count; index += 1) {
    if (!deck.length && discard.length) { deck = shuffle(discard); discard = []; }
    const next = deck.pop();
    if (next) hand.push(next);
  }
  return { ...board, deck, discard, hand };
}

function fighterStat(board: Board, stat: "ATK" | "DEF" | "Speed") {
  const fighter = cardFor(board.fighterId);
  const beltBonus = stat === "ATK" && board.belt >= 2 ? 1 : stat === "DEF" && board.belt >= 7 ? 1 : 0;
  const base = numberValue(fighter?.stats[stat]);
  const equipment = board.equipment.reduce((total, id) => {
    const card = cardFor(id);
    if (!card) return total;
    if (stat === "ATK") return total + numberValue(card.stats["Attack Bonus"]);
    if (stat === "DEF") return total + passiveEquipmentGuard(card);
    if (stat === "Speed") return total + equipmentSpeedModifier(card);
    return total;
  }, 0);
  const challengeBonus = stat === "ATK" || stat === "DEF" ? board.statBoost ?? 0 : 0;
  return base + beltBonus + equipment + challengeBonus + (stat === "Speed" ? board.tempSpeed : 0);
}

function incomingAttackEquipmentModifier(defender: Board): AttackModifier {
  const equipped = defender.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card));
  const parsed = firstIncomingAttackPowerPenalty(equipped, (defender.attacksReceivedThisRound ?? 0) === 0);
  return {
    power: parsed.amount,
    damage: 0,
    notes: parsed.amount ? [`${parsed.sources.join(" + ")} ${parsed.amount} Attack Power on first incoming Attack`] : [],
  };
}

function equipmentDefenseModifier(board: Board, zone: string): CombatModifier {
  let value = 0;
  const notes: string[] = [];
  for (const id of board.equipment) {
    const card = cardFor(id);
    if (!card) continue;
    const bonus = defenseEquipmentBonus(card, zone);
    if (!bonus) continue;
    value += bonus;
    notes.push(`${card.name} +${bonus} DEF vs ${zone}`);
  }
  return { value, notes };
}

function applyAfterDefenseEquipment(board: Board) {
  const equipped = board.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card));
  const bonus = afterDefenseNextAttackBonus(equipped);
  if (!bonus.amount) return { board, notes: [] as string[] };
  return {
    board: { ...board, nextAttackBonus: board.nextAttackBonus + bonus.amount },
    notes: [`${bonus.sources.join(" + ")} primes next Attack +${bonus.amount}`],
  };
}

function applyTargetHitDebuffs(board: Board, card: CardEntry) {
  const attackPenalty = targetNextAttackPenalty(card);
  const defensePenalty = targetNextDefensePenalty(card);
  const speedPenalty = targetSpeedPenaltyUntilHonor(card);
  const notes: string[] = [];
  let next = board;
  if (attackPenalty) {
    next = { ...next, nextAttackBonus: next.nextAttackBonus - attackPenalty };
    notes.push(`target next Attack -${attackPenalty} Attack Power`);
  }
  if (defensePenalty) {
    next = { ...next, nextDefenseCardBonus: (next.nextDefenseCardBonus ?? 0) - defensePenalty };
    notes.push(`target next Defense card -${defensePenalty} Guard`);
  }
  if (speedPenalty) {
    next = { ...next, tempSpeed: next.tempSpeed - speedPenalty, speedChangedThisRound: true };
    notes.push(`target -${speedPenalty} Speed until Honor`);
  }
  return { board: next, notes };
}

function destroyResolvedConsumable(board: Board, card: CardEntry) {
  if (!destroysAfterUse(card)) return board;
  return {
    ...board,
    playArea: removeOne(board.playArea, card.id),
    destroyed: [...(board.destroyed ?? []), card.id],
  };
}

function emptyBoard(fighterId: string): Board {
  return drawCards({
    fighterId, hp: gameDefinition.mode.startingHp, maxHp: gameDefinition.mode.startingHp, xp: 0, focus: 0, belt: 0,
    deck: shuffle(starterIds), hand: [], discard: [], playArea: [], equipment: [],
    tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], tempo: true, attackedThisRound: false,
    defendedThisRound: false, zonesPlayed: [], purchasedTypes: [], comboTriggered: false, completedTasks: [], statBoost: 0,
    damageReductionUsed: false, wasHitSinceLastTurn: false, borrowedEquipmentId: null, abilityUsedRound: false,
    reversalUsedRound: false, learnedCombos: [], triggeredCombos: [], comboAttemptedTurn: false,
    damageDealt: 0, damageTaken: 0, cardsBought: 0, destroyed: [],
  }, gameDefinition.turn.handSize);
}

function artistUrl(card: CardEntry) {
  if (card.image && CARD_ART[card.image]) return CARD_ART[card.image];
  if (COMPLETE_CARD_ART_BY_CATALOG_ID[card.catalogId]) return COMPLETE_CARD_ART_BY_CATALOG_ID[card.catalogId];
  if (card.name === "Basic Jab") return starterJabArtUrl;
  if (card.name === "High Guard") return highGuardArtUrl;
  return undefined;
}

function cardEffectNote(card: CardEntry) {
  const text = card.rulesText ?? "";
  if (!text || /no (additional )?effect/i.test(text)) return "No extra printed effect.";
  if (isPermanent(card)) return "Equipped permanently; its printed stats apply now."
  return describeEffectPlan(compileCardEffects(text));
}

function applyCardEffects(board: Board, card: CardEntry, owner: "player" | "ai", timing: "onPlay" | "onHit" | "onBlock" | "afterResolve" = "onPlay") {
  let next = { ...board };
  if (timing === "onPlay") {
    if (owner === "player" || owner === "ai") next.focus += numberValue(card.focusValue);
    if (isPermanent(card)) {
      next.equipment = [...next.equipment, card.id];
      if (equipmentSpeedModifier(card)) next.speedChangedThisRound = true;
    }
  }
  for (const effect of compileCardEffects(card.rulesText ?? "").effects.filter((entry) => entry.timing === timing)) {
    if (effect.kind === "draw") next = drawCards(next, effect.amount);
    if (effect.kind === "discard" && next.hand.length) {
      if (owner === "player" && timing === "onPlay" && card.name === "Morning-Shift Meditation") continue;
      const discardCount = Math.min(effect.amount, next.hand.length);
      const ranked = [...next.hand].sort((left, right) => numberValue(cardFor(left)?.focusValue) - numberValue(cardFor(right)?.focusValue));
      const discarded = ranked.slice(0, discardCount);
      next = { ...next, hand: next.hand.filter((id) => !discarded.includes(id)), discard: [...next.discard, ...discarded] };
    }
    if (effect.kind === "nextAttackPower") next.nextAttackBonus += effect.amount;
    if (effect.kind === "speed") { next.tempSpeed += effect.amount; if (effect.amount) next.speedChangedThisRound = true; }
    if (effect.kind === "focus") next.focus += effect.amount;
    if (effect.kind === "heal") next.hp = Math.min(next.maxHp, next.hp + effect.amount);
  }
  if (timing === "onPlay") {
    const conditionalHeal = conditionalHealAfterHit(card, board.wasHitSinceLastTurn);
    if (conditionalHeal) next.hp = Math.min(next.maxHp, next.hp + conditionalHeal);
  }
  const text = card.rulesText ?? "";
  if (timing === "onPlay" && /After your first Attack resolves[^.]*next Attack gains Flow/i.test(text) && board.attacksThisTurn === 0) {
    next.flowAfterFirstAttack = true;
  } else if (timing === "onPlay" && /(?:^|[.!?]\s+)(?:Your|The) next [^.]*Attack[^.]*gains Flow/i.test(text)) {
    next.nextAttackHasFlow = true;
  } else if (timing === "onPlay" && card.name === "Second Wind Form" && board.hp > board.maxHp / 2) {
    next.nextAttackHasFlow = true;
  } else if (timing === "onHit" && /(?:On Hit|If (?:this Attack|it|that Attack) Hits?)[^.]*next [^.]*Attack[^.]*gains Flow/i.test(text)) {
    next.nextAttackHasFlow = true;
  } else if (timing === "afterResolve" && /After (?:this|it|that) Attack resolves[^.]*next [^.]*Attack[^.]*gains Flow/i.test(text)) {
    next.nextAttackHasFlow = true;
  }
  return next;
}

function attackHasFlow(board: Board, card: CardEntry, combo: ComboModifier) {
  if (board.nextAttackHasFlow || combo.grantsFlow) return true;
  if (/this Attack gains Flow/i.test(card.rulesText ?? "")) {
    return !/Weapon equipped/i.test(card.rulesText ?? "") || board.equipment.some((id) => { const item = cardFor(id); return item ? isWeapon(item) : false; });
  }
  const pairedWeapons = board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item && isWeapon(item) && hasTag(item, "Paired")));
  if (board.attacksThisTurn === 1 && pairedWeapons.length >= 2 && board.equipment.some((id) => cardFor(id)?.name === "Escrima Sticks")) return true;
  return false;
}

function legalDefenseIds(board: Board, zone: string) {
  return board.hand.filter((id) => {
    const card = cardFor(id);
    return Boolean(card && isDefense(card) && matchesZone(card, zone));
  });
}

function bestDefense(board: Board, zone: string, attackPower = Number.POSITIVE_INFINITY, difficulty: Difficulty = "certified", location?: CardEntry, incomingAttack?: CardEntry, attacker?: Board, piercing = 0) {
  const options = legalDefenseIds(board, zone);
  if (!options.length || (difficulty === "student" && Math.random() < .28)) return null;
  const ranked = options.map((id) => {
    const card = cardFor(id)!;
    const modifier = locationDefenseModifier(location, card, board, zone).value;
    const printed = incomingAttack && attacker ? defenseCardRuleModifier(board, attacker, card, incomingAttack).value : 0;
    return { id, total: fighterStat(board, "DEF") + piercedArmorModifier(equipmentDefenseModifier(board, zone), piercing).value + cardPower(card) + (board.nextDefenseCardBonus ?? 0) + printed + modifier };
  }).sort((left, right) => left.total - right.total);
  const efficientBlock = ranked.find((entry) => entry.total >= attackPower);
  if (efficientBlock) return efficientBlock.id;
  if (difficulty === "master" && attackPower - ranked.at(-1)!.total >= 5) return null;
  return ranked.at(-1)?.id ?? null;
}

function aiMarketScore(card: CardEntry, board: Board) {
  const owned = [...board.deck, ...board.hand, ...board.discard, ...board.playArea].map(cardFor).filter(Boolean) as CardEntry[];
  const attacks = owned.filter(isAttack).length;
  const defenses = owned.filter(isDefense).length;
  const base = cardCost(card) * 2 + cardFocus(card);
  if (isDefense(card) && defenses < 5) return base + 5;
  if (isAttack(card) && attacks < 5) return base + 4;
  if (isKata(card) && board.learnedCombos.length) return base + 3;
  if (isPermanent(card)) return base + 2;
  return base;
}

function aiAttackScore(card: CardEntry, attacker: Board, defender: Board, location?: CardEntry) {
  const zones = card.zone?.includes("Any") ? ["High", "Mid", "Low"] : [card.zone?.split(",")[0] ?? "High"];
  return Math.max(...zones.map((zone) => {
    const defenseCards = legalDefenseIds(defender, zone).length;
    const locationBonus = locationAttackModifier(location, card, attacker, zone);
    return cardPower(card) + locationBonus.power + locationBonus.damage - defenseCards * .35;
  }));
}

function playAreaCleanup(board: Board) {
  const borrowed = board.borrowedEquipmentId;
  const equipment = borrowed ? board.equipment.filter((id) => id !== borrowed) : board.equipment;
  const discard = [...board.discard, ...board.hand, ...board.playArea.filter((id) => !board.equipment.includes(id)), ...(borrowed ? [borrowed] : [])];
  return drawCards({ ...board, hand: [], playArea: [], equipment, discard, focus: 0, attacksThisTurn: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0, borrowedEquipmentId: null, wasHitSinceLastTurn: false, comboAttemptedTurn: false }, board.belt >= 5 ? 6 : 5);
}

function cardLabel(card: CardEntry) { return `${card.name} · ${card.catalogId}`; }

function NativeCardArt({ card }: { card: CardEntry }) {
  const glyph = isAttack(card) ? "✦" : isDefense(card) ? "◆" : isKata(card) ? "◎" : isPermanent(card) ? "▣" : card.cardType === "Combo" ? "∞" : "✺";
  return <span className="native-card-art" aria-hidden="true">
    <span className="native-card-ribbon">{card.subtype || card.cardType}</span>
    <b>{glyph}</b>
    <strong>{card.name}</strong>
    <small>{(card.rulesText ?? "No additional effect.").slice(0, 112)}</small>
    <em>DDB · CERTIFIED COPY</em>
  </span>;
}

function PlayCard({ card, selected, disabled, onClick, onInspect }: { card: CardEntry; selected?: boolean; disabled?: boolean; onClick?: () => void; onInspect: () => void }) {
  const art = artistUrl(card);
  const kind = isAttack(card) ? "attack" : isDefense(card) ? "defense" : isKata(card) ? "kata" : card.cardType.toLocaleLowerCase();
  return <article className={`play-card play-card--${kind} ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}>
    <button className="play-card-main" disabled={disabled || !onClick} onClick={onClick} aria-label={`Use ${card.name}`}>
      {art ? <img src={art} alt="" loading="lazy" decoding="async" /> : <NativeCardArt card={card} />}
      {art && <span className="play-card-fallback"><b>{card.name}</b><small>{card.catalogId}</small><em>{card.subtype}</em></span>}
      <span className="play-card-meta"><b>{card.fpCost ?? "—"}<small> COST</small></b><strong>{card.focusValue ?? "—"}<small> FOCUS</small></strong><em>{card.zone ?? "—"} · {card.timing ?? "—"}</em></span>
    </button>
    <button className="play-card-inspect" onClick={onInspect} aria-label={`Inspect ${card.name}`}>⌕</button>
  </article>;
}

function StatGlyph({ stat }: { stat: "HP" | "XP" | "FP" | "ATK" | "DEF" | "SPD" }) {
  const paths = {
    HP: <path d="M12 20s-7-4.4-9.2-8.3C.8 8.2 2.6 4.5 6.4 4.5c2.1 0 3.4 1.2 4.1 2.4.7-1.2 2-2.4 4.1-2.4 3.8 0 5.6 3.7 3.6 7.2C16 15.6 12 20 12 20Z" />,
    XP: <path d="m12 2.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8L12 2.8Z" />,
    FP: <path d="M18.5 12a6.5 6.5 0 1 1-6.5-6.5c3 0 5 1.8 5 4.1 0 2-1.7 3.5-3.8 3.5-1.7 0-2.9-1-2.9-2.3 0-1.1.9-1.9 2.1-1.9" />,
    ATK: <path d="M6.3 11.2V7.1c0-1.6 2.2-1.7 2.2-.1V5.8c0-1.6 2.2-1.7 2.2-.1V5c0-1.6 2.2-1.6 2.2 0v.8c0-1.5 2.2-1.5 2.2.1v5l1-1.1c1.1-1.2 3 .2 2 1.6l-3.7 5.2V20H8.2v-3.2l-3-3.7c-1-1.3.2-3 1.1-1.9Z" />,
    DEF: <path d="M12 2.7 19 5v5.5c0 4.4-2.7 7.7-7 10.8-4.3-3.1-7-6.4-7-10.8V5l7-2.3Z" />,
    SPD: <path d="M13.5 2.5 5.8 13h5l-1 8.5L18.2 10h-5.1l.4-7.5Z" />,
  };
  return <svg className={`fighter-stat-glyph stat-${stat.toLocaleLowerCase()}`} viewBox="0 0 24 24" aria-hidden="true">{paths[stat]}</svg>;
}

const LOADOUT_SLOTS = ["Head", "Chest", "Arms", "Legs", "Feet", "Accessory", "Hands"] as const;

function equipmentSlotLabel(card: CardEntry) {
  const raw = String(card.details?.Slot ?? "").trim();
  if (/hand/i.test(raw) || isWeapon(card)) return "Hands";
  const named = LOADOUT_SLOTS.find((slot) => slot.toLocaleLowerCase() === raw.toLocaleLowerCase());
  if (named) return named;
  if (/head|helmet|hat/i.test(`${raw} ${card.name}`)) return "Head";
  if (/chest|body|torso/i.test(`${raw} ${card.name}`)) return "Chest";
  if (/arm|bracer|glove/i.test(`${raw} ${card.name}`)) return "Arms";
  if (/leg|shin|knee/i.test(`${raw} ${card.name}`)) return "Legs";
  if (/feet|foot|shoe|boot/i.test(`${raw} ${card.name}`)) return "Feet";
  return "Accessory";
}

function FighterPanel({ board, label, enemy, onInspect }: { board: Board; label: string; enemy?: boolean; onInspect: (card: CardEntry) => void }) {
  const fighter = cardFor(board.fighterId)!;
  const art = artistUrl(fighter);
  const combatStats: { stat: "ATK" | "DEF" | "SPD"; label: "ATK" | "DEF" | "SPD"; value: number }[] = enemy
    ? [
        { stat: "SPD", label: "SPD", value: fighterStat(board, "Speed") },
        { stat: "DEF", label: "DEF", value: fighterStat(board, "DEF") },
        { stat: "ATK", label: "ATK", value: fighterStat(board, "ATK") },
      ]
    : [
        { stat: "ATK", label: "ATK", value: fighterStat(board, "ATK") },
        { stat: "DEF", label: "DEF", value: fighterStat(board, "DEF") },
        { stat: "SPD", label: "SPD", value: fighterStat(board, "Speed") },
      ];
  const portrait = <button type="button" className="fighter-panel-art" onClick={() => onInspect(fighter)} aria-label={`Open ${fighter.name} fighter dossier`}>
    {art ? <img src={art} alt={fighter.name} /> : <img src={cardPlaceholderUrl} alt="" />}
    <span>Inspect</span>
  </button>;
  const identity = <div className="fighter-panel-copy">
    <span>{label} · {belts[board.belt].name} Belt</span>
    <button className="fighter-dossier-name" onClick={() => onInspect(fighter)}>{fighter.name}</button>
    <p>{fighter.rulesText}</p>
    <div className="fighter-resource-strip"><b>{board.xp}<small>XP</small></b><b>{board.focus}<small>FP</small></b></div>
  </div>;
  return <section className={`fighter-panel fighter-dossier paper-stack ${enemy ? "is-enemy" : ""}`}>
    {enemy ? <>{identity}{portrait}</> : <>{portrait}{identity}</>}
    <div className="fighter-stats fighter-stats--combat" aria-label={`${fighter.name} combat statistics`}>
      {combatStats.map((entry) => <b key={entry.stat}><StatGlyph stat={entry.stat} /><small>{entry.label}</small><span>{entry.value}</span></b>)}
    </div>
    <button type="button" className="fighter-loadout-launch" onClick={() => onInspect(fighter)}>{enemy ? <><small>equipped</small><b>{board.equipment.length}</b><span>Fighter & loadout</span></> : <><span>Fighter & loadout</span><b>{board.equipment.length}</b><small>equipped</small></>}</button>
  </section>;
}

function LearnedComboRack({ states, onInspect }: { states: { combo: CardEntry; evaluation: ReturnType<typeof evaluateCombo> | null; triggered: boolean }[]; onInspect: (card: CardEntry) => void }) {
  if (!states.length) return null;
  return <section className="active-combo-rack fighter-combo-rack" aria-label="Learned Combos">
    <header><span>∞ Learned Combos</span><small>Face up · always watching</small></header>
    <div className="active-combo-grid">{states.map(({ combo, evaluation, triggered }) => {
      const state = triggered ? "is-triggered" : evaluation?.eligible ? "is-ready" : evaluation && !evaluation.supported ? "is-manual" : "";
      const status = triggered ? "Triggered" : evaluation?.eligible ? "Will trigger" : evaluation && !evaluation.supported ? "Manual resolver" : "Watching";
      return <button type="button" className={`active-combo-card ${state}`} onClick={() => onInspect(combo)} key={combo.id}><i aria-hidden="true">∞</i><b>{combo.name}</b><span>{comboRequirementText(combo)}</span><small>{status}</small></button>;
    })}</div>
  </section>;
}

function ImpactReadout({ line }: { line: string }) {
  const math = line.match(/Attack (\d+) vs Defense (\d+)/i);
  const hit = math ? Number(math[1]) > Number(math[2]) : false;
  const finalDamage = line.match(/hits(?: [^.]*?)? for (\d+)/i)?.[1];
  return <blockquote className={`impact-readout ${math ? (hit ? "is-hit" : "is-block") : ""}`} key={line}>
    <span>{math ? (hit ? "Impact certified" : "Block certified") : "Latest filing"}</span>
    {math && <div><b>{math[1]}<small>ATK</small></b><i>−</i><b>{math[2]}<small>DEF</small></b><i>=</i><strong>{finalDamage ?? Math.max(0, Number(math[1]) - Number(math[2]))}<small>HP</small></strong></div>}
    {!math && <p>{line}</p>}
  </blockquote>;
}

function MatLane({ label, cards: cardIds, activeId, onInspect }: { label: string; cards: string[]; activeId?: string | null; onInspect: (card: CardEntry) => void }) {
  const visible = cardIds;
  return <section className="mat-lane" aria-label={`${label} cards currently on the Live Mat`}>
    <header><span>{label}</span><b>{visible.length ? `${visible.length} CARD${visible.length === 1 ? "" : "S"}` : "CLEAR"}</b></header>
    <div className="mat-lane-cards">
      {visible.length ? visible.map((id, index) => { const card = cardFor(id); if (!card) return null; const art = artistUrl(card); return <button type="button" className={id === activeId ? "is-active" : ""} onClick={() => onInspect(card)} title={`Inspect ${card.name}`} key={`${id}-${index}`}>
        <span className="mat-card-visual">{art ? <img src={art} alt="" /> : <NativeCardArt card={card} />}</span>
        <span className="mat-card-copy"><b>{card.name}</b><small>{card.subtype || card.cardType}{card.zone ? ` · ${card.zone}` : ""}</small></span>
      </button>; }) : <p>No cards committed this turn.</p>}
    </div>
  </section>;
}

function BattleCallout({ line }: { line: string }) {
  const damage = line.match(/hits(?: [^.]*?)? for (\d+)/i)?.[1];
  const block = /\bblocks?\b|is blocked/i.test(line);
  const purchase = /\bBought\b|\bbuys\b/i.test(line);
  const promote = /Certification approved/i.test(line);
  if (!damage && !block && !purchase && !promote) return null;
  return <div className={`battle-callout ${damage ? "is-hit" : block ? "is-block" : "is-paperwork"}`} key={line} aria-hidden="true">
    <b>{damage ? `${damage} DAMAGE` : block ? "BLOCK!" : promote ? "BELT UP!" : "ACQUIRED!"}</b>
    <span>{damage ? "impact filing accepted" : block ? "denied by the defense desk" : "stamp applied with unreasonable force"}</span>
  </div>;
}

function SetupView({ selectedId, setSelectedId, settings, setSettings, begin }: { selectedId: string; setSelectedId: (id: string) => void; settings: HouseSettings; setSettings: (settings: HouseSettings) => void; begin: () => void }) {
  const [query, setQuery] = useState("");
  const selected = cardFor(selectedId) ?? characters[0];
  const filteredCharacters = characters.filter((character) => `${character.name} ${character.rulesText ?? ""} ${Object.values(character.stats).join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const randomize = () => {
    const choices = filteredCharacters.filter((character) => character.id !== selectedId);
    const next = choices[Math.floor(Math.random() * choices.length)] ?? filteredCharacters[0] ?? characters[0];
    setSelectedId(next.id);
  };
  return <main className="playtest-shell shell"><MobilePlaytestNotice />
    <section className="playtest-hero paper-stack"><span className="eyebrow">Department-certified digital field test</span><h1>Shuffle. Strike. Ascend.</h1><p>This is the actual Quick Duel loop: the fixed {starterIds.length}-card curriculum, all approved Market records, live fighter data, automated Locations, Reversals, Belt Exams, and a separate Combo docket.</p><div className="playtest-stamps"><span>{cards.length} approved records</span><span>Quick Duel vs. tactical AI</span><span>Progress saved on this device</span></div></section>
    <section className="playtest-setup-grid">
      <div className="playtest-roster paper-stack"><div className="roster-toolbar"><div><span className="eyebrow">1 · Choose a fighter</span><h2>Who signs the waiver?</h2></div><div><label><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a fighter" aria-label="Search fighters" /></label><button onClick={randomize}>Random draw</button></div></div><article className="selected-fighter-dossier"><img src={artistUrl(selected) ?? cardPlaceholderUrl} alt={selected.name} /><div><span>Selected delegation</span><h3>{selected.name}</h3><p>{selected.rulesText ?? "Ability pending an inspector with a functioning pen."}</p><div><b>{numberValue(selected.stats.ATK)}<small>ATK</small></b><b>{numberValue(selected.stats.DEF)}<small>DEF</small></b><b>{numberValue(selected.stats.Speed)}<small>SPD</small></b></div></div></article><div className="playtest-character-grid">{filteredCharacters.map((character) => <button key={character.id} className={selectedId === character.id ? "is-selected" : ""} onClick={() => setSelectedId(character.id)} aria-pressed={selectedId === character.id}><img src={artistUrl(character) ?? cardPlaceholderUrl} alt="" loading="lazy" /><span>{character.name}</span><small>{numberValue(character.stats.ATK)} ATK · {numberValue(character.stats.DEF)} DEF · {numberValue(character.stats.Speed)} SPD</small></button>)}</div></div>
      <aside className="playtest-rules-panel quick-duel-brief paper-stack"><span className="eyebrow">2 · One official teaser</span><h2>Certified Quick Duel</h2><p>One fighter. One tactical opponent. Full Belt vitality, the persistent Market, Locations, Reversals, Combos, and Belt progression. No mode selection and no setup maze—the Department has already made the questionable decisions.</p><ul><li>Desktop playtest</li><li>Guided tactical opponent</li><li>Real Core card catalog</li></ul><button className="button primary field-test-launch" onClick={() => begin()}>Begin Quick Duel as {selected.name} <span>→</span></button></aside>
    </section>
  </main>;
}

function MobilePlaytestNotice() {
  return <section className="playtest-mobile-notice paper-stack"><span className="eyebrow">Desktop field test</span><h1>Quick Duel needs a bigger mat.</h1><p>The playable teaser is intentionally hidden on phones. Open this page on a desktop or laptop to fight; the rules and Card Library remain fully mobile-friendly.</p></section>;
}

export default function PlaytestView({ goTo }: { goTo: (view: "rules" | "cards") => void }) {
  const [selectedId, setSelectedId] = useState(() => characters.find((card) => card.name === "Sensei Ducktape")?.id ?? characters[0].id);
  const [settings, setSettings] = useState<HouseSettings>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("ddb-field-settings") ?? "null") as Partial<HouseSettings> | null;
      return { tempo: saved?.tempo ?? true, locations: saved?.locations ?? true, openMarket: saved?.openMarket ?? true, guided: saved?.guided ?? true, autoAi: saved?.autoAi ?? true, balancedMarket: saved?.balancedMarket ?? true, difficulty: saved?.difficulty && DIFFICULTIES[saved.difficulty] ? saved.difficulty : "certified" };
    } catch { return { tempo: true, locations: true, openMarket: true, guided: true, autoAi: true, balancedMarket: true, difficulty: "certified" }; }
  });
  const [match, setMatch] = useState<Match | null>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("ddb-field-match") ?? "null") as Match | null;
      return saved?.schema === 6 && saved?.player?.fighterId && saved?.ai?.fighterId && saved.turnOrder?.length === 2 && cardFor(saved.player.fighterId) && cardFor(saved.ai.fighterId) ? saved : null;
    } catch { return null; }
  });
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [inspectorZoomed, setInspectorZoomed] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [deskView, setDeskView] = useState<DeskView | null>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("ddb-field-match") ?? "null") as Match | null;
      return saved?.phase === "player-ascend" ? "market" : null;
    } catch { return null; }
  });
  const [rulesSync, setRulesSync] = useState<RulesSyncState>({ status: "checking", currentVersion: activeRulesRevision, latestVersion: activeRulesRevision, checkedAt: 0 });
  const inspected = inspectedId ? cardFor(inspectedId) : null;

  useEffect(() => { window.localStorage.setItem("ddb-field-settings", JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    try {
      if (match) window.localStorage.setItem("ddb-field-match", JSON.stringify(match));
      else window.localStorage.removeItem("ddb-field-match");
    } catch {
      window.localStorage.removeItem("ddb-field-match");
    }
  }, [match]);
  useEffect(() => {
    const controller = new AbortController();
    const check = () => fetchRulesManifest(controller.signal)
      .then((manifest) => setRulesSync(rulesSyncState(activeRulesRevision, manifest.rulesRevision ?? manifest.rulesVersion)))
      .catch(() => setRulesSync((current) => ({ ...current, status: "offline", checkedAt: Date.now() })));
    void check();
    const timer = window.setInterval(check, 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    setInspectorZoomed(false);
    if (!inspectedId && !deskView && !logOpen && !coachOpen) return;
    const previousOverflow = document.body.style.overflow;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (inspectedId) setInspectedId(null);
      else if (deskView) setDeskView(null);
      else if (logOpen) setLogOpen(false);
      else setCoachOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", close); };
  }, [inspectedId, deskView, logOpen, coachOpen]);

  const begin = (fighterId = selectedId) => {
    const choices = characters.filter((card) => card.id !== fighterId);
    const player = { ...emptyBoard(fighterId), xp: 1 };
    const challenge = DIFFICULTIES[settings.difficulty];
    const ai = { ...emptyBoard(choices[Math.floor(Math.random() * choices.length)].id), xp: 1, hp: challenge.aiHp, maxHp: challenge.aiHp, statBoost: challenge.statBoost };
    const locations = shuffle(quickDuelLocationPool.map((card) => card.id));
    const shuffledMarket = shuffle(marketPool.filter((card) => settings.openMarket || Boolean(artistUrl(card))).map((card) => card.id));
    const openingMarket = curateOpeningMarket(shuffledMarket, settings.balancedMarket);
    const comboDeck = shuffle(comboPool.map((card) => card.id));
    const currentLocation = settings.locations ? locations[0] : locationPool.find((card) => card.name === "Tournament Mat")?.id ?? locations[0];
    const playerFirst = fighterStat(player, "Speed") >= fighterStat(ai, "Speed");
    const turnOrder: Match["turnOrder"] = playerFirst ? ["player", "ai"] : ["ai", "player"];
    setDeskView(null);
    setMatch({ schema: 6, rulesVersion: activeRulesRevision, player, ai, market: openingMarket.market, marketDeck: openingMarket.marketDeck, marketDiscard: [], marketPurchasedThisRound: false, comboDeck: comboDeck.slice(1), comboOfferId: comboDeck[0] ?? null, locations: locations.slice(1), locationId: currentLocation, round: 1, phase: playerFirst ? "player-initiate" : "ai-ready", turnOrder, turnIndex: 0, selectedAttackId: null, selectedZone: "High", pendingStrike: null, pendingDiscard: null, reversalRemainingAiAttacks: [], winner: null, log: [`${challenge.label} field test opened under rules ${activeRulesRevision}. The waiver is legally adjacent to complete.`, `Honor 1: ${cardFor(currentLocation)?.name ?? "Tournament Mat"} is active. Both fighters gain 1 XP and refresh Tempo.`, `${playerFirst ? "You" : "Computer"} win initiative on current Speed.`] });
  };

  const write = (current: Match, line: string, changes: Partial<Match> = {}) => ({ ...current, ...changes, log: [line, ...current.log].slice(0, 32) });
  const player = match?.player;
  const ai = match?.ai;
  const playerFighter = player ? cardFor(player.fighterId)! : null;
  const aiFighter = ai ? cardFor(ai.fighterId)! : null;
  const playerTask = useMemo(() => player ? player.completedTasks.includes(player.belt + 1) : false, [player]);

  const chooseAttack = (card: CardEntry) => setMatch((current) => current ? { ...current, selectedAttackId: current.selectedAttackId === card.id ? null : card.id, selectedZone: card.zone?.includes("Any") ? current.selectedZone : card.zone?.split(",")[0] ?? "High" } : current);

  const equipPermanent = (id: string) => setMatch((current) => {
    if (!current || current.phase !== "player-initiate" || current.winner) return current;
    const card = cardFor(id);
    if (!card || !isPermanent(card)) return current;
    if (cardFor(current.player.fighterId)?.name === "Knuckleton the Brawler" && isWeapon(card)) return write(current, "Knuckleton refuses the Weapon. The waiver cites 'personal reasons.'");
    const nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id] }, card, "player");
    return write(current, `${card.name} equipped during Initiate. ${cardEffectNote(card)}`, { player: nextPlayer });
  });

  const borrowEquipment = (id: string) => setMatch((current) => {
    if (!current || current.phase !== "player-initiate" || current.player.abilityUsedRound || cardFor(current.player.fighterId)?.name !== "Sensei Ducktape") return current;
    const card = cardFor(id);
    if (!card || !isPermanent(card) || !current.player.discard.includes(id)) return current;
    const nextPlayer = applyCardEffects({ ...current.player, discard: removeOne(current.player.discard, id), borrowedEquipmentId: id, abilityUsedRound: true }, card, "player");
    return write(current, `Sensei Ducktape jury-rigs ${card.name} from the discard pile until Hide.`, { player: nextPlayer });
  });

  const beginYell = () => setMatch((current) => current?.phase === "player-initiate" ? write(current, "Initiate complete. Yell begins; subtlety has left the building.", { phase: "player-yell" }) : current);

  const declareAttack = () => setMatch((current) => {
    if (!current?.selectedAttackId || current.phase !== "player-yell" || current.winner || current.pendingDiscard || current.pendingChoice) return current;
    const card = cardFor(current.selectedAttackId);
    if (!card || !isAttack(card) || !current.player.hand.includes(card.id)) return current;
    const anyZone = attackHasFlexibleZone(current.player, card);
    const zone = anyZone ? current.selectedZone : card.zone?.split(",")[0] ?? "High";
    const tempoBonus = settings.tempo && current.player.tempo && fighterStat(current.player, "Speed") > fighterStat(current.ai, "Speed") ? 1 : 0;
    const location = cardFor(current.locationId);
    const locationModifier = locationAttackModifier(location, card, current.player, zone);
    const fighterModifier = fighterAttackModifier(current.player, current.ai, card);
    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card, zone);
    const incomingModifier = incomingAttackEquipmentModifier(current.ai);
    const comboModifier = comboAttackModifier(current.player, card, zone);
    const rawArmorModifier = equipmentDefenseModifier(current.ai, zone);
    const piercingModifier = attackPiercingModifier(current.player, current.ai, card, zone, comboModifier.piercing);
    const armorModifier = piercedArmorModifier(rawArmorModifier, piercingModifier.value);
    const hasFlow = attackHasFlow(current.player, card, comboModifier);
    const attackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);
    const defenseId = bestDefense(current.ai, zone, attackPower, settings.difficulty, location, card, current.player, piercingModifier.value);
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    const defenseModifier = locationDefenseModifier(location, defenseCard, current.ai, zone);
    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(current.ai, current.player, defenseCard, card) : { value: 0, notes: [] as string[] };
    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (current.ai.nextDefenseCardBonus ?? 0) : 0) + defenseCardModifier.value + defenseModifier.value);
    const hit = attackPower > defensePower;
    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage + comboModifier.damage) : 0;
    const reduced = reduceDamageForFighter(current.ai, rawDamage);
    const damage = reduced.damage;
    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attacksThisTurn: current.player.attacksThisTurn + 1, hitThisTurn: current.player.hitThisTurn || hit, attackedThisRound: true, cardsThisTurn: [...current.player.cardsThisTurn, card.id], zonesPlayed: [...current.player.zonesPlayed, zone], nextAttackBonus: 0, nextAttackHasFlow: false, tempo: tempoBonus ? false : current.player.tempo, wasHitSinceLastTurn: current.player.attacksThisTurn === 0 ? false : current.player.wasHitSinceLastTurn, triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0, damageDealt: current.player.damageDealt + damage }, card, "player");
    const flowDraw = hasFlow && !current.player.flowUsedThisTurn;
    if (flowDraw) nextPlayer = drawCards({ ...nextPlayer, flowUsedThisTurn: true }, 1);
    if (current.player.flowAfterFirstAttack && current.player.attacksThisTurn === 0) nextPlayer = { ...nextPlayer, flowAfterFirstAttack: false, nextAttackHasFlow: true };
    if (hit && comboModifier.focusOnHit) nextPlayer.focus += comboModifier.focusOnHit;
    if (comboModifier.speedOnTrigger) nextPlayer.tempSpeed += comboModifier.speedOnTrigger;
    let nextAi: Board = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), attacksReceivedThisRound: (reduced.board.attacksReceivedThisRound ?? 0) + 1, wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit, damageTaken: reduced.board.damageTaken + damage };
    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card) : { board: nextAi, notes: [] as string[] };
    nextAi = targetDebuff.board;
    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), discard: [...nextAi.discard, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, nextDefenseCardBonus: 0 };
    nextPlayer = applyCardEffects(nextPlayer, card, "player", hit ? "onHit" : "afterResolve");
    if (hit) nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve");
    let defenseFollowupNotes: string[] = [];
    if (defenseCard) {
      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onPlay");
      const followup = applyAfterDefenseEquipment(nextAi);
      nextAi = followup.board;
      defenseFollowupNotes = followup.notes;
      if (!hit) nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onBlock");
      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve");
    }
    if (damage >= 3 && nextPlayer.belt >= 6) nextPlayer.focus += 1;
    if (!nextAi.hp) nextPlayer.xp += 2;
    nextPlayer = markCompletedTask(nextPlayer);
    const result = hit
      ? `${card.name} hits ${aiFighter?.name ?? "the opponent"} for ${damage}.${defenseCard ? ` ${defenseCard.name} is discarded after this strike.` : ""}`
      : defenseCard
        ? `${card.name} is blocked by ${defenseCard.name}; that Defense is now discarded.`
        : `${card.name} is blocked by ${aiFighter?.name ?? "the opponent"}'s standing DEF/Equipment; no Defense card was played.`;
    const optionalCycle = !nextAi.hp ? null : optionalDiscardDrawChoice(card);
    const pendingChoice: PendingChoice | null = optionalCycle && nextPlayer.hand.length ? { kind: "discard-draw", sourceCardId: card.id, remaining: optionalCycle.discard, draw: optionalCycle.draw } : null;
    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...piercingModifier.notes, ...armorModifier.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...defenseFollowupNotes, ...(reduced.note ? [reduced.note] : [])];
    return write(current, `${tempoBonus ? "Tempo +1. " : ""}${result} Attack ${attackPower} vs Defense ${defensePower}.${flowDraw ? " Flow draws 1 card." : ""}${pendingChoice ? " Optional discard/draw decision is waiting." : ""}${modifiers.length ? ` ${modifiers.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, selectedAttackId: null, pendingChoice, winner: nextAi.hp ? null : "player" });
  });

  const playSupport = (id: string) => setMatch((current) => {
    if (!current || current.phase !== "player-yell" || current.winner || current.pendingDiscard || current.pendingChoice) return current;
    const card = cardFor(id);
    if (!card || isAttack(card) || isDefense(card) || isPermanent(card)) return current;
    const locationModifier = locationFocusModifier(cardFor(current.locationId), card, current.player);
    let nextPlayer = markCompletedTask(applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id], focus: current.player.focus + locationModifier.value }, card, "player"));
    const destroyedAfterUse = destroysAfterUse(card);
    if (destroyedAfterUse) nextPlayer = destroyResolvedConsumable(nextPlayer, card);
    const pendingDiscard = card.name === "Morning-Shift Meditation" && nextPlayer.hand.length ? { sourceCardId: id, remaining: 1 } : null;
    const junkCount = destroyJunkChoiceCount(card);
    const hasJunk = [...nextPlayer.hand, ...nextPlayer.discard].some((candidate) => isJunk(cardFor(candidate)));
    const pendingChoice: PendingChoice | null = !pendingDiscard && junkCount && hasJunk ? { kind: "destroy-junk", sourceCardId: id, remaining: junkCount } : null;
    const defensePenalty = targetNextDefensePenalty(card);
    const nextAi = defensePenalty ? { ...current.ai, nextDefenseCardBonus: (current.ai.nextDefenseCardBonus ?? 0) - defensePenalty } : current.ai;
    return write(current, `${card.name} played. ${pendingDiscard ? "Draw 1 card, then choose a card to discard." : pendingChoice ? `Choose ${junkCount} Junk card${junkCount === 1 ? "" : "s"} from your hand or discard pile to destroy.` : cardEffectNote(card)}${destroyedAfterUse ? " Destroyed after use; it will not enter your discard pile." : ""}${locationModifier.notes.length ? ` ${locationModifier.notes.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, pendingDiscard, pendingChoice });
  });

  const choosePendingDiscard = (id: string) => setMatch((current) => {
    if (!current?.pendingDiscard || !current.player.hand.includes(id)) return current;
    const discarded = cardFor(id);
    const source = cardFor(current.pendingDiscard.sourceCardId);
    const gainsFocus = source?.name === "Morning-Shift Meditation" && cardFocus(discarded) === 0;
    const remaining = current.pendingDiscard.remaining - 1;
    const player = {
      ...current.player,
      hand: removeOne(current.player.hand, id),
      discard: [...current.player.discard, id],
      focus: current.player.focus + (gainsFocus ? 1 : 0),
    };
    return write(current, `${discarded?.name ?? "The selected card"} discarded for ${source?.name ?? "the pending effect"}.${gainsFocus ? " Its Focus Value is 0, so you gain 1 Focus." : ""}`, { player, pendingDiscard: remaining > 0 && player.hand.length ? { ...current.pendingDiscard, remaining } : null });
  });

  const resolvePendingChoice = (cardId: string, source: "hand" | "discard" = "hand") => setMatch((current) => {
    const choice = current?.pendingChoice;
    if (!current || !choice) return current;
    const selected = cardFor(cardId);
    const sourceCards = source === "hand" ? current.player.hand : current.player.discard;
    if (!selected || !sourceCards.includes(cardId)) return current;

    if (choice.kind === "destroy-junk") {
      if (!isJunk(selected)) return current;
      const player = source === "hand"
        ? { ...current.player, hand: removeOne(current.player.hand, cardId), destroyed: [...(current.player.destroyed ?? []), cardId] }
        : { ...current.player, discard: removeOne(current.player.discard, cardId), destroyed: [...(current.player.destroyed ?? []), cardId] };
      const remaining = choice.remaining - 1;
      const junkRemains = [...player.hand, ...player.discard].some((id) => isJunk(cardFor(id)));
      const pendingChoice = remaining > 0 && junkRemains ? { ...choice, remaining } : null;
      return write(current, `${selected.name} destroyed from your ${source === "hand" ? "hand" : "discard pile"}.${pendingChoice ? ` Choose ${remaining} more Junk.` : " Choice resolved."}`, { player, pendingChoice });
    }

    if (choice.kind === "discard-draw") {
      if (!current.player.hand.includes(cardId)) return current;
      let player = { ...current.player, hand: removeOne(current.player.hand, cardId), discard: [...current.player.discard, cardId] };
      const remaining = choice.remaining - 1;
      if (remaining > 0 && player.hand.length) {
        return write(current, `${selected.name} discarded. Choose ${remaining} more card${remaining === 1 ? "" : "s"}.`, { player, pendingChoice: { ...choice, remaining } });
      }
      player = drawCards(player, choice.draw);
      return write(current, `${selected.name} discarded; ${choice.draw} card${choice.draw === 1 ? "" : "s"} drawn by ${cardFor(choice.sourceCardId)?.name ?? "the printed effect"}.`, { player, pendingChoice: null });
    }
    return current;
  });

  const skipPendingChoice = () => setMatch((current) => {
    if (!current?.pendingChoice || current.pendingChoice.kind !== "discard-draw") return current;
    return write(current, `${cardFor(current.pendingChoice.sourceCardId)?.name ?? "Optional effect"}: discard/draw declined.`, { pendingChoice: null });
  });

  const practiceDefense = (id: string) => setMatch((current) => {
    if (!current || current.phase !== "player-yell" || current.winner || current.player.defensePracticeUsed || current.pendingDiscard || current.pendingChoice) return current;
    const card = cardFor(id);
    if (!card || !isDefense(card) || !current.player.hand.includes(id) || gameDefinition.economy.defensePractice.usesPerTurn < 1) return current;
    const nextPlayer = {
      ...current.player,
      hand: removeOne(current.player.hand, id),
      playArea: [...current.player.playArea, id],
      focus: current.player.focus + cardFocus(card),
      defensePracticeUsed: true,
    };
    return write(current, `${card.name} used for Defense Practice: +${cardFocus(card)} printed Focus. No Guard, rules text, XP, Combo, or Belt credit applies.`, { player: nextPlayer });
  });

  const enterAscend = () => {
    setDeskView("market");
    setMatch((current) => current?.phase === "player-yell" && !current.pendingDiscard && !current.pendingChoice ? write(current, "Ascend: the acquisition desk opens. Spend this turn's Focus before it leaves your mat.", { phase: "player-ascend", selectedAttackId: null }) : current);
  };

  const buyMarket = (id: string) => setMatch((current) => {
    if (!current || current.phase !== "player-ascend" || current.winner) return current;
    const card = cardFor(id);
    const slot = current.market.indexOf(id);
    const price = cardCost(card);
    if (!card || slot < 0 || current.player.focus < price) return current;
    const focusBefore = current.player.focus;
    const nextPlayer = markCompletedTask({ ...current.player, focus: focusBefore - price, discard: [...current.player.discard, id], purchasedTypes: [...current.player.purchasedTypes, card.cardType], cardsBought: current.player.cardsBought + 1 });
    const refilled = refillPurchasedMarketSlot(current.market, current.marketDeck, current.marketDiscard, slot);
    return write(current, `Bought ${card.name} for ${price} Focus (${focusBefore} → ${nextPlayer.focus}). The top Market card immediately fills the slot.`, { player: nextPlayer, ...refilled, marketPurchasedThisRound: true });
  });

  const cycleCombo = (learn: boolean) => setMatch((current) => {
    if (!current || current.phase !== "player-ascend" || !current.comboOfferId || current.player.comboAttemptedTurn || current.winner) return current;
    const combo = cardFor(current.comboOfferId);
    if (!combo) return current;
    const cost = cardCost(combo);
    if (learn && (current.player.focus < cost || current.player.learnedCombos.length >= 2)) return current;
    const nextOfferId = current.comboDeck[0] ?? null;
    const nextDeck = [...current.comboDeck.slice(1), ...(learn ? [] : [combo.id])];
    const player = learn
      ? { ...current.player, focus: current.player.focus - cost, learnedCombos: [...current.player.learnedCombos, combo.id], comboAttemptedTurn: true }
      : { ...current.player, comboAttemptedTurn: true };
    return write(current, learn ? `Learned Combo: ${combo.name}. It remains face up beside your delegation.` : `${combo.name} returned to the bottom of the Combo docket.`, { player, comboOfferId: nextOfferId, comboDeck: nextDeck });
  });

  const promote = () => setMatch((current) => {
    if (!current || current.phase !== "player-ascend" || current.player.belt >= belts.length - 1) return current;
    const next = belts[current.player.belt + 1];
    if (current.player.xp < next.xp || !current.player.completedTasks.includes(current.player.belt + 1)) return current;
    const nextPlayer = applyBeltPromotion(current.player, current.player.belt + 1);
    const vitality = nextPlayer.maxHp > current.player.maxHp ? ` Max HP ${current.player.maxHp} → ${nextPlayer.maxHp}; current HP ${current.player.hp} → ${nextPlayer.hp}.` : "";
    return write(current, `Certification approved: ${next.name} Belt. ${next.reward}.${vitality}`, { player: nextPlayer });
  });

  const completeTurn = () => {
    setDeskView(null);
    setMatch((current) => {
      if (!current || current.phase !== "player-ascend") return current;
      const nextPlayer = playAreaCleanup(current.player);
      const hidden = write(current, "Hide: unspent Focus clears and your next hand is drawn.", { player: nextPlayer });
      if (current.turnIndex === 0) return write(hidden, "The computer is second in this round's initiative order.", { phase: "ai-ready", turnIndex: 1 });
      return advanceRound(hidden, settings.locations, "Both fighters have completed the round.");
    });
  };

  const advanceAscendReview = () => {
    if (match?.phase !== "player-ascend") return;
    if (deskView === "market" || !deskView) setDeskView("combo");
    else if (deskView === "combo") setDeskView("belt");
    else completeTurn();
  };

  const runAiTurn = () => setMatch((current) => {
    if (!current || current.phase !== "ai-ready" || current.winner) return current;
    const prepared = prepareAiTurn(current);
    const availableAttacks = prepared.ai.hand.filter((id) => { const card = cardFor(id); return Boolean(card && isAttack(card)); });
    const aiAttackIds = settings.difficulty === "student" ? shuffle(availableAttacks) : availableAttacks.sort((left, right) => aiAttackScore(cardFor(right)!, prepared.ai, prepared.player, cardFor(prepared.locationId)) - aiAttackScore(cardFor(left)!, prepared.ai, prepared.player, cardFor(prepared.locationId)));
    if (!aiAttackIds.length) return finishAiTurn(prepared, "Computer finds no Attack and files an awkward report.", settings.locations);
    return openAiStrike(prepared, aiAttackIds[0], aiAttackIds.slice(1), settings.tempo);
  });

  useEffect(() => {
    if (!settings.autoAi || match?.phase !== "ai-ready" || match.winner) return;
    const timer = window.setTimeout(runAiTurn, 760);
    return () => window.clearTimeout(timer);
  }, [match?.phase, match?.turnIndex, match?.winner, settings.autoAi]);

  const resolveDefense = (defenseId: string | null) => setMatch((current) => {
    if (!current?.pendingStrike || current.phase !== "defense-window") return current;
    const pending = current.pendingStrike;
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    const aiCard = cardFor(pending.cardId)!;
    let nextPlayer = { ...current.player };
    const armorModifier = piercedArmorModifier(equipmentDefenseModifier(nextPlayer, pending.zone), pending.piercing ?? 0);
    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(nextPlayer, current.ai, defenseCard, aiCard) : { value: 0, notes: [] as string[] };
    let defensePower = fighterStat(nextPlayer, "DEF") + armorModifier.value;
    let tempoBonus = 0;
    const locationModifier = locationDefenseModifier(cardFor(current.locationId), defenseCard, nextPlayer, pending.zone);
    if (defenseCard) {
      tempoBonus = settings.tempo && nextPlayer.tempo && fighterStat(nextPlayer, "Speed") > fighterStat(current.ai, "Speed") ? 1 : 0;
      defensePower += cardPower(defenseCard) + (nextPlayer.nextDefenseCardBonus ?? 0) + defenseCardModifier.value + tempoBonus + locationModifier.value;
      nextPlayer = markCompletedTask({ ...nextPlayer, hand: removeOne(nextPlayer.hand, defenseCard.id), discard: [...nextPlayer.discard, defenseCard.id], xp: nextPlayer.xp + 1, defendedThisRound: true, nextDefenseCardBonus: 0, tempo: tempoBonus ? false : nextPlayer.tempo });
      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onPlay");
      const followup = applyAfterDefenseEquipment(nextPlayer);
      nextPlayer = followup.board;
    }
    const hit = pending.attackPower > defensePower;
    const rawDamage = hit ? Math.max(0, pending.attackPower - defensePower + (pending.damageModifier ?? 0)) : 0;
    const reduced = reduceDamageForFighter(nextPlayer, rawDamage);
    const damage = reduced.damage;
    nextPlayer = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit, damageTaken: reduced.board.damageTaken + damage };
    const targetDebuff = hit ? applyTargetHitDebuffs(nextPlayer, aiCard) : { board: nextPlayer, notes: [] as string[] };
    nextPlayer = targetDebuff.board;
    let nextAi = markCompletedTask({ ...current.ai, damageDealt: current.ai.damageDealt + damage, hitThisTurn: current.ai.hitThisTurn || hit });
    nextAi = applyCardEffects(nextAi, aiCard, "ai", hit ? "onHit" : "afterResolve");
    if (hit) nextAi = applyCardEffects(nextAi, aiCard, "ai", "afterResolve");
    if (defenseCard) {
      if (!hit) nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onBlock");
      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "afterResolve");
    }
    if (!nextPlayer.hp) nextAi = { ...nextAi, xp: nextAi.xp + 2 };
    const message = hit
      ? `${aiCard.name} hits you for ${damage}. Attack ${pending.attackPower} vs Defense ${defensePower}.`
      : defenseCard
        ? `${defenseCard.name} blocks ${aiCard.name} and is discarded. Attack ${pending.attackPower} vs Defense ${defensePower}.`
        : `No Defense card was played; your standing DEF/Equipment blocks ${aiCard.name}. Attack ${pending.attackPower} vs Defense ${defensePower}.`;
    const modifiers = [...(pending.modifierNotes ?? []), ...armorModifier.notes, ...defenseCardModifier.notes, ...locationModifier.notes, ...targetDebuff.notes, ...(reduced.note ? [reduced.note] : [])];
    const resolved = write(current, `${tempoBonus ? "Tempo +1 Guard. " : ""}${message}${modifiers.length ? ` ${modifiers.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, pendingStrike: null, winner: nextPlayer.hp ? null : "ai" });
    if (!nextPlayer.hp) return resolved;
    const reversalAttacks = nextPlayer.hand.filter((id) => { const card = cardFor(id); return Boolean(card && isAttack(card)); });
    if (!hit && defenseCard && !nextPlayer.reversalUsedRound && reversalAttacks.length) {
      return write(resolved, `Reversal window: the block is certified and ${reversalAttacks.length} counterattack${reversalAttacks.length === 1 ? " is" : "s are"} ready.`, { phase: "reversal-window", reversalRemainingAiAttacks: pending.remainingAiAttacks, selectedAttackId: null });
    }
    if (pending.remainingAiAttacks.length) return openAiStrike(resolved, pending.remainingAiAttacks[0], pending.remainingAiAttacks.slice(1), settings.tempo);
    return finishAiTurn(resolved, "Computer finishes its Yell and clears the mat.", settings.locations);
  });

  const declineReversal = () => setMatch((current) => {
    if (!current || current.phase !== "reversal-window") return current;
    const resumed = write(current, "Reversal declined. Restraint has been noted and immediately questioned.", { selectedAttackId: null });
    if (current.reversalRemainingAiAttacks.length) return openAiStrike(resumed, current.reversalRemainingAiAttacks[0], current.reversalRemainingAiAttacks.slice(1), settings.tempo);
    return finishAiTurn(resumed, "Computer finishes its Yell and clears the mat.", settings.locations);
  });

  const resolveReversal = () => setMatch((current) => {
    if (!current || current.phase !== "reversal-window" || !current.selectedAttackId || current.player.reversalUsedRound) return current;
    const card = cardFor(current.selectedAttackId);
    if (!card || !isAttack(card) || !current.player.hand.includes(card.id)) return current;
    const zone = attackHasFlexibleZone(current.player, card) ? current.selectedZone : card.zone?.split(",")[0] ?? "High";
    const location = cardFor(current.locationId);
    const locationModifier = locationAttackModifier(location, card, current.player, zone);
    const fighterModifier = fighterAttackModifier(current.player, current.ai, card);
    const printedModifier = printedAttackRuleModifier(current.player, current.ai, card, zone);
    const incomingModifier = incomingAttackEquipmentModifier(current.ai);
    const comboModifier = comboAttackModifier(current.player, card, zone, true);
    const rawArmorModifier = equipmentDefenseModifier(current.ai, zone);
    const piercingModifier = attackPiercingModifier(current.player, current.ai, card, zone, comboModifier.piercing);
    const armorModifier = piercedArmorModifier(rawArmorModifier, piercingModifier.value);
    const attackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);
    const defenseId = bestDefense(current.ai, zone, attackPower, settings.difficulty, location, card, current.player, piercingModifier.value);
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    const defenseModifier = locationDefenseModifier(location, defenseCard, current.ai, zone);
    const defenseCardModifier = defenseCard ? defenseCardRuleModifier(current.ai, current.player, defenseCard, card) : { value: 0, notes: [] as string[] };
    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + armorModifier.value + (defenseCard ? cardPower(defenseCard) + (current.ai.nextDefenseCardBonus ?? 0) : 0) + defenseCardModifier.value + defenseModifier.value);
    const hit = attackPower > defensePower;
    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage + comboModifier.damage) : 0;
    const reduced = reduceDamageForFighter(current.ai, rawDamage);
    const damage = reduced.damage;
    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attackedThisRound: true, zonesPlayed: [...current.player.zonesPlayed, zone], cardsThisTurn: [...current.player.cardsThisTurn, card.id], reversalUsedRound: true, triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0, damageDealt: current.player.damageDealt + damage }, card, "player");
    nextPlayer.focus = Math.max(0, nextPlayer.focus - cardFocus(card));
    if (hit && comboModifier.focusOnHit) nextPlayer.focus += comboModifier.focusOnHit;
    if (comboModifier.speedOnTrigger) nextPlayer.tempSpeed += comboModifier.speedOnTrigger;
    let nextAi: Board = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), attacksReceivedThisRound: (reduced.board.attacksReceivedThisRound ?? 0) + 1, damageTaken: reduced.board.damageTaken + damage, wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit };
    const targetDebuff = hit ? applyTargetHitDebuffs(nextAi, card) : { board: nextAi, notes: [] as string[] };
    nextAi = targetDebuff.board;
    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true, nextDefenseCardBonus: 0 };
    nextPlayer = applyCardEffects(nextPlayer, card, "player", hit ? "onHit" : "afterResolve");
    if (hit) nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve");
    let defenseFollowupNotes: string[] = [];
    if (defenseCard) {
      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onPlay");
      const followup = applyAfterDefenseEquipment(nextAi);
      nextAi = followup.board;
      defenseFollowupNotes = followup.notes;
      if (!hit) nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onBlock");
      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve");
    }
    nextPlayer = markCompletedTask(nextPlayer);
    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...piercingModifier.notes, ...armorModifier.notes, ...defenseCardModifier.notes, ...defenseModifier.notes, ...targetDebuff.notes, ...defenseFollowupNotes, ...(reduced.note ? [reduced.note] : [])];
    const result = hit ? `Reversal! ${card.name} hits ${cardFor(current.ai.fighterId)?.name ?? "the computer"} for ${damage}.` : `Reversal! ${card.name} is blocked${defenseCard ? ` by ${defenseCard.name}` : " by base DEF"}.`;
    const resolved = write(current, `${result} Attack ${attackPower} vs Defense ${defensePower}.${modifiers.length ? ` ${modifiers.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, selectedAttackId: null, winner: nextAi.hp ? null : "player" });
    if (!nextAi.hp) return resolved;
    if (current.reversalRemainingAiAttacks.length) return openAiStrike(resolved, current.reversalRemainingAiAttacks[0], current.reversalRemainingAiAttacks.slice(1), settings.tempo);
    return finishAiTurn(resolved, "Computer finishes its Yell after surviving the Reversal paperwork.", settings.locations);
  });

  if (!match || !player || !ai || !playerFighter || !aiFighter) return <SetupView selectedId={selectedId} setSelectedId={setSelectedId} settings={settings} setSettings={setSettings} begin={begin} />;
  const pendingAttack = match.selectedAttackId ? cardFor(match.selectedAttackId) : null;
  const currentLocation = cardFor(match.locationId);
  const comboOffer = match.comboOfferId ? cardFor(match.comboOfferId) : null;
  const nextBelt = belts[player.belt + 1];
  const canPromote = Boolean(nextBelt && player.xp >= nextBelt.xp && playerTask);
  const defenseOptions = match.pendingStrike ? legalDefenseIds(player, match.pendingStrike.zone) : [];
  const pendingChoiceOptions = match.pendingChoice?.kind === "destroy-junk"
    ? [
        ...player.hand.map((id, index) => ({ id, source: "hand" as const, index })).filter((entry) => isJunk(cardFor(entry.id))),
        ...player.discard.map((id, index) => ({ id, source: "discard" as const, index })).filter((entry) => isJunk(cardFor(entry.id))),
      ]
    : match.pendingChoice?.kind === "discard-draw"
      ? player.hand.map((id, index) => ({ id, source: "hand" as const, index }))
      : [];
  const inspectedBoard = inspected
    ? inspected.id === player.fighterId ? player : inspected.id === ai.fighterId ? ai : null
    : null;
  const learnedComboStates = player.learnedCombos.map((id) => {
    const combo = cardFor(id);
    if (!combo) return null;
    const evaluation = pendingAttack ? evaluateCombo(combo, {
      priorCards: player.cardsThisTurn.map(cardFor).filter(Boolean) as CardEntry[],
      attacksThisTurn: player.attacksThisTurn,
      defendedThisRound: player.defendedThisRound,
      hitThisTurn: player.hitThisTurn,
      zonesPlayed: player.zonesPlayed,
      equipment: player.equipment.map(cardFor).filter(Boolean) as CardEntry[],
      currentCard: pendingAttack,
      currentZone: match.selectedZone,
      isReversal: match.phase === "reversal-window",
    }) : null;
    return { combo, evaluation, triggered: player.triggeredCombos.includes(id) };
  }).filter(Boolean) as { combo: CardEntry; evaluation: ReturnType<typeof evaluateCombo> | null; triggered: boolean }[];
  const practiceFocus = player.defensePracticeUsed ? 0 : Math.max(0, ...player.hand.map((id) => {
    const card = cardFor(id);
    return card && isDefense(card) ? cardFocus(card) : 0;
  }));
  const attackFocus = player.hand.filter((id) => {
    const card = cardFor(id);
    return Boolean(card && isAttack(card));
  }).map((id) => cardFocus(cardFor(id))).sort((left, right) => right - left)
    .reduce((total, value) => total + value, 0);
  const supportFocus = player.hand.reduce((total, id) => {
    const card = cardFor(id);
    const playable = card && !isAttack(card) && !isDefense(card) && !isPermanent(card);
    return total + (playable ? cardFocus(card) : 0);
  }, 0);
  const playableFocus = player.focus + practiceFocus + attackFocus + supportFocus;
  const affordableNow = match.market.filter((id) => cardFor(id) && cardCost(cardFor(id)) <= player.focus).length;
  const affordableForecast = match.market.filter((id) => cardFor(id) && cardCost(cardFor(id)) <= playableFocus).length;
  const ascendStepIndex = deskView === "combo" ? 1 : deskView === "belt" ? 2 : 0;
  const ascendStepTitle = deskView === "combo" ? "Combo Docket" : deskView === "belt" ? "Belt Check" : "Shared Market";
  const ascendStepHelp = deskView === "combo"
    ? "Review the face-up Combo. Learn it if you can and want it, or pass it to the bottom of the docket. Then check your Belt."
    : deskView === "belt"
      ? "Check your XP and Belt Exam requirement. Promote if you qualify. This is the final review before Hide clears unspent Focus."
      : "Spend Focus on any number of Market cards you want. When shopping is finished, continue to the Combo Docket before you Hide.";
  const ascendNextLabel = deskView === "combo" ? "Continue to Belt Check →" : deskView === "belt" ? "Finish Ascend → Hide" : "Continue to Combo Docket →";
  const turnCoach = match.winner
    ? (match.winner === "player" ? "The opponent is folded. Enjoy the extremely temporary paperwork-based glory." : "This test is over, but the Department has approved an immediate and emotionally reckless rematch.")
    : match.phase === "player-initiate"
      ? (player.hand.some((id) => isPermanent(cardFor(id)!)) ? "Equip any permanent Equipment you want before Yell. Each legal Equip generates its printed Focus." : "No permanent Equipment is waiting in hand. Finish Initiate and proceed directly to the yelling.")
    : match.phase === "player-yell"
      ? (pendingAttack ? `You selected ${pendingAttack.name}. Confirm its zone, then declare the Attack.` : !player.defensePracticeUsed && player.hand.some((id) => isDefense(cardFor(id)!)) ? "Use one Defense for Defense Practice to gain its printed Focus without playing its Guard or rules text." : player.hand.some((id) => isAttack(cardFor(id)!)) ? "Play support cards for Focus or select any legal Attack remaining in your hand." : "Your useful cards are spent. Move to Ascend and turn that Focus into a better deck.")
      : match.phase === "player-ascend"
        ? (deskView === "combo" ? "Ascend step 2: inspect the Combo offer. Learning is optional; reviewing it is not. Your remaining Focus can still buy it." : deskView === "belt" ? (canPromote ? `Ascend step 3: your ${nextBelt?.name} Belt certification is ready. Promote before Hide if you want the reward now.` : "Ascend step 3: review your XP and exam progress. After this check, Hide ends the turn and clears unspent Focus.") : `Ascend step 1: shop the Market with ${player.focus} Focus. When you are done buying, continue to the Combo Docket.`)
      : match.phase === "defense-window"
          ? (defenseOptions.length ? `A ${match.pendingStrike?.zone} Attack is incoming. Play a glowing matching Defense or pass.` : "No matching Defense is in hand. Base DEF still applies; pass the Reaction Window to resolve the hit.")
          : match.phase === "reversal-window"
            ? "You Blocked with a Defense card. Choose one Attack from your hand for a free counterattack, or decline the Reversal. It earns XP but no printed Focus."
          : "The computer has initiative. Run its turn when you are ready to discover what it thinks strategy means.";

  const winnerFighter = match.winner === "ai" ? aiFighter : playerFighter;
  const winnerArt = artistUrl(winnerFighter);

  return <main className={`playtest-shell playtest-shell--live ${settings.guided ? "playtest-shell--guided" : ""} ${match.winner ? "playtest-shell--finished" : ""} shell`}><MobilePlaytestNotice />
    <header className="playtest-topbar battle-versus-hud">
      <section className="versus-fighter versus-player"><div><b>{playerFighter.name}</b><span>{belts[player.belt].name} Belt · {player.hp}/{player.maxHp} HP</span></div><div className="versus-health"><span style={{ width: `${Math.max(0, Math.min(100, player.hp / player.maxHp * 100))}%` }} /></div></section>
      <div className="versus-center" aria-label={`Round ${match.round}`}><span>ROUND</span><b>{match.round}</b></div>
      <section className="versus-fighter versus-enemy"><div><b>{aiFighter.name}</b><span>{belts[ai.belt].name} Belt · {ai.hp}/{ai.maxHp} HP</span></div><div className="versus-health"><span style={{ width: `${Math.max(0, Math.min(100, ai.hp / ai.maxHp * 100))}%` }} /></div></section>
    </header>
    {match.winner && <section className={`match-result paper-stack ${match.winner === "player" ? "is-victory" : "is-defeat"}`}>
      {match.winner === "player" && <div className="victory-confetti" aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <i style={{ left: `${(index * 37) % 100}%`, animationDelay: `${(index % 8) * .11}s`, animationDuration: `${2.45 + (index % 5) * .2}s` }} key={index} />)}</div>}
      <div className="victory-certificate">
        <div className="victory-stamp"><span>{match.winner === "player" ? "VICTORY" : "CLOSED"}</span><b>{match.winner === "player" ? "CERTIFIED" : "FIELD TEST"}</b></div>
        <div className="victory-fighter">
          <div className="victory-art-frame">{winnerArt ? <img src={winnerArt} alt={winnerFighter.name} /> : <NativeCardArt card={winnerFighter} />}<span>{match.winner === "player" ? "OFFICIAL WINNER" : "OFFICIAL PROBLEM"}</span></div>
          <div className="victory-copy"><span className="eyebrow">Department of Questionably Regulated Martial Arts</span><h2>{match.winner === "player" ? `${winnerFighter.name} remains standing!` : `${winnerFighter.name} wins the field test.`}</h2><p>{match.winner === "player" ? "Confetti has been authorized, the clipboard has been impressed against its will, and your victory has been filed in triplicate." : "The result has been stamped, disputed, and filed beneath a suspicious vending-machine receipt. An immediate rematch remains irresponsibly available."}</p><strong>{match.winner === "player" ? "CERTIFICATE OF EXCESSIVE COMPETENCE" : "NOTICE OF TEMPORARY MARTIAL INCONVENIENCE"}</strong></div>
        </div>
        <div className="match-report"><b>{match.round}<small>ROUNDS</small></b><b>{player.damageDealt}<small>DAMAGE DEALT</small></b><b>{player.cardsBought}<small>CARDS BOUGHT</small></b><b>{player.learnedCombos.length}<small>COMBOS LEARNED</small></b></div>
        <div className="victory-certificate-footer"><div className="victory-signature"><span>Certified by</span><b>Assistant Deputy Sensei, Filing Division</b><small>No one verified this signature.</small></div><div className="match-result-actions"><button className="button primary" onClick={() => begin(player.fighterId)}>Instant rematch →</button><button className="button ghost" onClick={() => setMatch(null)}>Choose another fighter</button></div></div>
      </div>
    </section>}
    <section className="playtest-arena">
    <section className="playtest-table">
      <BattleCallout line={match.log[0]} />
      <div className="fighter-column fighter-column--player"><FighterPanel board={player} label="You" onInspect={(card) => setInspectedId(card.id)} /><LearnedComboRack states={learnedComboStates} onInspect={(card) => setInspectedId(card.id)} /></div>
      <section className={`playtest-combat-desk paper-stack state-${match.phase}`}>
        <div className="live-mat-heading"><span className="eyebrow">Live mat · cards in play</span><small>Click any filed card to inspect it</small></div>
        <div className="live-mat-play">
          <MatLane label="Your side" cards={player.playArea} activeId={match.selectedAttackId} onInspect={(card) => setInspectedId(card.id)} />
          <MatLane label="Opponent side" cards={ai.playArea} activeId={match.pendingStrike?.cardId} onInspect={(card) => setInspectedId(card.id)} />
        </div>
        <div className="combat-meters">
          <b><small>FOCUS / POTENTIAL</small>{player.focus}<em>/{playableFocus}</em></b>
          <button type="button" onClick={() => setDeskView("belt")}><small>BELT / XP</small><strong>{belts[player.belt].name}</strong><em>{player.xp} XP</em></button>
          <b className={player.tempo ? "tempo-ready" : ""}><small>TEMPO</small>{player.tempo ? "READY" : "USED"}</b>
        </div>
        <div className="combat-desk-links" aria-label="Open acquisition records">
          <button type="button" onClick={() => setDeskView("market")}><span>Open Market</span><b>{affordableNow}/{match.market.length}</b><small>browse seven cards</small></button>
          <button type="button" onClick={() => setDeskView("combo")}><span>Open Combos</span><b>{player.learnedCombos.length}/2</b><small>inspect the offer</small></button>
        </div>
        <div className="combat-zone-board" aria-label="Combat zones">{["High", "Mid", "Low"].map((zone) => <span className={(match.pendingStrike?.zone === zone || (pendingAttack && match.selectedZone === zone)) ? "is-hot" : ""} key={zone}><b>{zone.slice(0, 1)}</b>{zone}</span>)}</div>
        <p>{match.phase === "player-initiate" ? "Initiate: equip permanent Equipment, then move to Yell." : match.phase === "player-yell" ? "Yell: play any number of legal Attacks from your hand." : match.phase === "player-ascend" ? "Ascend: the acquisition desk is open for Market, Combo, and Belt actions." : match.phase === "defense-window" ? "Reaction Window: play one matching Defense or pass." : match.phase === "reversal-window" ? "Reversal Window: counterattack with one Attack from hand or decline." : settings.autoAi ? "Computer is reviewing several bad ideas…" : "Computer turn: let it make its choices."}</p>
        <ImpactReadout line={match.log[0]} />
        {match.phase === "ai-ready" && !match.winner && !settings.autoAi && <button className="button primary" onClick={runAiTurn}>Run computer turn →</button>}
        {match.phase === "ai-ready" && !match.winner && settings.autoAi && <span className="ai-thinking"><i /><i /><i /> Clipboard thinking</span>}
      </section>
      <div className="fighter-column fighter-column--enemy">
        <FighterPanel board={ai} label="Computer" enemy onInspect={(card) => setInspectedId(card.id)} />
        <section className="playtest-stage-rail paper-stack" aria-label="Current stage">
          <header><span>Current stage</span><b>Honor {match.round}</b></header>
          <button type="button" onClick={() => currentLocation && setInspectedId(currentLocation.id)}><strong>{currentLocation?.name ?? "Tournament Mat"}</strong><small>Inspect stage rules →</small></button>
          <p>{currentLocation?.rulesText ?? "The Department finds no reason to intervene."}</p>
        </section>
      </div>
    </section>
    </section>
    <section className="playtest-workspace playtest-workspace--hand">
      <section className="hand-panel paper-stack">
        <header><div><span className="eyebrow">Your hand · {player.hand.length} cards</span><h2>{match.pendingDiscard ? `Choose ${match.pendingDiscard.remaining} card to discard` : match.phase === "player-initiate" ? "Equip before the yelling starts" : match.phase === "defense-window" ? `Defend ${match.pendingStrike?.zone} or let it land` : match.phase === "reversal-window" ? "Return the favor immediately" : "Choose your next card"}</h2></div><div className="hand-counters"><span>Deck {player.deck.length}</span><span>Discard {player.discard.length}</span><span>Attacks played {player.attacksThisTurn}</span><span>Flow {player.flowUsedThisTurn ? "used" : "ready"}</span><span>Practice {player.defensePracticeUsed ? "used" : "ready"}</span></div></header>
        {match.pendingDiscard && <div className="discard-choice-notice" role="status"><b>{cardFor(match.pendingDiscard.sourceCardId)?.name}</b><span>Select the card you want to discard. The engine will not choose for you.</span></div>}
        <div className="play-card-row">{player.hand.map((id, index) => {
          const card = cardFor(id); if (!card) return null;
          const attack = isAttack(card); const defense = isDefense(card); const permanent = isPermanent(card);
          const choosingDiscard = Boolean(match.pendingDiscard);
          const choosingEffect = Boolean(match.pendingChoice);
          const canInitiate = match.phase === "player-initiate" && permanent && !(playerFighter.name === "Knuckleton the Brawler" && isWeapon(card));
          const canUse = match.phase === "player-yell" && (attack || (defense ? !player.defensePracticeUsed : !permanent));
          const canDefend = match.phase === "defense-window" && defenseOptions.includes(id);
          const canReverse = match.phase === "reversal-window" && attack;
          return <PlayCard key={`${id}-${index}`} card={card} selected={match.selectedAttackId === id} disabled={choosingEffect ? true : choosingDiscard ? false : match.phase === "defense-window" ? !canDefend : match.phase === "reversal-window" ? !canReverse : match.phase === "player-initiate" ? !canInitiate : !canUse} onClick={choosingDiscard ? () => choosePendingDiscard(id) : match.phase === "defense-window" ? () => resolveDefense(id) : match.phase === "reversal-window" ? () => chooseAttack(card) : match.phase === "player-initiate" ? () => equipPermanent(id) : attack ? () => chooseAttack(card) : defense ? () => practiceDefense(id) : () => playSupport(id)} onInspect={() => setInspectedId(id)} />;
        })}</div>
        {match.phase === "player-initiate" && playerFighter.name === "Sensei Ducktape" && !player.abilityUsedRound && player.discard.some((id) => { const card = cardFor(id); return card ? isPermanent(card) : false; }) && <div className="ducktape-tray"><span>Sensei Ducktape · emergency repair</span>{player.discard.filter((id) => { const card = cardFor(id); return card ? isPermanent(card) : false; }).slice(0, 3).map((id) => <button onClick={() => borrowEquipment(id)} key={id}>Jury-rig {cardFor(id)?.name}</button>)}</div>}
        {match.phase === "reversal-window" && pendingAttack?.zone?.includes("Any") && <div className="hand-context-strip"><span>Choose reversal zone</span><fieldset className="zone-picker"><legend className="sr-only">Reversal zone</legend>{["High", "Mid", "Low"].map((zone) => <button type="button" className={match.selectedZone === zone ? "is-selected" : ""} onClick={() => setMatch((current) => current ? { ...current, selectedZone: zone } : current)} key={zone}>{zone}</button>)}</fieldset></div>}
        {match.phase === "player-yell" && !match.pendingDiscard && pendingAttack && (pendingAttack.zone?.includes("Any") || (playerFighter.name === "Whirlwind Wynn" && player.attacksThisTurn === 0 && hasTag(pendingAttack, "Spin"))) && <div className="hand-context-strip"><span>Declare zone for {pendingAttack.name}</span><fieldset className="zone-picker"><legend className="sr-only">Attack zone</legend>{["High", "Mid", "Low"].map((zone) => <button type="button" className={match.selectedZone === zone ? "is-selected" : ""} onClick={() => setMatch((current) => current ? { ...current, selectedZone: zone } : current)} key={zone}>{zone}</button>)}</fieldset></div>}
      </section>
    </section>
    {!match.winner && <nav className={`playtest-action-dock dock-${match.phase}`} aria-label="Next legal action">
      <div>
        <span>{match.pendingDiscard ? "DISCARD" : match.phase === "player-initiate" ? "INITIATE" : match.phase === "player-yell" ? "YELL" : match.phase === "player-ascend" ? "ASCEND" : match.phase === "defense-window" ? "REACTION" : match.phase === "reversal-window" ? "REVERSAL" : "OPPONENT"}</span>
        <b>{match.pendingDiscard ? "Choose a card from your hand" : match.phase === "player-initiate" ? "Equipment first" : match.phase === "player-yell" ? pendingAttack ? `${pendingAttack.name} selected` : `${player.attacksThisTurn} attack${player.attacksThisTurn === 1 ? "" : "s"} played · no cap` : match.phase === "player-ascend" ? `${player.focus} Focus · Market → Combo → Belt` : match.phase === "defense-window" ? `${match.pendingStrike?.zone} strike incoming` : match.phase === "reversal-window" ? pendingAttack ? `${pendingAttack.name} ready` : "Choose an Attack" : settings.autoAi ? "Clipboard thinking…" : "Computer is waiting"}</b>
      </div>
      {match.phase === "player-initiate" && <button onClick={beginYell}>Proceed to Yell →</button>}
      {match.phase === "player-yell" && !match.pendingDiscard && <div className="dock-action-group">{pendingAttack && <button onClick={declareAttack}>Declare Attack →</button>}<button className={pendingAttack ? "dock-secondary" : ""} onClick={enterAscend}>{pendingAttack ? "Skip selected card · Ascend" : "Proceed to Ascend →"}</button></div>}
      {match.phase === "player-ascend" && <button onClick={() => setDeskView(deskView ?? "market")}>{deskView === "belt" ? "Resume Belt Check" : deskView === "combo" ? "Resume Combo Review" : "Resume Ascend Review"} →</button>}
      {match.phase === "defense-window" && <button onClick={() => resolveDefense(null)}>Pass Reaction</button>}
      {match.phase === "reversal-window" && <div className="dock-action-group">{pendingAttack && <button onClick={resolveReversal}>Launch Reversal →</button>}<button className={pendingAttack ? "dock-secondary" : ""} onClick={declineReversal}>Decline Reversal</button></div>}
      {match.phase === "ai-ready" && !settings.autoAi && <button onClick={runAiTurn}>Run computer turn →</button>}
    </nav>}
    <footer className="playtest-utility-dock" aria-label="Quick Duel utilities">
      <div className="playtest-utility-group"><button type="button" className={`utility-coach ${settings.guided ? "" : "is-off"}`} onClick={() => { if (!settings.guided) setSettings({ ...settings, guided: true }); setCoachOpen(true); }}>{settings.guided ? "Decision Coach" : "Coach Off · Re-enable"}</button><button type="button" onClick={() => setLogOpen(true)}>Fight Log <b>{match.log.length}</b></button></div>
      <div className="playtest-utility-group playtest-utility-group--nav"><span className={`rules-sync rules-sync--${rulesSync.status}`}>{rulesSync.status === "update-available" ? `Rules ${rulesSync.latestVersion} ready` : rulesSync.status === "offline" ? "Rules offline" : "Rules synced"}</span>{rulesSync.status === "update-available" && <button onClick={() => window.location.reload()}>Reload</button>}<button onClick={() => setMatch(null)}>New Duel</button><button onClick={() => goTo("rules")}>Rules</button><button onClick={() => goTo("cards")}>Cards</button></div>
    </footer>
    {deskView && <div className="ascend-desk-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDeskView(null)}>
      <section className="ascend-desk paper-stack" role="dialog" aria-modal="true" aria-labelledby="ascend-desk-title">
        <header className="ascend-desk-header">
          <div><span className="eyebrow">{match.phase === "player-ascend" ? `Ascend review · step ${ascendStepIndex + 1} of 3` : "Reference desk · inspection only"}</span><h2 id="ascend-desk-title">{ascendStepTitle}</h2><p>{match.phase === "player-ascend" ? ascendStepHelp : "Inspect this station without advancing the turn."}</p></div>
          <div className="ascend-desk-balance"><span>Available Focus</span><b>{player.focus}</b><small>{affordableNow} of {match.market.length} Market cards in reach</small></div>
          <button className="modal-close" onClick={() => setDeskView(null)} aria-label="Close Ascend Desk">×</button>
        </header>
        {match.phase === "player-ascend" && <section className="ascend-guide" aria-label="Ascend review path">
          <div className="ascend-guide-kicker"><span>Do these in order</span><b>Shop → Combo → Belt → Hide</b></div>
          <ol>
            <li className={ascendStepIndex === 0 ? "is-current" : ascendStepIndex > 0 ? "is-complete" : ""}><b>1</b><div><span>Shared Market</span><small>Spend Focus · buy any number</small></div></li>
            <li className={ascendStepIndex === 1 ? "is-current" : ascendStepIndex > 1 ? "is-complete" : ""}><b>2</b><div><span>Combo Docket</span><small>Learn or pass once</small></div></li>
            <li className={ascendStepIndex === 2 ? "is-current" : ""}><b>3</b><div><span>Belt Check</span><small>XP + exam + reward</small></div></li>
            <li><b>4</b><div><span>Hide</span><small>Clear Focus · redraw</small></div></li>
          </ol>
        </section>}
        <div className="ascend-desk-body">
          {match.phase === "player-ascend" && <aside className={`ascend-step-coach step-${ascendStepIndex + 1}`}><b>STEP {ascendStepIndex + 1}</b><span>{ascendStepHelp}</span></aside>}
          {deskView === "market" && <section className="ascend-market" aria-label="Seven-card Shared Market">
            <header><div><span className="eyebrow">Seven live records · full cards</span><h3>Choose with the text visible</h3></div><p>{match.phase === "player-ascend" ? "Buy any number you can afford. Each purchase is replaced immediately by the top Market card." : "The row persists between rounds. If nobody buys for a full round, Market Mercy refreshes all seven cards."}</p></header>
            <div className="ascend-market-grid">{match.market.map((id) => { const card = cardFor(id); if (!card) return null; const affordable = player.focus >= cardCost(card); return <PlayCard key={id} card={card} selected={match.phase === "player-ascend" && affordable} disabled={match.phase !== "player-ascend" || !affordable} onClick={() => buyMarket(id)} onInspect={() => setInspectedId(id)} />; })}</div>
          </section>}
          {deskView === "combo" && <section className="ascend-combo combo-panel">
            <p className="combo-digital-note"><b>Learned Combos stay face up beside your fighter.</b> During Yell, the live Combo rack shows the printed requirement and previews whether your selected Attack will complete it. Supported payoffs fire automatically; anything not yet automated is labeled instead of being silently faked.</p>
            <header><div><span className="eyebrow">One face-up offer · one attempt per turn</span><h3>{player.learnedCombos.length ? `${player.learnedCombos.length}/2 learned` : "Reveal. Learn. Regret."}</h3></div><span className="combo-limit">{player.comboAttemptedTurn ? "Attempt filed" : "Ready"}</span></header>
            {comboOffer ? <div className="combo-offer"><NativeCardArt card={comboOffer} /><div><span>{comboOffer.catalogId}</span><h3>{comboOffer.name}</h3><p>{comboOffer.rulesText}</p><div><b>{cardCost(comboOffer)} Focus</b><button onClick={() => setInspectedId(comboOffer.id)}>Inspect full card</button></div></div></div> : <p>The Combo docket has escaped the filing cabinet.</p>}
            {match.phase === "player-ascend" && comboOffer && !player.comboAttemptedTurn && <div className="combo-actions"><button className="button primary" disabled={player.focus < cardCost(comboOffer) || player.learnedCombos.length >= 2} onClick={() => cycleCombo(true)}>Learn {comboOffer.name}</button><button className="button ghost" onClick={() => cycleCombo(false)}>Pass · bottom deck</button></div>}
            {match.phase !== "player-ascend" && <p className="combo-spent">Combo actions unlock during Ascend.</p>}
            {player.comboAttemptedTurn && <p className="combo-spent">Combo attempt filed for this turn.</p>}
            {player.learnedCombos.length > 0 && <div className="learned-combos">{player.learnedCombos.map((id) => { const learned = cardFor(id); if (!learned) return null; return <button key={id} onClick={() => setInspectedId(id)}><span>∞</span><b>{learned.name}</b><small>{player.triggeredCombos.includes(id) ? "Triggered this round" : "Face up · watches automatically"}</small><small className="combo-requirement-mini">Requirement: {comboRequirementText(learned)}</small><small className="combo-requirement-mini">Payoff: {comboPayoffText(learned)}</small></button>; })}</div>}
          </section>}
          {deskView === "belt" && <section className="ascend-belt belt-panel">
            <span className="eyebrow">Certification ledger</span><h3>{belts[player.belt].name} Belt · {player.xp} XP</h3>
            <p>{nextBelt ? <><b>Next: {nextBelt.name} · {nextBelt.xp} XP.</b> {nextBelt.task}</> : "Every available Belt has been certified."}</p>
            <div className="belt-track">{belts.map((belt, index) => <span className={index <= player.belt ? "earned" : ""} key={belt.name} title={`${belt.name} Belt · ${belt.xp} XP`}>{belt.name.slice(0, 1)}</span>)}</div>
            <div className="belt-ledger-list">{belts.map((belt, index) => <article className={index === player.belt ? "is-current" : index < player.belt ? "is-earned" : ""} key={belt.name}><span>{index < player.belt ? "✓" : index === player.belt ? "●" : index + 1}</span><div><b>{belt.name} Belt</b><small>{belt.xp} XP · {belt.task || "Starting certification"}</small></div></article>)}</div>
            {nextBelt && <button className="button primary" disabled={match.phase !== "player-ascend" || !canPromote} onClick={promote}>{canPromote && match.phase === "player-ascend" ? `Promote to ${nextBelt.name} →` : match.phase !== "player-ascend" ? "Promotion opens during Ascend" : `${nextBelt.name}: ${nextBelt.xp} XP + completed task`}</button>}
          </section>}
        </div>
        <footer className="ascend-desk-footer"><details><summary>Recent fight filings</summary><ol>{match.log.slice(0, 6).map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}</ol></details>{match.phase === "player-ascend" && <div className="ascend-guide-actions">{deskView !== "market" && <button className="button ghost" onClick={() => setDeskView(deskView === "belt" ? "combo" : "market")}>← Previous review</button>}<div><small>{deskView === "belt" ? "Last stop. Hide clears any unspent Focus." : `Next: ${deskView === "combo" ? "check Belt progress" : "review the Combo offer"}.`}</small><button className="button primary ascend-next" onClick={advanceAscendReview}>{ascendNextLabel}</button></div></div>}</footer>
      </section>
    </div>}
    {match.pendingChoice && <div className="playtest-inspector-backdrop effect-choice-backdrop"><section className="effect-choice-dialog paper-stack" role="dialog" aria-modal="true" aria-labelledby="effect-choice-title"><span className="eyebrow">Printed effect · your decision</span><h2 id="effect-choice-title">{match.pendingChoice.kind === "destroy-junk" ? "Choose Junk to destroy" : "Discard to draw?"}</h2><p>{match.pendingChoice.kind === "destroy-junk" ? `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This card"} requires ${match.pendingChoice.remaining} more Junk card${match.pendingChoice.remaining === 1 ? "" : "s"} from your hand or discard pile.` : `${cardFor(match.pendingChoice.sourceCardId)?.name ?? "This Attack"} lets you discard ${match.pendingChoice.remaining} card${match.pendingChoice.remaining === 1 ? "" : "s"} to draw ${match.pendingChoice.draw}. You may decline.`}</p><div className="effect-choice-options">{pendingChoiceOptions.map((entry) => { const option = cardFor(entry.id); if (!option) return null; return <button type="button" onClick={() => resolvePendingChoice(entry.id, entry.source)} key={`${entry.source}-${entry.id}-${entry.index}`}><span>{entry.source === "discard" ? "DISCARD PILE" : "HAND"}</span><b>{option.name}</b><small>{option.catalogId} · {option.subtype || option.cardType}</small></button>; })}</div>{match.pendingChoice.kind === "discard-draw" && <footer><button className="button ghost" onClick={skipPendingChoice}>Skip this optional effect</button></footer>}</section></div>}
    {coachOpen && !match.winner && <div className="playtest-inspector-backdrop coach-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCoachOpen(false)}><section className="coach-dialog paper-stack" role="dialog" aria-modal="true" aria-labelledby="coach-dialog-title"><button className="modal-close" onClick={() => setCoachOpen(false)} aria-label="Close Decision Coach">×</button><span className="eyebrow">Decision coach · optional guidance</span><h2 id="coach-dialog-title">What should I do now?</h2><div className={`turn-coach turn-coach--${match.phase}`} aria-live="polite"><span>Recommended next step</span><p>{turnCoach}</p></div><div className="coach-dialog-actions"><button className="button primary" onClick={() => setCoachOpen(false)}>Back to the mat →</button><button className="button ghost" onClick={() => { setSettings({ ...settings, guided: false }); setCoachOpen(false); }}>Turn coach off</button></div><small>You can re-enable the Coach from the utility bar at any time.</small></section></div>}
    {logOpen && <div className="playtest-inspector-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setLogOpen(false)}><section className="fight-log-dialog paper-stack" role="dialog" aria-modal="true" aria-labelledby="fight-log-title"><button className="modal-close" onClick={() => setLogOpen(false)} aria-label="Close Fight Log">×</button><span className="eyebrow">Department combat archive</span><h2 id="fight-log-title">Fight Log</h2><p>Newest filing first. Nobody has checked the handwriting.</p><ol>{match.log.map((line, index) => <li key={`${line}-${index}`}><b>{match.log.length - index}</b><span>{line}</span></li>)}</ol></section></div>}
    {inspected && <div className="playtest-inspector-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setInspectedId(null)}>
      <article className={`playtest-inspector paper-stack ${inspectorZoomed ? "is-zoomed" : ""} ${inspectedBoard ? "is-fighter-dossier" : ""}`} role="dialog" aria-modal="true" aria-labelledby="playtest-inspector-title">
        <button className="modal-close" onClick={() => setInspectedId(null)} aria-label="Close Card Inspector">×</button>
        <div className="inspector-heading">
          <button type="button" className="inspector-card-visual" onClick={() => setInspectorZoomed((current) => !current)} aria-label={`${inspectorZoomed ? "Reduce" : "Magnify"} ${inspected.name}`}>
            {artistUrl(inspected) ? <img src={artistUrl(inspected)} alt={inspected.name} /> : <NativeCardArt card={inspected} />}
            <span>{inspectorZoomed ? "Return to dossier" : "Click card to zoom"}</span>
          </button>
          <div className="inspector-copy"><span className="eyebrow">{inspected.catalogId} · {inspected.cardType} · {inspected.subtype}</span><h2 id="playtest-inspector-title">{inspected.name}</h2><p>{inspected.flavorText}</p></div>
        </div>
        {inspectedBoard ? <dl className="fighter-inspector-stats">
          <div><dt>ATK</dt><dd>{fighterStat(inspectedBoard, "ATK")}</dd></div><div><dt>DEF</dt><dd>{fighterStat(inspectedBoard, "DEF")}</dd></div><div><dt>SPD</dt><dd>{fighterStat(inspectedBoard, "Speed")}</dd></div><div><dt>XP</dt><dd>{inspectedBoard.xp}</dd></div><div><dt>Focus</dt><dd>{inspectedBoard.focus}</dd></div><div><dt>Belt</dt><dd>{belts[inspectedBoard.belt].name}</dd></div>
        </dl> : <dl><div><dt>Focus Cost</dt><dd>{inspected.fpCost ?? "—"}</dd></div><div><dt>Focus Value</dt><dd>{inspected.focusValue ?? "—"}</dd></div><div><dt>Zone</dt><dd>{inspected.zone ?? "—"}</dd></div><div><dt>Timing</dt><dd>{inspected.timing ?? "—"}</dd></div></dl>}
        <section className="inspector-rules"><span>Printed rules text</span><p>{inspected.rulesText ?? "No printed rules text."}</p></section>
        {inspectedBoard && <section className="inspector-loadout"><header><div><span className="eyebrow">Current equipment</span><h3>Fighter loadout</h3></div><small>{inspectedBoard.equipment.length} equipped card{inspectedBoard.equipment.length === 1 ? "" : "s"}</small></header><div className="inspector-loadout-grid">{LOADOUT_SLOTS.map((slot) => { const equipped = inspectedBoard.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card && equipmentSlotLabel(card) === slot)); return <article className={`equipment-slot ${equipped.length ? "is-filled" : ""}`} key={slot}><span>{slot}</span>{equipped.length ? <div>{equipped.map((item, index) => <button type="button" onClick={() => setInspectedId(item.id)} key={`${item.id}-${index}`}><span className="equipment-slot-art">{artistUrl(item) ? <img src={artistUrl(item)} alt="" /> : <NativeCardArt card={item} />}</span><b>{item.name}</b><small>{item.details?.Slot ? String(item.details.Slot) : item.subtype}</small></button>)}</div> : <em>Empty</em>}</article>; })}</div></section>}
        <footer>{inspectedBoard ? "Click an equipped card to inspect it. " : `${cardEffectNote(inspected)} `}Click the card image to magnify it. Press Escape to close.</footer>
      </article>
    </div>}
  </main>;
}

function beltTaskMet(board: Board) {
  const next = board.belt + 1;
  if (next === 1) return ["High", "Mid", "Low"].every((zone) => board.zonesPlayed.some((played) => played.toLocaleLowerCase() === zone.toLocaleLowerCase()));
  if (next === 2) return board.attacksThisTurn >= 2 && board.hitThisTurn;
  if (next === 3) return board.defendedThisRound && board.attackedThisRound;
  if (next === 4) return new Set(board.purchasedTypes).size >= 2;
  if (next === 5) return board.equipment.length >= 2;
  if (next === 6) return board.comboTriggered;
  if (next === 7) {
    const playTypes = board.cardsThisTurn.map(cardFor).filter(Boolean) as CardEntry[];
    return playTypes.length >= 4 && playTypes.some(isAttack) && playTypes.some(isKata) && playTypes.some((card) => isPermanent(card) || card.subtype === "Consumable");
  }
  return false;
}

function markCompletedTask(board: Board) {
  const next = board.belt + 1;
  if (!beltTaskMet(board) || board.completedTasks.includes(next)) return board;
  return { ...board, completedTasks: [...board.completedTasks, next] };
}

function applyBeltPromotion(board: Board, beltIndex: number) {
  const reward = belts[beltIndex]?.reward ?? "";
  const maxHpIncrease = /\+10 Max HP/i.test(reward) ? 10 : 0;
  const maxHp = board.maxHp + maxHpIncrease;
  const hp = maxHpIncrease && board.hp > 0 ? Math.min(maxHp, board.hp + 5) : board.hp;
  return { ...board, belt: beltIndex, maxHp, hp };
}

function openAiStrike(current: Match, cardId: string, remainingAiAttacks: string[], useTempo: boolean) {
  const card = cardFor(cardId)!;
  const fighter = cardFor(current.ai.fighterId);
  const anyZone = attackHasFlexibleZone(current.ai, card);
  const zone = anyZone ? ["High", "Mid", "Low"][Math.floor(Math.random() * 3)] : card.zone?.split(",")[0] ?? "High";
  const tempoBonus = useTempo && current.ai.tempo && fighterStat(current.ai, "Speed") > fighterStat(current.player, "Speed") ? 1 : 0;
  const locationModifier = locationAttackModifier(cardFor(current.locationId), card, current.ai, zone);
  const fighterModifier = fighterAttackModifier(current.ai, current.player, card);
  const printedModifier = printedAttackRuleModifier(current.ai, current.player, card, zone);
  const incomingModifier = incomingAttackEquipmentModifier(current.player);
  const comboModifier = comboAttackModifier(current.ai, card, zone);
  const piercingModifier = attackPiercingModifier(current.ai, current.player, card, zone, comboModifier.piercing);
  const hasFlow = attackHasFlow(current.ai, card, comboModifier);
  const attackPower = Math.max(0, cardPower(card) + fighterStat(current.ai, "ATK") + current.ai.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + comboModifier.power);
  let nextAi = applyCardEffects({ ...current.ai, hand: removeOne(current.ai.hand, card.id), playArea: [...current.ai.playArea, card.id], xp: current.ai.xp + 1, attacksThisTurn: current.ai.attacksThisTurn + 1, attackedThisRound: true, zonesPlayed: [...current.ai.zonesPlayed, zone], cardsThisTurn: [...current.ai.cardsThisTurn, card.id], nextAttackBonus: 0, nextAttackHasFlow: false, tempo: tempoBonus ? false : current.ai.tempo, wasHitSinceLastTurn: current.ai.attacksThisTurn === 0 ? false : current.ai.wasHitSinceLastTurn, triggeredCombos: [...current.ai.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.ai.comboTriggered || comboModifier.triggeredIds.length > 0 }, card, "ai");
  const flowDraw = hasFlow && !current.ai.flowUsedThisTurn;
  if (flowDraw) nextAi = drawCards({ ...nextAi, flowUsedThisTurn: true }, 1);
  if (current.ai.flowAfterFirstAttack && current.ai.attacksThisTurn === 0) nextAi = { ...nextAi, flowAfterFirstAttack: false, nextAttackHasFlow: true };
  const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...printedModifier.notes, ...incomingModifier.notes, ...comboModifier.notes, ...piercingModifier.notes];
  return { ...current, player: { ...current.player, attacksReceivedThisRound: (current.player.attacksReceivedThisRound ?? 0) + 1 }, ai: nextAi, phase: "defense-window" as const, pendingStrike: { cardId, zone, attackPower, damageModifier: locationModifier.damage + fighterModifier.damage + comboModifier.damage, piercing: piercingModifier.value, modifierNotes: modifiers, remainingAiAttacks }, log: [`Computer declares ${card.name} to ${zone}. ${tempoBonus ? "Tempo adds +1. " : ""}${flowDraw ? "Flow draws 1 card. " : ""}${modifiers.length ? `${modifiers.join("; ")}. ` : ""}Choose one matching Defense or pass.`, ...current.log].slice(0, 32) };
}

function finishAiTurn(current: Match, line: string, sceneChanges: boolean) {
  const aiPurchase = current.market.filter((id) => numberValue(cardFor(id)?.fpCost) <= current.ai.focus).sort((left, right) => aiMarketScore(cardFor(right)!, current.ai) - aiMarketScore(cardFor(left)!, current.ai))[0];
  const purchasedCard = aiPurchase ? cardFor(aiPurchase) : null;
  let aiAfterPurchase = purchasedCard ? markCompletedTask({ ...current.ai, focus: current.ai.focus - numberValue(purchasedCard.fpCost), discard: [...current.ai.discard, purchasedCard.id], purchasedTypes: [...current.ai.purchasedTypes, purchasedCard.cardType], cardsBought: current.ai.cardsBought + 1 }) : current.ai;
  let market = current.market;
  let marketDeck = current.marketDeck;
  let marketDiscard = current.marketDiscard;
  if (purchasedCard) {
    const slot = current.market.indexOf(purchasedCard.id);
    const refilled = refillPurchasedMarketSlot(current.market, marketDeck, marketDiscard, slot);
    market = refilled.market;
    marketDeck = refilled.marketDeck;
    marketDiscard = refilled.marketDiscard;
  }
  let promotionLog: string | null = null;
  const nextBelt = belts[aiAfterPurchase.belt + 1];
  if (nextBelt && aiAfterPurchase.xp >= nextBelt.xp && aiAfterPurchase.completedTasks.includes(aiAfterPurchase.belt + 1)) {
    const before = aiAfterPurchase;
    aiAfterPurchase = applyBeltPromotion(aiAfterPurchase, aiAfterPurchase.belt + 1);
    promotionLog = `Computer certifies ${nextBelt.name} Belt.${aiAfterPurchase.maxHp > before.maxHp ? ` Max HP ${before.maxHp} → ${aiAfterPurchase.maxHp}; HP ${before.hp} → ${aiAfterPurchase.hp}.` : ""}`;
  }
  const nextAi = playAreaCleanup(aiAfterPurchase);
  const purchaseLog = purchasedCard ? `Computer buys ${purchasedCard.name}.` : "Computer buys nothing.";
  const finished = { ...current, ai: nextAi, market, marketDeck, marketDiscard, marketPurchasedThisRound: current.marketPurchasedThisRound || Boolean(purchasedCard), log: [purchaseLog, ...(promotionLog ? [promotionLog] : []), line, ...current.log].slice(0, 32) };
  if (current.turnIndex === 0) return { ...finished, phase: "player-initiate" as const, turnIndex: 1 as const, log: ["You are second in this round's initiative order. Initiate begins now.", ...finished.log].slice(0, 32) };
  return advanceRound(finished, sceneChanges, "Both fighters have completed the round.");
}

function advanceRound(current: Match, sceneChanges: boolean, line: string) {
  const nextRound = current.round + 1;
  const freshLocations = current.locations.length ? current.locations : shuffle(quickDuelLocationPool.map((card) => card.id));
  const locationId = sceneChanges ? freshLocations[0] ?? current.locationId : current.locationId;
  const player = { ...current.player, xp: current.player.xp + 1, tempo: true, tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], damageReductionUsed: false, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] };
  const ai = { ...current.ai, xp: current.ai.xp + 1, tempo: true, tempSpeed: 0, speedChangedThisRound: false, nextAttackBonus: 0, attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, attacksReceivedThisRound: 0, nextDefenseCardBonus: 0, defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], damageReductionUsed: false, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] };
  const marketState = current.marketPurchasedThisRound
    ? { market: current.market, marketDeck: current.marketDeck, marketDiscard: current.marketDiscard }
    : refreshMarketRow(current.market, current.marketDeck, current.marketDiscard);
  const playerFirst = fighterStat(player, "Speed") >= fighterStat(ai, "Speed");
  const turnOrder: Match["turnOrder"] = playerFirst ? ["player", "ai"] : ["ai", "player"];
  const marketNote = current.marketPurchasedThisRound ? "The Shared Market remains in place." : "No one bought a card, so Market Mercy refreshes all seven slots.";
  return { ...current, ...marketState, player, ai, marketPurchasedThisRound: false, pendingDiscard: null, pendingChoice: null, locationId, locations: sceneChanges ? freshLocations.slice(1) : current.locations, round: nextRound, phase: playerFirst ? "player-initiate" as const : "ai-ready" as const, turnOrder, turnIndex: 0 as const, selectedAttackId: null, log: [`Honor ${nextRound}: ${cardFor(locationId)?.name ?? "Tournament Mat"} is active. Both fighters gain 1 XP and refresh Tempo. ${marketNote} ${playerFirst ? "You" : "Computer"} take initiative.`, line, ...current.log].slice(0, 32) };
}

function prepareAiTurn(current: Match) {
  const fighter = cardFor(current.ai.fighterId);
  const practiceId = current.ai.defensePracticeUsed ? undefined : current.ai.hand
    .filter((id) => { const card = cardFor(id); return Boolean(card && isDefense(card)); })
    .sort((left, right) => cardFocus(cardFor(right)) - cardFocus(cardFor(left)))[0];
  let nextAi = practiceId ? {
    ...current.ai,
    hand: removeOne(current.ai.hand, practiceId),
    playArea: [...current.ai.playArea, practiceId],
    focus: current.ai.focus + cardFocus(cardFor(practiceId)),
    defensePracticeUsed: true,
  } : current.ai;
  const supportIds = nextAi.hand.filter((id) => {
    const card = cardFor(id);
    return Boolean(card && !isAttack(card) && !isDefense(card) && card.subtype !== "Junk" && !(fighter?.name === "Knuckleton the Brawler" && isWeapon(card)));
  });
  if (!supportIds.length && !practiceId) return current;
  const played: string[] = [];
  let nextPlayer = current.player;
  for (const id of supportIds) {
    const card = cardFor(id);
    if (!card) continue;
    const locationModifier = locationFocusModifier(cardFor(current.locationId), card, nextAi);
    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], focus: nextAi.focus + locationModifier.value }, card, "ai");
    if (destroysAfterUse(card)) nextAi = destroyResolvedConsumable(nextAi, card);
    const defensePenalty = targetNextDefensePenalty(card);
    if (defensePenalty) nextPlayer = { ...nextPlayer, nextDefenseCardBonus: (nextPlayer.nextDefenseCardBonus ?? 0) - defensePenalty };
    played.push(card.name);
  }
  const preparations = [
    ...(practiceId ? [`Defense Practice with ${cardFor(practiceId)?.name}`] : []),
    ...played,
  ];
  return { ...current, player: nextPlayer, ai: nextAi, log: [`Computer prepares with ${preparations.join(", ")}. The strategy is now technically documented.`, ...current.log].slice(0, 32) };
}
