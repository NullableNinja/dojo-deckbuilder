import { useEffect, useMemo, useState } from "react";
import cardPlaceholderUrl from "./assets/art/card-placeholder-v2.webp";
import starterJabArtUrl from "./assets/starter/starter-jab-art-v2.webp";
import highGuardArtUrl from "./assets/starter/high-guard-art-v2.webp";
import cardsJson from "./data/cards.json";
import gameDefinitionJson from "./data/game-definition.json";
import rulesJson from "./data/rules.json";
import { compileCardEffects, describeEffectPlan } from "./card-effects";
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
};

type PendingStrike = {
  cardId: string;
  zone: string;
  attackPower: number;
  damageModifier: number;
  modifierNotes: string[];
  remainingAiAttacks: string[];
};

type PendingDiscard = {
  sourceCardId: string;
  remaining: number;
};

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

const cardArtModules = import.meta.glob<string>("./assets/cards/{attacks,defenses,katas,consumables,defense-equipment,characters}/*.webp", { eager: true, query: "?url", import: "default" });
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
type ComboModifier = AttackModifier & { focusOnHit: number; grantsFlow: boolean; triggeredIds: string[] };

function comboAttackModifier(board: Board, card: CardEntry, zone: string, isReversal = false): ComboModifier {
  const result: ComboModifier = { power: 0, damage: 0, focusOnHit: 0, grantsFlow: false, triggeredIds: [], notes: [] };
  const priorCards = board.cardsThisTurn.map(cardFor).filter(Boolean) as CardEntry[];
  const priorAttacks = priorCards.filter(isAttack);
  const priorZone = board.zonesPlayed.at(-1);
  for (const comboId of board.learnedCombos) {
    if (board.triggeredCombos.includes(comboId)) continue;
    const combo = cardFor(comboId);
    if (!combo) continue;
    const text = combo.rulesText ?? "";
    let recognizedTrigger = /Requirement:/i.test(text);
    if (/play(?:ed)? a Kata|Kata that/i.test(text) && !priorCards.some(isKata)) continue;
    if (/Block(?:ed)? an? Attack|after you played a Defense/i.test(text) && !board.defendedThisRound) continue;
    if (combo.tags.includes("Kata")) {
      if (!priorCards.some(isKata)) continue;
      recognizedTrigger = true;
    }
    if (combo.tags.includes("Block")) {
      if (!board.defendedThisRound) continue;
      recognizedTrigger = true;
    }
    if (combo.tags.includes("Jump") && combo.tags.includes("Kick")) {
      if (!priorAttacks.some((entry) => hasTag(entry, "Jump")) || !hasTag(card, "Kick")) continue;
      recognizedTrigger = true;
    }
    if (/second Attack/i.test(text)) { if (board.attacksThisTurn !== 1) continue; recognizedTrigger = true; }
    if (/third Attack|first two Attacks/i.test(text)) { if (board.attacksThisTurn < 2) continue; recognizedTrigger = true; }
    if (/first Attack Hit|first Attack Hits/i.test(text)) { if (!board.hitThisTurn || board.attacksThisTurn < 1) continue; recognizedTrigger = true; }
    if (/different zone/i.test(text) && (!priorZone || priorZone === zone)) continue;
    if (/Requirement:[^.]*\bMid Attack/i.test(text) && zone !== "Mid") continue;
    if (/Requirement:[^.]*\bHigh Attack/i.test(text) && zone !== "High") continue;
    if (/Requirement:[^.]*\bLow Attack/i.test(text) && zone !== "Low") continue;
    if (/Requirement:[^.]*Reversal/i.test(text) && !isReversal) continue;
    if (/Punch/i.test(text) && combo.tags.some((tag) => /Punch|Hand/.test(tag)) && !hasTag(card, "Punch") && !hasTag(card, "Hand")) continue;
    if (/Kick/i.test(text) && combo.tags.includes("Kick") && !hasTag(card, "Kick")) continue;
    if (/Weapon Attack/i.test(text) && !hasTag(card, "Weapon")) continue;
    if (!recognizedTrigger) continue;
    const power = numberValue(text.match(/\+(\d+) Attack Power/i)?.[1]);
    const damage = numberValue(text.match(/\+(\d+) Damage/i)?.[1]);
    const focusOnHit = numberValue(text.match(/gain (\d+) Focus/i)?.[1]);
    const grantsFlow = /(?:final|Hand|Low|Mid|High|the) Attack[^.]*gains Flow/i.test(text);
    if (!power && !damage && !focusOnHit && !grantsFlow) continue;
    result.power += power;
    result.damage += damage;
    result.focusOnHit += focusOnHit;
    result.grantsFlow ||= grantsFlow;
    result.triggeredIds.push(combo.id);
    result.notes.push(`${combo.name} ${power ? `+${power} power` : damage ? `+${damage} damage` : focusOnHit ? `files a Focus payoff` : `grants Flow`}`);
  }
  return result;
}

function locationAttackModifier(location: CardEntry | undefined, card: CardEntry, board: Board, zone: string): AttackModifier {
  if (!location) return { power: 0, damage: 0, notes: [] };
  const firstAttack = board.attacksThisTurn === 0;
  let damage = 0;
  const notes: string[] = [];
  const applyDamage = (amount: number, reason: string) => { damage += amount; notes.push(`${reason} ${amount > 0 ? "+" : ""}${amount} damage`); };
  if (location.name === "City Bus in Motion" && zone === "Mid") applyDamage(1, "bus momentum");
  if (location.name === "Community Ice Rink" && firstAttack) applyDamage(-1, "first-attack footing");
  if (location.name === "Concrete Stairwell" && zone === "High") applyDamage(1, "stairwell height");
  if (location.name === "Concrete Stairwell" && hasTag(card, "Jump")) applyDamage(-1, "low ceiling");
  if (location.name === "Parking Garage Spiral" && hasTag(card, "Spin")) applyDamage(1, "spiral momentum");
  if (location.name === "Parking Garage Spiral" && firstAttack && zone === "Low") applyDamage(1, "first Low Attack");
  if (location.name === "Public Library" && firstAttack) applyDamage(-1, "mandatory quiet");
  if (location.name === "Rain-Slick Alley" && zone === "Low") applyDamage(1, "slick Low Attack");
  if (location.name === "Rain-Slick Alley" && hasTag(card, "Spin")) applyDamage(-1, "spin hazard");
  if (location.name === "River Dock" && hasTag(card, "Push")) applyDamage(2, "dock edge");
  if (location.name === "School Gymnasium" && !board.equipment.some((id) => { const item = cardFor(id); return item ? isWeapon(item) : false; })) applyDamage(1, "unarmed curriculum");
  if (location.name === "Tournament Mat") {
    const hasWeapon = board.equipment.some((id) => { const item = cardFor(id); return item ? isWeapon(item) : false; });
    applyDamage(hasWeapon ? -1 : 1, hasWeapon ? "regulated Weapon" : "unarmed showcase");
  }
  if (location.name === "Yoga Studio") applyDamage(-1, "indoor voice");
  return { power: 0, damage, notes };
}

function locationDefenseModifier(location: CardEntry | undefined, card: CardEntry | null | undefined, board: Board, zone: string): CombatModifier {
  if (!location || !card) return { value: 0, notes: [] };
  const firstDefense = !