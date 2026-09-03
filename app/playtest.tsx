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

type Match = {
  schema: 3;
  rulesVersion: string;
  player: Board;
  ai: Board;
  market: string[];
  marketDeck: string[];
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
  reversalRemainingAiAttacks: string[];
  log: string[];
  winner: "player" | "ai" | null;
};

type Difficulty = "student" | "certified" | "master";
type HouseSettings = { tempo: boolean; locations: boolean; openMarket: boolean; guided: boolean; autoAi: boolean; balancedMarket: boolean; difficulty: Difficulty };
type DeskView = "market" | "combo" | "belt";

const cards = (cardsJson as unknown as { cards: CardEntry[] }).cards;
const catalogRulesVersion = String((cardsJson as unknown as { version: string }).version).split(" ")[0];
const byId = new Map(cards.map((card) => [card.id, card]));
const byCatalogId = new Map(cards.map((card) => [card.catalogId, card]));
const gameDefinition = gameDefinitionJson as unknown as {
  rulesVersion: string;
  mode: { startingHp: number };
  turn: { handSize: number; normalAttackLimit: number };
  starterDeck: { catalogId: string; copies: number }[];
  economy: { market: { rowSize: number } };
};
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
const DIFFICULTIES: Record<Difficulty, { label: string; eyebrow: string; detail: string; aiHp: number; statBoost: number; attacks: number }> = {
  student: { label: "Student", eyebrow: "Learn the mat", detail: "A shorter duel with a less ruthless opponent.", aiHp: 20, statBoost: 0, attacks: 1 },
  certified: { label: "Certified", eyebrow: "Core test", detail: "The intended Quick Duel pressure and two attacks.", aiHp: 25, statBoost: 0, attacks: 2 },
  master: { label: "Grandmaster", eyebrow: "Bad decision", detail: "More HP, sharper stats, and no sympathy from the clipboard.", aiHp: 35, statBoost: 1, attacks: 2 },
};

const cardArtModules = import.meta.glob<string>("./assets/cards/{attacks,defenses,katas,consumables,characters}/*.webp", { eager: true, query: "?url", import: "default" });
const CARD_ART = Object.fromEntries(Object.entries(cardArtModules).map(([path, url]) => [`/cards/${path.split("/cards/")[1]}`, url]));
const COMPLETE_CARD_ART_BY_CATALOG_ID = Object.fromEntries(
  Object.entries(cardArtModules).flatMap(([path, url]) => {
    const match = path.match(/\/(ddb-(?:atk|def|kat|con)-core-\d{3})_/i);
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

type CombatModifier = { value: number; notes: string[] };
type AttackModifier = { power: number; damage: number; notes: string[] };
type ComboModifier = AttackModifier & { focusOnHit: number; triggeredIds: string[] };

function comboAttackModifier(board: Board, card: CardEntry, zone: string, isReversal = false): ComboModifier {
  const result: ComboModifier = { power: 0, damage: 0, focusOnHit: 0, triggeredIds: [], notes: [] };
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
    if (!power && !damage && !focusOnHit) continue;
    result.power += power;
    result.damage += damage;
    result.focusOnHit += focusOnHit;
    result.triggeredIds.push(combo.id);
    result.notes.push(`${combo.name} ${power ? `+${power} power` : damage ? `+${damage} damage` : `files a Focus payoff`}`);
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
    if (stat === "DEF") return total + numberValue(card.stats.Guard);
    return total;
  }, 0);
  const challengeBonus = stat === "ATK" || stat === "DEF" ? board.statBoost ?? 0 : 0;
  return base + beltBonus + equipment + challengeBonus + (stat === "Speed" ? board.tempSpeed : 0);
}

function emptyBoard(fighterId: string): Board {
  return drawCards({
    fighterId, hp: gameDefinition.mode.startingHp, maxHp: gameDefinition.mode.startingHp, xp: 0, focus: 0, belt: 0,
    deck: shuffle(starterIds), hand: [], discard: [], playArea: [], equipment: [],
    tempSpeed: 0, nextAttackBonus: 0, attacksThisTurn: 0, hitThisTurn: false, cardsThisTurn: [], tempo: true, attackedThisRound: false,
    defendedThisRound: false, zonesPlayed: [], purchasedTypes: [], comboTriggered: false, completedTasks: [], statBoost: 0,
    damageReductionUsed: false, wasHitSinceLastTurn: false, borrowedEquipmentId: null, abilityUsedRound: false,
    reversalUsedRound: false, learnedCombos: [], triggeredCombos: [], comboAttemptedTurn: false,
    damageDealt: 0, damageTaken: 0, cardsBought: 0,
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
    if (isPermanent(card)) next.equipment = [...next.equipment, card.id];
  }
  for (const effect of compileCardEffects(card.rulesText ?? "").effects.filter((entry) => entry.timing === timing)) {
    if (effect.kind === "draw") next = drawCards(next, effect.amount);
    if (effect.kind === "discard" && next.hand.length) {
      const discardCount = Math.min(effect.amount, next.hand.length);
      const ranked = [...next.hand].sort((left, right) => numberValue(cardFor(left)?.focusValue) - numberValue(cardFor(right)?.focusValue));
      const discarded = ranked.slice(0, discardCount);
      next = { ...next, hand: next.hand.filter((id) => !discarded.includes(id)), discard: [...next.discard, ...discarded] };
    }
    if (effect.kind === "nextAttackPower") next.nextAttackBonus += effect.amount;
    if (effect.kind === "speed") next.tempSpeed += effect.amount;
    if (effect.kind === "focus") next.focus += effect.amount;
    if (effect.kind === "heal") next.hp = Math.min(next.maxHp, next.hp + effect.amount);
  }
  return next;
}

function legalDefenseIds(board: Board, zone: string) {
  return board.hand.filter((id) => {
    const card = cardFor(id);
    return Boolean(card && isDefense(card) && matchesZone(card, zone));
  });
}

function bestDefense(board: Board, zone: string, attackPower = Number.POSITIVE_INFINITY, difficulty: Difficulty = "certified", location?: CardEntry) {
  const options = legalDefenseIds(board, zone);
  if (!options.length || (difficulty === "student" && Math.random() < .28)) return null;
  const ranked = options.map((id) => {
    const card = cardFor(id)!;
    const modifier = locationDefenseModifier(location, card, board, zone).value;
    return { id, total: fighterStat(board, "DEF") + cardPower(card) + modifier };
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
  return drawCards({ ...board, hand: [], playArea: [], equipment, discard, focus: 0, attacksThisTurn: 0, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0, borrowedEquipmentId: null, wasHitSinceLastTurn: false, comboAttemptedTurn: false }, board.belt >= 5 ? 6 : 5);
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

function FighterPanel({ board, label, enemy, onInspect }: { board: Board; label: string; enemy?: boolean; onInspect: (card: CardEntry) => void }) {
  const fighter = cardFor(board.fighterId)!;
  const art = artistUrl(fighter);
  return <section className={`fighter-panel paper-stack ${enemy ? "is-enemy" : ""}`}>
    <div className="fighter-panel-art">{art ? <img src={art} alt={fighter.name} /> : <img src={cardPlaceholderUrl} alt="" />}</div>
    <div className="fighter-panel-copy"><span>{label} · {belts[board.belt].name} Belt</span><button onClick={() => onInspect(fighter)}>{fighter.name}</button><p>{fighter.rulesText}</p><div className="fighter-hp-track" aria-label={`${fighter.name} has ${board.hp} of ${board.maxHp} hit points`}><span style={{ width: `${Math.max(0, Math.min(100, board.hp / board.maxHp * 100))}%` }} /></div></div>
    <div className="fighter-stats"><b><StatGlyph stat="HP" /><small>HP</small><span>{board.hp}/{board.maxHp}</span></b><b><StatGlyph stat="XP" /><small>XP</small><span>{board.xp}</span></b><b><StatGlyph stat="FP" /><small>FP</small><span>{board.focus}</span></b><b><StatGlyph stat="ATK" /><small>ATK</small><span>{fighterStat(board, "ATK")}</span></b><b><StatGlyph stat="DEF" /><small>DEF</small><span>{fighterStat(board, "DEF")}</span></b><b><StatGlyph stat="SPD" /><small>SPD</small><span>{fighterStat(board, "Speed")}</span></b></div>
    {board.equipment.length > 0 && <div className="fighter-equipment-rack" aria-label={`${fighter.name} equipped cards`}><span>Equipped</span>{board.equipment.map((id, index) => { const card = cardFor(id); if (!card) return null; return <button type="button" onClick={() => onInspect(card)} title={`${card.name} · ${card.subtype}`} key={`${id}-${index}`}>{artistUrl(card) ? <img src={artistUrl(card)} alt="" /> : <b>{card.name.slice(0, 2)}</b>}<small>{card.name}</small></button>; })}</div>}
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
  const visible = cardIds.slice(-4);
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
      <aside className="playtest-rules-panel quick-duel-brief paper-stack"><span className="eyebrow">2 · One official teaser</span><h2>Certified Quick Duel</h2><p>One fighter. One tactical opponent. Fixed HP, the complete Market, Locations, Reversals, Combos, and Belt progression. No mode selection and no setup maze—the Department has already made the questionable decisions.</p><ul><li>Desktop playtest</li><li>Guided tactical opponent</li><li>Real Core card catalog</li></ul><button className="button primary field-test-launch" onClick={() => begin()}>Begin Quick Duel as {selected.name} <span>→</span></button></aside>
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
      return saved?.schema === 3 && saved?.player?.fighterId && saved?.ai?.fighterId && saved.turnOrder?.length === 2 && cardFor(saved.player.fighterId) && cardFor(saved.ai.fighterId) ? saved : null;
    } catch { return null; }
  });
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [inspectorZoomed, setInspectorZoomed] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [deskView, setDeskView] = useState<DeskView | null>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("ddb-field-match") ?? "null") as Match | null;
      return saved?.phase === "player-ascend" ? "market" : null;
    } catch { return null; }
  });
  const [rulesSync, setRulesSync] = useState<RulesSyncState>({ status: "checking", currentVersion: catalogRulesVersion, latestVersion: catalogRulesVersion, checkedAt: 0 });
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
      .then((manifest) => setRulesSync(rulesSyncState(catalogRulesVersion, manifest.rulesVersion)))
      .catch(() => setRulesSync((current) => ({ ...current, status: "offline", checkedAt: Date.now() })));
    void check();
    const timer = window.setInterval(check, 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    setInspectorZoomed(false);
    if (!inspectedId && !deskView && !logOpen) return;
    const previousOverflow = document.body.style.overflow;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (inspectedId) setInspectedId(null);
      else if (deskView) setDeskView(null);
      else setLogOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", close); };
  }, [inspectedId, deskView, logOpen]);

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
    setMatch({ schema: 3, rulesVersion: catalogRulesVersion, player, ai, market: openingMarket.market, marketDeck: openingMarket.marketDeck, comboDeck: comboDeck.slice(1), comboOfferId: comboDeck[0] ?? null, locations: locations.slice(1), locationId: currentLocation, round: 1, phase: playerFirst ? "player-initiate" : "ai-ready", turnOrder, turnIndex: 0, selectedAttackId: null, selectedZone: "High", pendingStrike: null, reversalRemainingAiAttacks: [], winner: null, log: [`${challenge.label} field test opened under rules ${catalogRulesVersion}. The waiver is legally adjacent to complete.`, `Honor 1: ${cardFor(currentLocation)?.name ?? "Tournament Mat"} is active. Both fighters gain 1 XP and refresh Tempo.`, `${playerFirst ? "You" : "Computer"} win initiative on current Speed.`] });
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
    if (!current?.selectedAttackId || current.phase !== "player-yell" || current.winner) return current;
    const card = cardFor(current.selectedAttackId);
    if (!card || current.player.attacksThisTurn >= gameDefinition.turn.normalAttackLimit) return current;
    const anyZone = card.zone?.includes("Any") || (cardFor(current.player.fighterId)?.name === "Whirlwind Wynn" && current.player.attacksThisTurn === 0 && hasTag(card, "Spin"));
    const zone = anyZone ? current.selectedZone : card.zone?.split(",")[0] ?? "High";
    const tempoBonus = settings.tempo && current.player.tempo && fighterStat(current.player, "Speed") > fighterStat(current.ai, "Speed") ? 1 : 0;
    const location = cardFor(current.locationId);
    const locationModifier = locationAttackModifier(location, card, current.player, zone);
    const fighterModifier = fighterAttackModifier(current.player, current.ai, card);
    const comboModifier = comboAttackModifier(current.player, card, zone);
    const attackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + comboModifier.power);
    const defenseId = bestDefense(current.ai, zone, attackPower, settings.difficulty, location);
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    const defenseModifier = locationDefenseModifier(location, defenseCard, current.ai, zone);
    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + (defenseCard ? cardPower(defenseCard) : 0) + defenseModifier.value);
    const hit = attackPower > defensePower;
    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage + comboModifier.damage) : 0;
    const reduced = reduceDamageForFighter(current.ai, rawDamage);
    const damage = reduced.damage;
    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attacksThisTurn: current.player.attacksThisTurn + 1, hitThisTurn: current.player.hitThisTurn || hit, attackedThisRound: true, cardsThisTurn: [...current.player.cardsThisTurn, card.id], zonesPlayed: [...current.player.zonesPlayed, zone], nextAttackBonus: 0, tempo: tempoBonus ? false : current.player.tempo, wasHitSinceLastTurn: current.player.attacksThisTurn === 0 ? false : current.player.wasHitSinceLastTurn, triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0, damageDealt: current.player.damageDealt + damage }, card, "player");
    if (hit && comboModifier.focusOnHit) nextPlayer.focus += comboModifier.focusOnHit;
    let nextAi = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit, damageTaken: reduced.board.damageTaken + damage };
    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true };
    nextPlayer = applyCardEffects(nextPlayer, card, "player", hit ? "onHit" : "afterResolve");
    if (hit) nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve");
    if (defenseCard) {
      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onPlay");
      if (!hit) nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onBlock");
      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve");
    }
    if (damage >= 3 && nextPlayer.belt >= 6) nextPlayer.focus += 1;
    if (!nextAi.hp) nextPlayer.xp += 2;
    nextPlayer = markCompletedTask(nextPlayer);
    const result = hit ? `${card.name} hits ${aiFighter?.name ?? "the opponent"} for ${damage}.` : `${card.name} is blocked${defenseCard ? ` by ${defenseCard.name}` : " by base DEF"}.`;
    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...comboModifier.notes, ...defenseModifier.notes, ...(reduced.note ? [reduced.note] : [])];
    return write(current, `${tempoBonus ? "Tempo +1. " : ""}${result} Attack ${attackPower} vs Defense ${defensePower}.${modifiers.length ? ` ${modifiers.join("; ")}.` : ""}`, { player: nextPlayer, ai: nextAi, selectedAttackId: null, winner: nextAi.hp ? null : "player" });
  });

  const playSupport = (id: string) => setMatch((current) => {
    if (!current || current.phase !== "player-yell" || current.winner) return current;
    const card = cardFor(id);
    if (!card || isAttack(card) || isDefense(card) || isPermanent(card)) return current;
    const locationModifier = locationFocusModifier(cardFor(current.locationId), card, current.player);
    const nextPlayer = markCompletedTask(applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id], focus: current.player.focus + locationModifier.value }, card, "player"));
    return write(current, `${card.name} played. ${cardEffectNote(card)}${locationModifier.notes.length ? ` ${locationModifier.notes.join("; ")}.` : ""}`, { player: nextPlayer });
  });

  const enterAscend = () => {
    setDeskView("market");
    setMatch((current) => current?.phase === "player-yell" ? write(current, "Ascend: the acquisition desk opens. Spend this turn's Focus before it leaves your mat.", { phase: "player-ascend", selectedAttackId: null }) : current);
  };

  const buyMarket = (id: string) => setMatch((current) => {
    if (!current || current.phase !== "player-ascend" || current.winner) return current;
    const card = cardFor(id);
    if (!card || current.player.focus < numberValue(card.fpCost)) return current;
    const replacement = current.marketDeck[0];
    const nextPlayer = markCompletedTask({ ...current.player, focus: current.player.focus - numberValue(card.fpCost), discard: [...current.player.discard, id], purchasedTypes: [...current.player.purchasedTypes, card.cardType], cardsBought: current.player.cardsBought + 1 });
    const nextMarket = replacement ? current.market.map((entry) => entry === id ? replacement : entry) : current.market.filter((entry) => entry !== id);
    return write(current, `Bought ${card.name}; it enters your discard pile.`, { player: nextPlayer, market: nextMarket, marketDeck: current.marketDeck.slice(1) });
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
    const nextPlayer = { ...current.player, belt: current.player.belt + 1 };
    return write(current, `Certification approved: ${next.name} Belt. ${next.reward}.`, { player: nextPlayer });
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

  const runAiTurn = () => setMatch((current) => {
    if (!current || current.phase !== "ai-ready" || current.winner) return current;
    const challenge = DIFFICULTIES[settings.difficulty];
    const prepared = prepareAiTurn(current);
    const availableAttacks = prepared.ai.hand.filter((id) => { const card = cardFor(id); return Boolean(card && isAttack(card)); });
    const aiAttackIds = (settings.difficulty === "student" ? shuffle(availableAttacks) : availableAttacks.sort((left, right) => aiAttackScore(cardFor(right)!, prepared.ai, prepared.player, cardFor(prepared.locationId)) - aiAttackScore(cardFor(left)!, prepared.ai, prepared.player, cardFor(prepared.locationId)))).slice(0, challenge.attacks);
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
    let nextPlayer = { ...current.player };
    let defensePower = fighterStat(nextPlayer, "DEF");
    let tempoBonus = 0;
    const locationModifier = locationDefenseModifier(cardFor(current.locationId), defenseCard, nextPlayer, pending.zone);
    if (defenseCard) {
      tempoBonus = settings.tempo && nextPlayer.tempo && fighterStat(nextPlayer, "Speed") > fighterStat(current.ai, "Speed") ? 1 : 0;
      defensePower += cardPower(defenseCard) + tempoBonus + locationModifier.value;
      nextPlayer = markCompletedTask({ ...nextPlayer, hand: removeOne(nextPlayer.hand, defenseCard.id), playArea: [...nextPlayer.playArea, defenseCard.id], xp: nextPlayer.xp + 1, defendedThisRound: true, tempo: tempoBonus ? false : nextPlayer.tempo });
      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onPlay");
    }
    const hit = pending.attackPower > defensePower;
    const rawDamage = hit ? Math.max(0, pending.attackPower - defensePower + (pending.damageModifier ?? 0)) : 0;
    const reduced = reduceDamageForFighter(nextPlayer, rawDamage);
    const damage = reduced.damage;
    nextPlayer = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit, damageTaken: reduced.board.damageTaken + damage };
    const aiCard = cardFor(pending.cardId)!;
    let nextAi = markCompletedTask({ ...current.ai, damageDealt: current.ai.damageDealt + damage, hitThisTurn: current.ai.hitThisTurn || hit });
    nextAi = applyCardEffects(nextAi, aiCard, "ai", hit ? "onHit" : "afterResolve");
    if (hit) nextAi = applyCardEffects(nextAi, aiCard, "ai", "afterResolve");
    if (defenseCard) {
      if (!hit) nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "onBlock");
      nextPlayer = applyCardEffects(nextPlayer, defenseCard, "player", "afterResolve");
    }
    if (!nextPlayer.hp) nextAi = { ...nextAi, xp: nextAi.xp + 2 };
    const message = hit ? `${aiCard.name} hits you for ${damage}. Attack ${pending.attackPower} vs Defense ${defensePower}.` : `${defenseCard?.name ?? "Your base DEF"} blocks ${aiCard.name}. Attack ${pending.attackPower} vs Defense ${defensePower}.`;
    const modifiers = [...(pending.modifierNotes ?? []), ...locationModifier.notes, ...(reduced.note ? [reduced.note] : [])];
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
    const zone = card.zone?.includes("Any") ? current.selectedZone : card.zone?.split(",")[0] ?? "High";
    const location = cardFor(current.locationId);
    const locationModifier = locationAttackModifier(location, card, current.player, zone);
    const fighterModifier = fighterAttackModifier(current.player, current.ai, card);
    const comboModifier = comboAttackModifier(current.player, card, zone, true);
    const attackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + locationModifier.power + fighterModifier.power + comboModifier.power);
    const defenseId = bestDefense(current.ai, zone, attackPower, settings.difficulty, location);
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    const defenseModifier = locationDefenseModifier(location, defenseCard, current.ai, zone);
    const defensePower = Math.max(0, fighterStat(current.ai, "DEF") + (defenseCard ? cardPower(defenseCard) : 0) + defenseModifier.value);
    const hit = attackPower > defensePower;
    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage + comboModifier.damage) : 0;
    const reduced = reduceDamageForFighter(current.ai, rawDamage);
    const damage = reduced.damage;
    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attackedThisRound: true, zonesPlayed: [...current.player.zonesPlayed, zone], cardsThisTurn: [...current.player.cardsThisTurn, card.id], reversalUsedRound: true, triggeredCombos: [...current.player.triggeredCombos, ...comboModifier.triggeredIds], comboTriggered: current.player.comboTriggered || comboModifier.triggeredIds.length > 0, damageDealt: current.player.damageDealt + damage }, card, "player");
    nextPlayer.focus = Math.max(0, nextPlayer.focus - cardFocus(card));
    if (hit && comboModifier.focusOnHit) nextPlayer.focus += comboModifier.focusOnHit;
    let nextAi = { ...reduced.board, hp: Math.max(0, reduced.board.hp - damage), damageTaken: reduced.board.damageTaken + damage, wasHitSinceLastTurn: reduced.board.wasHitSinceLastTurn || hit };
    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true };
    nextPlayer = applyCardEffects(nextPlayer, card, "player", hit ? "onHit" : "afterResolve");
    if (hit) nextPlayer = applyCardEffects(nextPlayer, card, "player", "afterResolve");
    if (defenseCard) {
      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onPlay");
      if (!hit) nextAi = applyCardEffects(nextAi, defenseCard, "ai", "onBlock");
      nextAi = applyCardEffects(nextAi, defenseCard, "ai", "afterResolve");
    }
    nextPlayer = markCompletedTask(nextPlayer);
    const modifiers = [...locationModifier.notes, ...fighterModifier.notes, ...comboModifier.notes, ...defenseModifier.notes, ...(reduced.note ? [reduced.note] : [])];
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
  const playableFocus = player.hand.reduce((total, id) => {
    const card = cardFor(id);
    const playable = card && !isDefense(card) && (match.phase === "player-initiate" || !isPermanent(card));
    return total + (playable ? cardFocus(card) : 0);
  }, player.focus);
  const affordableNow = match.market.filter((id) => cardCost(cardFor(id)) <= player.focus).length;
  const affordableForecast = match.market.filter((id) => cardCost(cardFor(id)) <= playableFocus).length;
  const activePhaseIndex = match.phase === "player-initiate" ? 1 : match.phase === "player-yell" || match.phase === "defense-window" || match.phase === "reversal-window" || match.phase === "ai-ready" ? 2 : 3;
  const turnCoach = match.winner
    ? (match.winner === "player" ? "The opponent is folded. Enjoy the extremely temporary paperwork-based glory." : "This test is over, but the Department has approved an immediate and emotionally reckless rematch.")
    : match.phase === "player-initiate"
      ? (player.hand.some((id) => isPermanent(cardFor(id)!)) ? "Equip any permanent Equipment you want before Yell. Each legal Equip generates its printed Focus." : "No permanent Equipment is waiting in hand. Finish Initiate and proceed directly to the yelling.")
    : match.phase === "player-yell"
      ? (pendingAttack ? `You selected ${pendingAttack.name}. Confirm its zone, then declare the Attack.` : player.hand.some((id) => isAttack(cardFor(id)!)) && player.attacksThisTurn < gameDefinition.turn.normalAttackLimit ? `Play support cards for Focus or select an Attack. You may make up to ${gameDefinition.turn.normalAttackLimit} normal Attacks.` : "Your useful cards are spent. Move to Ascend and turn that Focus into a better deck.")
      : match.phase === "player-ascend"
        ? (canPromote ? `Your ${nextBelt?.name} Belt exam is complete. Promote before you Hide.` : player.focus > 0 ? "Spend Focus in the Market. Affordable cards are awake; the rest are judging you." : "No Focus remains. Hide to clean up, redraw, and hand the clipboard to the computer.")
      : match.phase === "defense-window"
          ? (defenseOptions.length ? `A ${match.pendingStrike?.zone} Attack is incoming. Play a glowing matching Defense or pass.` : "No matching Defense is in hand. Base DEF still applies; pass the Reaction Window to resolve the hit.")
          : match.phase === "reversal-window"
            ? "You Blocked with a Defense card. Choose one Attack from your hand for a free counterattack, or decline the Reversal. It earns XP but no printed Focus."
          : "The computer has initiative. Run its turn when you are ready to discover what it thinks strategy means.";

  return <main className={`playtest-shell playtest-shell--live ${settings.guided ? "playtest-shell--guided" : ""} ${match.winner ? "playtest-shell--finished" : ""} shell`}><MobilePlaytestNotice />
    <header className="playtest-topbar battle-versus-hud">
      <section className="versus-fighter versus-player"><div><b>{playerFighter.name}</b><span>{belts[player.belt].name} Belt · {player.hp}/{player.maxHp} HP</span></div><div className="versus-health"><span style={{ width: `${Math.max(0, Math.min(100, player.hp / player.maxHp * 100))}%` }} /></div></section>
      <div className="versus-center"><span>ROUND</span><b>{match.round}</b><small>{["HONOR", "INITIATE", "YELL", "ASCEND", "HIDE"][activePhaseIndex]}</small></div>
      <section className="versus-fighter versus-enemy"><div><b>{aiFighter.name}</b><span>{belts[ai.belt].name} Belt · {ai.hp}/{ai.maxHp} HP</span></div><div className="versus-health"><span style={{ width: `${Math.max(0, Math.min(100, ai.hp / ai.maxHp * 100))}%` }} /></div></section>
      <div className="playtest-actions"><span className={`rules-sync rules-sync--${rulesSync.status}`}>{rulesSync.status === "update-available" ? `Rules ${rulesSync.latestVersion} ready` : rulesSync.status === "offline" ? "Rules offline" : "Rules synced"}</span>{rulesSync.status === "update-available" && <button onClick={() => window.location.reload()}>Reload</button>}<button onClick={() => setMatch(null)}>New Duel</button><button onClick={() => goTo("rules")}>Rules</button><button onClick={() => goTo("cards")}>Cards</button></div>
    </header>
    <section className="game-phase-rail" aria-label="Current H.I.Y.A.H. phase"><div className="phase-rail-line" aria-hidden="true"><span style={{ width: `${activePhaseIndex / 4 * 100}%` }} /></div>{["Honor", "Initiate", "Yell", "Ascend", "Hide"].map((phase, index) => <div className={index === activePhaseIndex ? "is-active" : index < activePhaseIndex ? "is-complete" : ""} key={phase}><b>{"HIYAH"[index]}</b><span>{phase}</span></div>)}</section>
    {match.winner && <section className="match-result paper-stack"><span>{match.winner === "player" ? "Victory certified" : "The paperwork won"}</span><h2>{match.winner === "player" ? `${playerFighter.name} remains standing.` : `${aiFighter.name} wins this field test.`}</h2><p>The result has been stamped, loudly disputed, and filed beneath a suspicious vending-machine receipt.</p><div className="match-report"><b>{match.round}<small>ROUNDS</small></b><b>{player.damageDealt}<small>DAMAGE DEALT</small></b><b>{player.cardsBought}<small>CARDS BOUGHT</small></b><b>{player.learnedCombos.length}<small>COMBOS LEARNED</small></b></div><div className="match-result-actions"><button className="button primary" onClick={() => begin(player.fighterId)}>Instant rematch →</button><button className="button ghost" onClick={() => setMatch(null)}>Choose another fighter</button></div></section>}
    <section className="playtest-arena">
    <section className="playtest-location paper-stack"><span>Current stage · Honor {match.round}</span><div><h2>{currentLocation?.name ?? "Tournament Mat"}</h2><p>{currentLocation?.rulesText ?? "The Department finds no reason to intervene."}</p></div><button onClick={() => currentLocation && setInspectedId(currentLocation.id)}>Inspect</button></section>
    <section className="playtest-table">
      <BattleCallout line={match.log[0]} />
      <FighterPanel board={player} label="You" onInspect={(card) => setInspectedId(card.id)} />
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
        <p>{match.phase === "player-initiate" ? "Initiate: equip permanent Equipment, then move to Yell." : match.phase === "player-yell" ? "Yell: play cards, make up to two normal Attacks." : match.phase === "player-ascend" ? "Ascend: the acquisition desk is open for Market, Combo, and Belt actions." : match.phase === "defense-window" ? "Reaction Window: play one matching Defense or pass." : match.phase === "reversal-window" ? "Reversal Window: counterattack with one Attack from hand or decline." : settings.autoAi ? "Computer is reviewing several bad ideas…" : "Computer turn: let it make its choices."}</p>
        <ImpactReadout line={match.log[0]} />
        {match.phase === "ai-ready" && !match.winner && !settings.autoAi && <button className="button primary" onClick={runAiTurn}>Run computer turn →</button>}
        {match.phase === "ai-ready" && !match.winner && settings.autoAi && <span className="ai-thinking"><i /><i /><i /> Clipboard thinking</span>}
      </section>
      <FighterPanel board={ai} label="Computer" enemy onInspect={(card) => setInspectedId(card.id)} />
    </section>
    </section>
    <section className="playtest-workspace playtest-workspace--hand">
      <section className="hand-panel paper-stack">
        <header><div><span className="eyebrow">Your hand · {player.hand.length} cards</span><h2>{match.phase === "player-initiate" ? "Equip before the yelling starts" : match.phase === "defense-window" ? `Defend ${match.pendingStrike?.zone} or let it land` : match.phase === "reversal-window" ? "Return the favor immediately" : "Choose your next card"}</h2></div><div className="hand-counters"><span>Deck {player.deck.length}</span><span>Discard {player.discard.length}</span><span>Attacks {player.attacksThisTurn}/{gameDefinition.turn.normalAttackLimit}</span></div></header>
        <div className="play-card-row">{player.hand.map((id, index) => {
          const card = cardFor(id); if (!card) return null;
          const attack = isAttack(card); const defense = isDefense(card); const permanent = isPermanent(card);
          const canInitiate = match.phase === "player-initiate" && permanent && !(playerFighter.name === "Knuckleton the Brawler" && isWeapon(card));
          const canUse = match.phase === "player-yell" && (attack ? player.attacksThisTurn < gameDefinition.turn.normalAttackLimit : !defense && !permanent);
          const canDefend = match.phase === "defense-window" && defenseOptions.includes(id);
          const canReverse = match.phase === "reversal-window" && attack;
          return <PlayCard key={`${id}-${index}`} card={card} selected={match.selectedAttackId === id} disabled={match.phase === "defense-window" ? !canDefend : match.phase === "reversal-window" ? !canReverse : match.phase === "player-initiate" ? !canInitiate : !canUse} onClick={match.phase === "defense-window" ? () => resolveDefense(id) : match.phase === "reversal-window" ? () => chooseAttack(card) : match.phase === "player-initiate" ? () => equipPermanent(id) : attack ? () => chooseAttack(card) : () => playSupport(id)} onInspect={() => setInspectedId(id)} />;
        })}</div>
        {match.phase === "player-initiate" && playerFighter.name === "Sensei Ducktape" && !player.abilityUsedRound && player.discard.some((id) => { const card = cardFor(id); return card ? isPermanent(card) : false; }) && <div className="ducktape-tray"><span>Sensei Ducktape · emergency repair</span>{player.discard.filter((id) => { const card = cardFor(id); return card ? isPermanent(card) : false; }).slice(0, 3).map((id) => <button onClick={() => borrowEquipment(id)} key={id}>Jury-rig {cardFor(id)?.name}</button>)}</div>}
        {match.phase === "player-initiate" && <button className="button primary" onClick={beginYell}>Finish Initiate → Yell</button>}
        {match.phase === "defense-window" && <button className="button ghost" onClick={() => resolveDefense(null)}>Pass the reaction window</button>}
        {match.phase === "reversal-window" && <div className="reversal-actions"><div><span>One counterattack · no printed Focus</span>{pendingAttack?.zone?.includes("Any") && <fieldset className="zone-picker"><legend>Reversal zone</legend>{["High", "Mid", "Low"].map((zone) => <button type="button" className={match.selectedZone === zone ? "is-selected" : ""} onClick={() => setMatch((current) => current ? { ...current, selectedZone: zone } : current)} key={zone}>{zone}</button>)}</fieldset>}</div><button className="button primary" disabled={!pendingAttack} onClick={resolveReversal}>{pendingAttack ? `Reverse with ${pendingAttack.name} →` : "Choose an Attack"}</button><button className="button ghost" onClick={declineReversal}>Decline Reversal</button></div>}
        {match.phase === "player-yell" && <div className="playtest-yell-actions">{pendingAttack && <><fieldset className="zone-picker"><legend>Declare zone</legend>{["High", "Mid", "Low"].map((zone) => <button type="button" className={match.selectedZone === zone ? "is-selected" : ""} disabled={!pendingAttack.zone?.includes("Any") && !(playerFighter.name === "Whirlwind Wynn" && player.attacksThisTurn === 0 && hasTag(pendingAttack, "Spin"))} onClick={() => setMatch((current) => current ? { ...current, selectedZone: zone } : current)} key={zone}>{zone}</button>)}</fieldset><button className="button primary" onClick={declareAttack}>Declare {pendingAttack.name} →</button></>}<button className="button ghost" onClick={enterAscend}>Finish Yell → Ascend</button></div>}
      </section>
      <aside className="combat-utility-panel paper-stack">{settings.guided ? <div className={`turn-coach turn-coach--${match.phase}`} aria-live="polite"><span>Decision coach</span><p>{turnCoach}</p><button onClick={() => setSettings({ ...settings, guided: false })}>Dismiss coach</button></div> : <div className="coach-dismissed"><span>Coach dismissed</span><p>The clipboard trusts you. This may be a clerical error.</p></div>}<button className="fight-log-launch" type="button" onClick={() => setLogOpen(true)}><span>Fight Log</span><b>{match.log.length}</b><small>Open all filings →</small></button></aside>
    </section>
    {!match.winner && <nav className={`playtest-action-dock dock-${match.phase}`} aria-label="Next legal action"><div><span>{match.phase === "player-initiate" ? "INITIATE" : match.phase === "player-yell" ? "YELL" : match.phase === "player-ascend" ? "ASCEND" : match.phase === "defense-window" ? "REACTION" : match.phase === "reversal-window" ? "REVERSAL" : "OPPONENT"}</span><b>{match.phase === "player-initiate" ? "Equipment first" : match.phase === "player-yell" ? pendingAttack ? `${pendingAttack.name} selected` : `${player.attacksThisTurn}/${gameDefinition.turn.normalAttackLimit} attacks used` : match.phase === "player-ascend" ? `${player.focus} Focus available` : match.phase === "defense-window" ? `${match.pendingStrike?.zone} strike incoming` : match.phase === "reversal-window" ? pendingAttack ? `${pendingAttack.name} ready` : "Choose an Attack" : settings.autoAi ? "Clipboard thinking…" : "Computer is waiting"}</b></div>{match.phase === "player-initiate" && <button onClick={beginYell}>Proceed to Yell →</button>}{match.phase === "player-yell" && (pendingAttack ? <button onClick={declareAttack}>Declare Attack →</button> : <button onClick={enterAscend}>Proceed to Ascend →</button>)}{match.phase === "player-ascend" && <button onClick={completeTurn}>Hide · End turn →</button>}{match.phase === "defense-window" && <button onClick={() => resolveDefense(null)}>Pass Reaction</button>}{match.phase === "reversal-window" && (pendingAttack ? <button onClick={resolveReversal}>Launch Reversal →</button> : <button onClick={declineReversal}>Decline Reversal</button>)}{match.phase === "ai-ready" && !settings.autoAi && <button onClick={runAiTurn}>Run computer turn →</button>}</nav>}
    {deskView && <div className="ascend-desk-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDeskView(null)}>
      <section className="ascend-desk paper-stack" role="dialog" aria-modal="true" aria-labelledby="ascend-desk-title">
        <header className="ascend-desk-header">
          <div><span className="eyebrow">{match.phase === "player-ascend" ? "Ascend desk · purchasing authorized" : "Reference desk · inspection only"}</span><h2 id="ascend-desk-title">{deskView === "market" ? "Shared Market" : deskView === "combo" ? "Combo Docket" : "Certification Ledger"}</h2></div>
          <div className="ascend-desk-balance"><span>Available Focus</span><b>{player.focus}</b><small>{affordableNow} of {match.market.length} Market cards in reach</small></div>
          <button className="modal-close" onClick={() => setDeskView(null)} aria-label="Close Ascend Desk">×</button>
        </header>
        <nav className="ascend-desk-tabs" aria-label="Ascend desk sections">
          <button type="button" className={deskView === "market" ? "is-active" : ""} aria-current={deskView === "market" ? "page" : undefined} onClick={() => setDeskView("market")}><i aria-hidden="true">▤</i><span>Shared Market</span><b>{affordableNow}/{match.market.length}</b><small>affordable · open section</small></button>
          <button type="button" className={deskView === "combo" ? "is-active" : ""} aria-current={deskView === "combo" ? "page" : undefined} onClick={() => setDeskView("combo")}><i aria-hidden="true">∞</i><span>Combo Docket</span><b>{player.learnedCombos.length}/2</b><small>learned · open section</small></button>
          <button type="button" className={deskView === "belt" ? "is-active" : ""} aria-current={deskView === "belt" ? "page" : undefined} onClick={() => setDeskView("belt")}><i aria-hidden="true">★</i><span>Belt Ledger</span><b>{belts[player.belt].name}</b><small>{player.xp} XP · open section</small></button>
        </nav>
        <div className="ascend-desk-body">
          {deskView === "market" && <section className="ascend-market" aria-label="Seven-card Shared Market">
            <header><div><span className="eyebrow">Seven live records · full cards</span><h3>Choose with the text visible</h3></div><p>{match.phase === "player-ascend" ? "Affordable cards are highlighted. Select one to buy it; the row refills immediately." : "The full row is available for reference. Buying unlocks during Ascend."}</p></header>
            <div className="ascend-market-grid">{match.market.map((id) => { const card = cardFor(id); if (!card) return null; const affordable = player.focus >= cardCost(card); return <PlayCard key={id} card={card} selected={match.phase === "player-ascend" && affordable} disabled={match.phase !== "player-ascend" || !affordable} onClick={() => buyMarket(id)} onInspect={() => setInspectedId(id)} />; })}</div>
          </section>}
          {deskView === "combo" && <section className="ascend-combo combo-panel">
            <header><div><span className="eyebrow">One face-up offer · one attempt per turn</span><h3>{player.learnedCombos.length ? `${player.learnedCombos.length}/2 learned` : "Reveal. Learn. Regret."}</h3></div><span className="combo-limit">{player.comboAttemptedTurn ? "Attempt filed" : "Ready"}</span></header>
            {comboOffer ? <div className="combo-offer"><NativeCardArt card={comboOffer} /><div><span>{comboOffer.catalogId}</span><h3>{comboOffer.name}</h3><p>{comboOffer.rulesText}</p><div><b>{cardCost(comboOffer)} Focus</b><button onClick={() => setInspectedId(comboOffer.id)}>Inspect full card</button></div></div></div> : <p>The Combo docket has escaped the filing cabinet.</p>}
            {match.phase === "player-ascend" && comboOffer && !player.comboAttemptedTurn && <div className="combo-actions"><button className="button primary" disabled={player.focus < cardCost(comboOffer) || player.learnedCombos.length >= 2} onClick={() => cycleCombo(true)}>Learn {comboOffer.name}</button><button className="button ghost" onClick={() => cycleCombo(false)}>Pass · bottom deck</button></div>}
            {match.phase !== "player-ascend" && <p className="combo-spent">Combo actions unlock during Ascend.</p>}
            {player.comboAttemptedTurn && <p className="combo-spent">Combo attempt filed for this turn.</p>}
            {player.learnedCombos.length > 0 && <div className="learned-combos">{player.learnedCombos.map((id) => <button key={id} onClick={() => setInspectedId(id)}><span>∞</span><b>{cardFor(id)?.name}</b><small>{player.triggeredCombos.includes(id) ? "Triggered this round" : "Ready"}</small></button>)}</div>}
          </section>}
          {deskView === "belt" && <section className="ascend-belt belt-panel">
            <span className="eyebrow">Certification ledger</span><h3>{belts[player.belt].name} Belt · {player.xp} XP</h3>
            <p>{nextBelt ? <><b>Next: {nextBelt.name} · {nextBelt.xp} XP.</b> {nextBelt.task}</> : "Every available Belt has been certified."}</p>
            <div className="belt-track">{belts.map((belt, index) => <span className={index <= player.belt ? "earned" : ""} key={belt.name} title={`${belt.name} Belt · ${belt.xp} XP`}>{belt.name.slice(0, 1)}</span>)}</div>
            <div className="belt-ledger-list">{belts.map((belt, index) => <article className={index === player.belt ? "is-current" : index < player.belt ? "is-earned" : ""} key={belt.name}><span>{index < player.belt ? "✓" : index === player.belt ? "●" : index + 1}</span><div><b>{belt.name} Belt</b><small>{belt.xp} XP · {belt.task || "Starting certification"}</small></div></article>)}</div>
            {nextBelt && <button className="button primary" disabled={match.phase !== "player-ascend" || !canPromote} onClick={promote}>{canPromote && match.phase === "player-ascend" ? `Promote to ${nextBelt.name} →` : match.phase !== "player-ascend" ? "Promotion opens during Ascend" : `${nextBelt.name}: ${nextBelt.xp} XP + completed task`}</button>}
          </section>}
        </div>
        <footer className="ascend-desk-footer"><details><summary>Recent fight filings</summary><ol>{match.log.slice(0, 6).map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}</ol></details>{match.phase === "player-ascend" && <button className="button primary" onClick={completeTurn}>Hide · End turn →</button>}</footer>
      </section>
    </div>}
    {logOpen && <div className="playtest-inspector-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setLogOpen(false)}><section className="fight-log-dialog paper-stack" role="dialog" aria-modal="true" aria-labelledby="fight-log-title"><button className="modal-close" onClick={() => setLogOpen(false)} aria-label="Close Fight Log">×</button><span className="eyebrow">Department combat archive</span><h2 id="fight-log-title">Fight Log</h2><p>Newest filing first. Nobody has checked the handwriting.</p><ol>{match.log.map((line, index) => <li key={`${line}-${index}`}><b>{match.log.length - index}</b><span>{line}</span></li>)}</ol></section></div>}
    {inspected && <div className="playtest-inspector-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setInspectedId(null)}><article className={`playtest-inspector paper-stack ${inspectorZoomed ? "is-zoomed" : ""}`} role="dialog" aria-modal="true" aria-labelledby="playtest-inspector-title"><button className="modal-close" onClick={() => setInspectedId(null)} aria-label="Close Card Inspector">×</button><div className="inspector-heading"><button type="button" className="inspector-card-visual" onClick={() => setInspectorZoomed((current) => !current)} aria-label={`${inspectorZoomed ? "Reduce" : "Magnify"} ${inspected.name}`}>{artistUrl(inspected) ? <img src={artistUrl(inspected)} alt={inspected.name} /> : <NativeCardArt card={inspected} />}<span>{inspectorZoomed ? "Reduce card" : "Click to magnify"}</span></button><div><span className="eyebrow">{inspected.catalogId} · {inspected.cardType} · {inspected.subtype}</span><h2 id="playtest-inspector-title">{inspected.name}</h2><p>{inspected.flavorText}</p></div></div><dl><div><dt>Focus Cost</dt><dd>{inspected.fpCost ?? "—"}</dd></div><div><dt>Focus Value</dt><dd>{inspected.focusValue ?? "—"}</dd></div><div><dt>Zone</dt><dd>{inspected.zone ?? "—"}</dd></div><div><dt>Timing</dt><dd>{inspected.timing ?? "—"}</dd></div></dl><section><span>Printed rules text</span><p>{inspected.rulesText ?? "No printed rules text."}</p></section><footer>{cardEffectNote(inspected)} The Card Library remains the source of truth for the complete catalog record. Press Escape to close.</footer></article></div>}
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

function openAiStrike(current: Match, cardId: string, remainingAiAttacks: string[], useTempo: boolean) {
  const card = cardFor(cardId)!;
  const fighter = cardFor(current.ai.fighterId);
  const anyZone = card.zone?.includes("Any") || (fighter?.name === "Whirlwind Wynn" && current.ai.attacksThisTurn === 0 && hasTag(card, "Spin"));
  const zone = anyZone ? ["High", "Mid", "Low"][Math.floor(Math.random() * 3)] : card.zone?.split(",")[0] ?? "High";
  const tempoBonus = useTempo && current.ai.tempo && fighterStat(current.ai, "Speed") > fighterStat(current.player, "Speed") ? 1 : 0;
  const locationModifier = locationAttackModifier(cardFor(current.locationId), card, current.ai, zone);
  const fighterModifier = fighterAttackModifier(current.ai, current.player, card);
  const attackPower = Math.max(0, cardPower(card) + fighterStat(current.ai, "ATK") + current.ai.nextAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power);
  const nextAi = applyCardEffects({ ...current.ai, hand: removeOne(current.ai.hand, card.id), playArea: [...current.ai.playArea, card.id], xp: current.ai.xp + 1, attacksThisTurn: current.ai.attacksThisTurn + 1, attackedThisRound: true, zonesPlayed: [...current.ai.zonesPlayed, zone], cardsThisTurn: [...current.ai.cardsThisTurn, card.id], nextAttackBonus: 0, tempo: tempoBonus ? false : current.ai.tempo, wasHitSinceLastTurn: current.ai.attacksThisTurn === 0 ? false : current.ai.wasHitSinceLastTurn }, card, "ai");
  const modifiers = [...locationModifier.notes, ...fighterModifier.notes];
  return { ...current, ai: nextAi, phase: "defense-window" as const, pendingStrike: { cardId, zone, attackPower, damageModifier: locationModifier.damage + fighterModifier.damage, modifierNotes: modifiers, remainingAiAttacks }, log: [`Computer declares ${card.name} to ${zone}. ${tempoBonus ? "Tempo adds +1. " : ""}${modifiers.length ? `${modifiers.join("; ")}. ` : ""}Choose one matching Defense or pass.`, ...current.log].slice(0, 32) };
}

function finishAiTurn(current: Match, line: string, sceneChanges: boolean) {
  const aiPurchase = current.market.filter((id) => numberValue(cardFor(id)?.fpCost) <= current.ai.focus).sort((left, right) => aiMarketScore(cardFor(right)!, current.ai) - aiMarketScore(cardFor(left)!, current.ai))[0];
  const purchasedCard = aiPurchase ? cardFor(aiPurchase) : null;
  const replacement = current.marketDeck[0];
  let aiAfterPurchase = purchasedCard ? markCompletedTask({ ...current.ai, focus: current.ai.focus - numberValue(purchasedCard.fpCost), discard: [...current.ai.discard, purchasedCard.id], purchasedTypes: [...current.ai.purchasedTypes, purchasedCard.cardType], cardsBought: current.ai.cardsBought + 1 }) : current.ai;
  const market = purchasedCard ? (replacement ? current.market.map((id) => id === purchasedCard.id ? replacement : id) : current.market.filter((id) => id !== purchasedCard.id)) : current.market;
  const marketDeck = purchasedCard ? current.marketDeck.slice(1) : current.marketDeck;
  let promotionLog: string | null = null;
  const nextBelt = belts[aiAfterPurchase.belt + 1];
  if (nextBelt && aiAfterPurchase.xp >= nextBelt.xp && aiAfterPurchase.completedTasks.includes(aiAfterPurchase.belt + 1)) {
    aiAfterPurchase = { ...aiAfterPurchase, belt: aiAfterPurchase.belt + 1 };
    promotionLog = `Computer certifies ${nextBelt.name} Belt. The stamp lands with tactical intent.`;
  }
  const nextAi = playAreaCleanup(aiAfterPurchase);
  const purchaseLog = purchasedCard ? `Computer buys ${purchasedCard.name}.` : "Computer buys nothing.";
  const finished = { ...current, ai: nextAi, market, marketDeck, log: [purchaseLog, ...(promotionLog ? [promotionLog] : []), line, ...current.log].slice(0, 32) };
  if (current.turnIndex === 0) return { ...finished, phase: "player-initiate" as const, turnIndex: 1 as const, log: ["You are second in this round's initiative order. Initiate begins now.", ...finished.log].slice(0, 32) };
  return advanceRound(finished, sceneChanges, "Both fighters have completed the round.");
}

function advanceRound(current: Match, sceneChanges: boolean, line: string) {
  const nextRound = current.round + 1;
  const freshLocations = current.locations.length ? current.locations : shuffle(quickDuelLocationPool.map((card) => card.id));
  const locationId = sceneChanges ? freshLocations[0] ?? current.locationId : current.locationId;
  const player = { ...current.player, xp: current.player.xp + 1, tempo: true, tempSpeed: 0, attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, hitThisTurn: false, cardsThisTurn: [], damageReductionUsed: false, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] };
  const ai = { ...current.ai, xp: current.ai.xp + 1, tempo: true, tempSpeed: 0, attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, hitThisTurn: false, cardsThisTurn: [], damageReductionUsed: false, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] };
  const playerFirst = fighterStat(player, "Speed") >= fighterStat(ai, "Speed");
  const turnOrder: Match["turnOrder"] = playerFirst ? ["player", "ai"] : ["ai", "player"];
  return { ...current, player, ai, locationId, locations: sceneChanges ? freshLocations.slice(1) : current.locations, round: nextRound, phase: playerFirst ? "player-initiate" as const : "ai-ready" as const, turnOrder, turnIndex: 0 as const, selectedAttackId: null, log: [`Honor ${nextRound}: ${cardFor(locationId)?.name ?? "Tournament Mat"} is active. Both fighters gain 1 XP and refresh Tempo. ${playerFirst ? "You" : "Computer"} take initiative.`, line, ...current.log].slice(0, 32) };
}

function prepareAiTurn(current: Match) {
  const fighter = cardFor(current.ai.fighterId);
  const supportIds = current.ai.hand.filter((id) => {
    const card = cardFor(id);
    return Boolean(card && !isAttack(card) && !isDefense(card) && card.subtype !== "Junk" && !(fighter?.name === "Knuckleton the Brawler" && isWeapon(card)));
  });
  if (!supportIds.length) return current;
  let nextAi = { ...current.ai };
  const played: string[] = [];
  for (const id of supportIds) {
    const card = cardFor(id);
    if (!card) continue;
    const locationModifier = locationFocusModifier(cardFor(current.locationId), card, nextAi);
    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], focus: nextAi.focus + locationModifier.value }, card, "ai");
    played.push(card.name);
  }
  return { ...current, ai: nextAi, log: [`Computer prepares with ${played.join(", ")}. The strategy is now technically documented.`, ...current.log].slice(0, 32) };
}
