import { useMemo, useState } from "react";
import cardPlaceholderUrl from "./assets/art/card-placeholder-v2.webp";
import starterJabArtUrl from "./assets/starter/starter-jab-art-v2.webp";
import highGuardArtUrl from "./assets/starter/high-guard-art-v2.webp";
import cardsJson from "./data/cards.json";

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
};

type PendingStrike = {
  cardId: string;
  zone: string;
  attackPower: number;
  remainingAiAttacks: string[];
};

type Match = {
  player: Board;
  ai: Board;
  market: string[];
  marketDeck: string[];
  locations: string[];
  locationId: string;
  round: number;
  phase: "player-yell" | "player-ascend" | "ai-ready" | "defense-window";
  selectedAttackId: string | null;
  selectedZone: string;
  pendingStrike: PendingStrike | null;
  log: string[];
  winner: "player" | "ai" | null;
};

type HouseSettings = { tempo: boolean; locations: boolean; openMarket: boolean };

const cards = (cardsJson as unknown as { cards: CardEntry[] }).cards;
const byId = new Map(cards.map((card) => [card.id, card]));
const characters = cards.filter((card) => card.cardType === "Character");
const starterIds = [
  "starter-pool-2-basic-jab", "starter-pool-3-basic-body-kick", "starter-pool-4-basic-shin-kick", "starter-pool-5-wild-swing",
  "starter-pool-6-high-guard", "starter-pool-7-center-guard", "starter-pool-8-low-guard", "starter-pool-9-cover-up",
  "starter-pool-10-breathing-drill", "starter-pool-11-footwork-drill",
  "starter-pool-12-bad-habit", "starter-pool-12-bad-habit", "starter-pool-12-bad-habit", "starter-pool-12-bad-habit", "starter-pool-12-bad-habit",
];
const marketPool = cards.filter((card) => card.cardType === "Technique" || card.cardType === "Item");
const locationPool = cards.filter((card) => card.cardType === "Location");
const belts = [
  { name: "White", xp: 0, task: "Exist. Try not to sprain anything while shuffling.", reward: "Starting belt" },
  { name: "Yellow", xp: 5, task: "Play a legal High, Mid, and Low Attack while White.", reward: "+10 Max HP; heal 5" },
  { name: "Orange", xp: 10, task: "Play 2 legal Attacks in one turn and Hit with 1.", reward: "+1 ATK; +10 Max HP; heal 5" },
  { name: "Green", xp: 15, task: "Play an Attack on your turn and a Defense outside your turn in one round.", reward: "Unlock Green Ability; +10 Max HP; heal 5" },
  { name: "Purple", xp: 21, task: "Buy two different card types while Green.", reward: "Second card gives +1 Focus; +10 Max HP; heal 5" },
  { name: "Blue", xp: 28, task: "Have 2 permanent Equipment cards equipped.", reward: "+1 hand size; +10 Max HP; heal 5" },
  { name: "Red", xp: 36, task: "Trigger a learned Combo.", reward: "3+ damage Hit gives +1 Focus; +10 Max HP; heal 5" },
  { name: "Brown", xp: 45, task: "Play 4 cards in one turn including Attack, Kata, and Equipment/Consumable.", reward: "+1 DEF; +10 Max HP; heal 5" },
  { name: "Black", xp: 55, task: "KO an opponent while Brown Belt.", reward: "+10 Max HP (does not end Quick Duel)" },
];

const cardArtModules = import.meta.glob<string>("./assets/cards/{attacks,defenses,katas,characters}/*.webp", { eager: true, query: "?url", import: "default" });
const CARD_ART = Object.fromEntries(Object.entries(cardArtModules).map(([path, url]) => [`/cards/${path.split("/cards/")[1]}`, url]));

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
function cardPower(card: CardEntry) { return numberValue(card.stats.Damage ?? card.stats["Power / Guard"] ?? card.stats.Power ?? card.stats.Guard); }
function isAttack(card: CardEntry) { return cardType(card) === "attack" || card.subtype === "Attack" || card.catalogId.includes("-ATK-"); }
function isDefense(card: CardEntry) { return cardType(card) === "defense" || card.subtype === "Defense" || card.catalogId.includes("-DEF-"); }
function isKata(card: CardEntry) { return cardType(card) === "kata" || card.subtype === "Kata" || card.catalogId.includes("-KAT-"); }
function isPermanent(card: CardEntry) { return ["Weapon", "Gear", "Defense Equipment"].includes(card.subtype); }
function matchesZone(card: CardEntry, zone: string) { return (card.zone ?? "").toLocaleLowerCase().includes("any") || (card.zone ?? "").toLocaleLowerCase().includes(zone.toLocaleLowerCase()); }
function removeOne(items: string[], id: string) { const index = items.indexOf(id); return index < 0 ? items : [...items.slice(0, index), ...items.slice(index + 1)]; }

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
  return base + beltBonus + equipment + (stat === "Speed" ? board.tempSpeed : 0);
}

function emptyBoard(fighterId: string): Board {
  return drawCards({
    fighterId, hp: 25, maxHp: 25, xp: 0, focus: 0, belt: 0,
    deck: shuffle(starterIds), hand: [], discard: [], playArea: [], equipment: [],
    tempSpeed: 0, nextAttackBonus: 0, attacksThisTurn: 0, hitThisTurn: false, cardsThisTurn: [], tempo: true, attackedThisRound: false,
    defendedThisRound: false, zonesPlayed: [], purchasedTypes: [], comboTriggered: false, completedTasks: [],
  }, 5);
}

function artistUrl(card: CardEntry) {
  if (card.image && CARD_ART[card.image]) return CARD_ART[card.image];
  if (card.name === "Basic Jab") return starterJabArtUrl;
  if (card.name === "High Guard") return highGuardArtUrl;
  return undefined;
}

function cardEffectNote(card: CardEntry) {
  const text = card.rulesText ?? "";
  if (!text || /no (additional )?effect/i.test(text)) return "No extra printed effect.";
  if (isPermanent(card)) return "Equipped permanently; its printed stats apply now."
  const supported: string[] = [];
  if (/draw \d+ card/i.test(text)) supported.push("draw");
  if (/next Attack.*\+\d+ (Damage|Attack Power)/i.test(text)) supported.push("next-attack bonus");
  if (/gain \+?\d+ Speed/i.test(text)) supported.push("Speed bonus");
  if (/heal \d+/i.test(text)) supported.push("healing");
  return supported.length ? `The engine applied: ${supported.join(", ")}.` : "Printed effect needs a table ruling; its exact text is shown in the Card Inspector.";
}

function applyCardEffects(board: Board, card: CardEntry, owner: "player" | "ai") {
  const text = card.rulesText ?? "";
  let next = { ...board };
  if (owner === "player" || owner === "ai") next.focus += numberValue(card.focusValue);
  if (isPermanent(card)) next.equipment = [...next.equipment, card.id];
  const draw = text.match(/draw (\d+) card/i);
  if (draw) next = drawCards(next, Number(draw[1]));
  const attackBonus = text.match(/next Attack[^.]*\+(\d+) (?:Damage|Attack Power)/i);
  if (attackBonus) next.nextAttackBonus += Number(attackBonus[1]);
  const speed = text.match(/gain \+?(\d+) Speed/i);
  if (speed) next.tempSpeed += Number(speed[1]);
  const heal = text.match(/heal (\d+)/i);
  if (heal) next.hp = Math.min(next.maxHp, next.hp + Number(heal[1]));
  return next;
}

function legalDefenseIds(board: Board, zone: string) {
  return board.hand.filter((id) => {
    const card = cardFor(id);
    return Boolean(card && isDefense(card) && matchesZone(card, zone));
  });
}

function bestDefense(board: Board, zone: string) {
  return legalDefenseIds(board, zone).sort((left, right) => cardPower(cardFor(right)!) - cardPower(cardFor(left)!))[0] ?? null;
}

function playAreaCleanup(board: Board) {
  const discard = [...board.discard, ...board.hand, ...board.playArea.filter((id) => !board.equipment.includes(id))];
  return drawCards({ ...board, hand: [], playArea: [], discard, focus: 0, attacksThisTurn: 0, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0 }, board.belt >= 5 ? 6 : 5);
}

function cardLabel(card: CardEntry) { return `${card.name} · ${card.catalogId}`; }

function PlayCard({ card, selected, disabled, onClick, onInspect }: { card: CardEntry; selected?: boolean; disabled?: boolean; onClick?: () => void; onInspect: () => void }) {
  const art = artistUrl(card);
  const kind = isAttack(card) ? "attack" : isDefense(card) ? "defense" : isKata(card) ? "kata" : card.cardType.toLocaleLowerCase();
  return <article className={`play-card play-card--${kind} ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}>
    <button className="play-card-main" disabled={disabled || !onClick} onClick={onClick} aria-label={`Use ${card.name}`}>
      {art ? <img src={art} alt="" loading="lazy" decoding="async" /> : <img className="play-card-placeholder" src={cardPlaceholderUrl} alt="" loading="lazy" decoding="async" />}
      <span className="play-card-fallback"><b>{card.name}</b><small>{card.catalogId}</small><em>{card.subtype}</em></span>
      <span className="play-card-meta"><b>{card.fpCost ?? "—"} Focus</b><small>{card.zone ?? "—"} · {card.timing ?? "—"}</small></span>
    </button>
    <button className="play-card-inspect" onClick={onInspect} aria-label={`Inspect ${card.name}`}>⌕</button>
  </article>;
}

function FighterPanel({ board, label, enemy, onInspect }: { board: Board; label: string; enemy?: boolean; onInspect: (card: CardEntry) => void }) {
  const fighter = cardFor(board.fighterId)!;
  const art = artistUrl(fighter);
  return <section className={`fighter-panel paper-stack ${enemy ? "is-enemy" : ""}`}>
    <div className="fighter-panel-art">{art ? <img src={art} alt={fighter.name} /> : <img src={cardPlaceholderUrl} alt="" />}</div>
    <div className="fighter-panel-copy"><span>{label} · {belts[board.belt].name} Belt</span><button onClick={() => onInspect(fighter)}>{fighter.name}</button><p>{fighter.rulesText}</p></div>
    <div className="fighter-stats"><b><small>HP</small>{board.hp}/{board.maxHp}</b><b><small>ATK</small>{fighterStat(board, "ATK")}</b><b><small>DEF</small>{fighterStat(board, "DEF")}</b><b><small>SPD</small>{fighterStat(board, "Speed")}</b></div>
  </section>;
}

function SetupView({ selectedId, setSelectedId, settings, setSettings, begin }: { selectedId: string; setSelectedId: (id: string) => void; settings: HouseSettings; setSettings: (settings: HouseSettings) => void; begin: () => void }) {
  return <main className="playtest-shell shell">
    <section className="playtest-hero paper-stack"><span className="eyebrow">Official interactive field test</span><h1>Play the actual game.</h1><p>Quick Duel uses the live Core catalog, fixed 15-card Starter Deck, random seven-card Market, Locations, real fighter data, and the rendered card files already on this website.</p><div className="playtest-stamps"><span>597-card v2.2.2 catalog</span><span>Quick Duel vs. computer</span><span>Real card art when uploaded</span></div></section>
    <section className="playtest-setup-grid">
      <div className="playtest-roster paper-stack"><div><span className="eyebrow">1 · Choose a fighter</span><h2>Who signs the waiver?</h2></div><div className="playtest-character-grid">{characters.map((character) => <button key={character.id} className={selectedId === character.id ? "is-selected" : ""} onClick={() => setSelectedId(character.id)}><img src={artistUrl(character) ?? cardPlaceholderUrl} alt="" loading="lazy" /><span>{character.name}</span><small>{numberValue(character.stats.ATK)} ATK · {numberValue(character.stats.DEF)} DEF · {numberValue(character.stats.Speed)} SPD</small></button>)}</div></div>
      <aside className="playtest-rules-panel paper-stack"><span className="eyebrow">2 · Field settings</span><h2>Official until somebody opens a form.</h2><label><input type="checkbox" checked={settings.tempo} onChange={(event) => setSettings({ ...settings, tempo: event.target.checked })} />Use Tempo Advantage</label><label><input type="checkbox" checked={settings.locations} onChange={(event) => setSettings({ ...settings, locations: event.target.checked })} />Scene Change every Honor</label><label><input type="checkbox" checked={settings.openMarket} onChange={(event) => setSettings({ ...settings, openMarket: event.target.checked })} />Open Market data cards with no uploaded art</label><p>Quick Duel uses Last Fighter Standing. Black Belt remains a Belt reward, not a win condition.</p><button className="button primary" onClick={begin}>Begin Quick Duel <span>→</span></button></aside>
    </section>
  </main>;
}

export default function PlaytestView({ goTo }: { goTo: (view: "rules" | "cards") => void }) {
  const [selectedId, setSelectedId] = useState(() => characters.find((card) => card.name === "Sensei Ducktape")?.id ?? characters[0].id);
  const [settings, setSettings] = useState<HouseSettings>({ tempo: true, locations: true, openMarket: true });
  const [match, setMatch] = useState<Match | null>(null);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const inspected = inspectedId ? cardFor(inspectedId) : null;

  const begin = () => {
    const choices = characters.filter((card) => card.id !== selectedId);
    const player = { ...emptyBoard(selectedId), xp: 1 };
    const ai = { ...emptyBoard(choices[Math.floor(Math.random() * choices.length)].id), xp: 1 };
    const locations = shuffle(locationPool.map((card) => card.id));
    const marketDeck = shuffle(marketPool.filter((card) => settings.openMarket || Boolean(artistUrl(card))).map((card) => card.id));
    const market = marketDeck.slice(0, 7);
    const currentLocation = settings.locations ? locations[0] : locationPool.find((card) => card.name === "Tournament Mat")?.id ?? locations[0];
    const playerFirst = fighterStat(player, "Speed") >= fighterStat(ai, "Speed");
    setMatch({ player, ai, market, marketDeck: marketDeck.slice(7), locations: locations.slice(1), locationId: currentLocation, round: 1, phase: playerFirst ? "player-yell" : "ai-ready", selectedAttackId: null, selectedZone: "High", pendingStrike: null, winner: null, log: [`Honor 1: ${cardFor(currentLocation)?.name ?? "Tournament Mat"} is active. Both fighters gain 1 XP and refresh Tempo.`, `${playerFirst ? "You" : "Computer"} win initiative on current Speed.`] });
  };

  const write = (current: Match, line: string, changes: Partial<Match> = {}) => ({ ...current, ...changes, log: [line, ...current.log].slice(0, 32) });
  const player = match?.player;
  const ai = match?.ai;
  const playerFighter = player ? cardFor(player.fighterId)! : null;
  const aiFighter = ai ? cardFor(ai.fighterId)! : null;
  const playerTask = useMemo(() => player ? player.completedTasks.includes(player.belt + 1) : false, [player]);

  const chooseAttack = (card: CardEntry) => setMatch((current) => current ? { ...current, selectedAttackId: current.selectedAttackId === card.id ? null : card.id, selectedZone: card.zone?.includes("Any") ? current.selectedZone : card.zone?.split(",")[0] ?? "High" } : current);

  const declareAttack = () => setMatch((current) => {
    if (!current?.selectedAttackId || current.phase !== "player-yell" || current.winner) return current;
    const card = cardFor(current.selectedAttackId);
    if (!card || current.player.attacksThisTurn >= 2) return current;
    const zone = card.zone?.includes("Any") ? current.selectedZone : card.zone?.split(",")[0] ?? "High";
    const tempoBonus = settings.tempo && current.player.tempo && fighterStat(current.player, "Speed") > fighterStat(current.ai, "Speed") ? 1 : 0;
    const attackPower = cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + tempoBonus;
    const defenseId = bestDefense(current.ai, zone);
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    const defensePower = fighterStat(current.ai, "DEF") + (defenseCard ? cardPower(defenseCard) : 0);
    const damage = Math.max(0, attackPower - defensePower);
    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, card.id), playArea: [...current.player.playArea, card.id], xp: current.player.xp + 1, attacksThisTurn: current.player.attacksThisTurn + 1, hitThisTurn: current.player.hitThisTurn || damage > 0, attackedThisRound: true, cardsThisTurn: [...current.player.cardsThisTurn, card.id], zonesPlayed: [...current.player.zonesPlayed, zone], nextAttackBonus: 0, tempo: tempoBonus ? false : current.player.tempo }, card, "player");
    let nextAi = { ...current.ai, hp: Math.max(0, current.ai.hp - damage) };
    if (defenseCard) nextAi = { ...nextAi, hand: removeOne(nextAi.hand, defenseCard.id), playArea: [...nextAi.playArea, defenseCard.id], xp: nextAi.xp + 1, defendedThisRound: true };
    if (damage >= 3 && nextPlayer.belt >= 6) nextPlayer.focus += 1;
    if (!nextAi.hp) nextPlayer.xp += 2;
    nextPlayer = markCompletedTask(nextPlayer);
    const result = damage ? `${card.name} hits ${aiFighter?.name ?? "the opponent"} for ${damage}.` : `${card.name} is blocked${defenseCard ? ` by ${defenseCard.name}` : " by base DEF"}.`;
    return write(current, `${tempoBonus ? "Tempo +1. " : ""}${result} Attack ${attackPower} vs Defense ${defensePower}.`, { player: nextPlayer, ai: nextAi, selectedAttackId: null, winner: nextAi.hp ? null : "player" });
  });

  const playSupport = (id: string) => setMatch((current) => {
    if (!current || current.phase !== "player-yell" || current.winner) return current;
    const card = cardFor(id);
    if (!card || isAttack(card) || isDefense(card)) return current;
    const nextPlayer = markCompletedTask(applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id] }, card, "player"));
    return write(current, `${card.name} played. ${cardEffectNote(card)}`, { player: nextPlayer });
  });

  const enterAscend = () => setMatch((current) => current?.phase === "player-yell" ? write(current, "Ascend: spend this turn's Focus before it leaves your mat.", { phase: "player-ascend", selectedAttackId: null }) : current);

  const buyMarket = (id: string) => setMatch((current) => {
    if (!current || current.phase !== "player-ascend" || current.winner) return current;
    const card = cardFor(id);
    if (!card || current.player.focus < numberValue(card.fpCost)) return current;
    const replacement = current.marketDeck[0];
    const nextPlayer = markCompletedTask({ ...current.player, focus: current.player.focus - numberValue(card.fpCost), discard: [...current.player.discard, id], purchasedTypes: [...current.player.purchasedTypes, card.cardType] });
    const nextMarket = replacement ? current.market.map((entry) => entry === id ? replacement : entry) : current.market.filter((entry) => entry !== id);
    return write(current, `Bought ${card.name}; it enters your discard pile.`, { player: nextPlayer, market: nextMarket, marketDeck: current.marketDeck.slice(1) });
  });

  const promote = () => setMatch((current) => {
    if (!current || current.phase !== "player-ascend" || current.player.belt >= belts.length - 1) return current;
    const next = belts[current.player.belt + 1];
    if (current.player.xp < next.xp || !current.player.completedTasks.includes(current.player.belt + 1)) return current;
    const maxHp = current.player.maxHp + 10;
    const nextPlayer = { ...current.player, belt: current.player.belt + 1, maxHp, hp: Math.min(maxHp, current.player.hp + 5) };
    return write(current, `Certification approved: ${next.name} Belt. ${next.reward}.`, { player: nextPlayer });
  });

  const completeTurn = () => setMatch((current) => {
    if (!current || current.phase !== "player-ascend") return current;
    const nextPlayer = playAreaCleanup(current.player);
    return write(current, "Hide: unspent Focus clears; your next hand is drawn. The computer is ready.", { player: nextPlayer, phase: "ai-ready" });
  });

  const runAiTurn = () => setMatch((current) => {
    if (!current || current.phase !== "ai-ready" || current.winner) return current;
    const aiAttackIds = current.ai.hand.filter((id) => { const card = cardFor(id); return Boolean(card && isAttack(card)); }).sort((left, right) => cardPower(cardFor(right)!) - cardPower(cardFor(left)!)).slice(0, 2);
    if (!aiAttackIds.length) return finishAiTurn(current, "Computer finds no Attack and files an awkward report.", settings.locations);
    return openAiStrike(current, aiAttackIds[0], aiAttackIds.slice(1), settings.tempo);
  });

  const resolveDefense = (defenseId: string | null) => setMatch((current) => {
    if (!current?.pendingStrike || current.phase !== "defense-window") return current;
    const pending = current.pendingStrike;
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    let nextPlayer = { ...current.player };
    let defensePower = fighterStat(nextPlayer, "DEF");
    let tempoBonus = 0;
    if (defenseCard) {
      tempoBonus = settings.tempo && nextPlayer.tempo && fighterStat(nextPlayer, "Speed") > fighterStat(current.ai, "Speed") ? 1 : 0;
      defensePower += cardPower(defenseCard) + tempoBonus;
      nextPlayer = markCompletedTask({ ...nextPlayer, hand: removeOne(nextPlayer.hand, defenseCard.id), playArea: [...nextPlayer.playArea, defenseCard.id], xp: nextPlayer.xp + 1, defendedThisRound: true, tempo: tempoBonus ? false : nextPlayer.tempo });
    }
    const damage = Math.max(0, pending.attackPower - defensePower);
    nextPlayer.hp = Math.max(0, nextPlayer.hp - damage);
    const aiCard = cardFor(pending.cardId)!;
    let nextAi = current.ai;
    if (!nextPlayer.hp) nextAi = { ...nextAi, xp: nextAi.xp + 2 };
    const message = damage ? `${aiCard.name} hits you for ${damage}. Attack ${pending.attackPower} vs Defense ${defensePower}.` : `${defenseCard?.name ?? "Your base DEF"} blocks ${aiCard.name}.`;
    const resolved = write(current, `${tempoBonus ? "Tempo +1 Guard. " : ""}${message}`, { player: nextPlayer, ai: nextAi, pendingStrike: null, winner: nextPlayer.hp ? null : "ai" });
    if (!nextPlayer.hp) return resolved;
    if (pending.remainingAiAttacks.length) return openAiStrike(resolved, pending.remainingAiAttacks[0], pending.remainingAiAttacks.slice(1), settings.tempo);
    return finishAiTurn(resolved, "Computer finishes its Yell and clears the mat.", settings.locations);
  });

  if (!match || !player || !ai || !playerFighter || !aiFighter) return <SetupView selectedId={selectedId} setSelectedId={setSelectedId} settings={settings} setSettings={setSettings} begin={begin} />;
  const pendingAttack = match.selectedAttackId ? cardFor(match.selectedAttackId) : null;
  const currentLocation = cardFor(match.locationId);
  const nextBelt = belts[player.belt + 1];
  const canPromote = Boolean(nextBelt && player.xp >= nextBelt.xp && playerTask);
  const defenseOptions = match.pendingStrike ? legalDefenseIds(player, match.pendingStrike.zone) : [];

  return <main className="playtest-shell shell">
    <header className="playtest-topbar"><div><span className="eyebrow">Quick Duel · live card catalog</span><h1>Department Field Test <small>Round {match.round}</small></h1></div><div className="playtest-actions"><button onClick={() => setMatch(null)}>New Duel</button><button onClick={() => goTo("rules")}>Rules Desk</button><button onClick={() => goTo("cards")}>Card Library</button></div></header>
    {match.winner && <section className="match-result paper-stack"><span>{match.winner === "player" ? "Victory certified" : "The paperwork won"}</span><h2>{match.winner === "player" ? `${playerFighter.name} remains standing.` : `${aiFighter.name} wins this field test.`}</h2><p>Start a new Quick Duel whenever you are ready to dispute the outcome.</p><button className="button primary" onClick={() => setMatch(null)}>Set up another duel →</button></section>}
    <section className="playtest-location paper-stack"><span>Current Location · Honor {match.round}</span><div><h2>{currentLocation?.name ?? "Tournament Mat"}</h2><p>{currentLocation?.rulesText ?? "The Department finds no reason to intervene."}</p></div><button onClick={() => currentLocation && setInspectedId(currentLocation.id)}>Inspect location</button></section>
    <section className="playtest-table">
      <FighterPanel board={ai} label="Computer" enemy onInspect={(card) => setInspectedId(card.id)} />
      <section className="playtest-combat-desk paper-stack"><span className="eyebrow">Match state</span><div className="combat-meters"><b><small>YOUR FOCUS</small>{player.focus}</b><b><small>AI HAND</small>{ai.hand.length}</b><b className={player.tempo ? "tempo-ready" : ""}><small>TEMPO</small>{player.tempo ? "READY" : "USED"}</b></div><p>{match.phase === "player-yell" ? "Yell: play cards, make up to two normal Attacks." : match.phase === "player-ascend" ? "Ascend: buy from the seven-card Market or certify a Belt." : match.phase === "defense-window" ? "Reaction Window: play one matching Defense or pass." : "Computer turn: let it make its choices."}</p>{match.phase === "ai-ready" && !match.winner && <button className="button primary" onClick={runAiTurn}>Run computer turn →</button>}</section>
      <FighterPanel board={player} label="You" onInspect={(card) => setInspectedId(card.id)} />
    </section>
    <section className="playtest-workspace">
      <section className="hand-panel paper-stack"><header><div><span className="eyebrow">Your hand · {player.hand.length} cards</span><h2>{match.phase === "defense-window" ? `Defend ${match.pendingStrike?.zone} or let it land` : "Choose your next card"}</h2></div><div className="hand-counters"><span>Deck {player.deck.length}</span><span>Discard {player.discard.length}</span><span>Attacks {player.attacksThisTurn}/2</span></div></header><div className="play-card-row">{player.hand.map((id, index) => { const card = cardFor(id); if (!card) return null; const attack = isAttack(card); const defense = isDefense(card); const canUse = match.phase === "player-yell" && (attack ? player.attacksThisTurn < 2 : !defense); const canDefend = match.phase === "defense-window" && defenseOptions.includes(id); return <PlayCard key={`${id}-${index}`} card={card} selected={match.selectedAttackId === id} disabled={match.phase === "defense-window" ? !canDefend : !canUse} onClick={match.phase === "defense-window" ? () => resolveDefense(id) : attack ? () => chooseAttack(card) : () => playSupport(id)} onInspect={() => setInspectedId(id)} />; })}</div>{match.phase === "defense-window" && <button className="button ghost" onClick={() => resolveDefense(null)}>Pass the reaction window</button>}{match.phase === "player-yell" && <div className="playtest-yell-actions">{pendingAttack && <><label>For Any-zone Attack:<select value={match.selectedZone} onChange={(event) => setMatch((current) => current ? { ...current, selectedZone: event.target.value } : current)}><option>High</option><option>Mid</option><option>Low</option></select></label><button className="button primary" onClick={declareAttack}>Declare {pendingAttack.name} →</button></>}<button className="button ghost" onClick={enterAscend}>Finish Yell → Ascend</button></div>}</section>
      <aside className="playtest-side-stack">
        <section className="market-panel paper-stack"><header><span className="eyebrow">Shared Market · 7 real cards</span><h2>Spend Focus in Ascend</h2></header><div className="market-row">{match.market.map((id) => { const card = cardFor(id); if (!card) return null; const affordable = player.focus >= numberValue(card.fpCost); return <PlayCard key={id} card={card} disabled={match.phase !== "player-ascend" || !affordable} onClick={() => buyMarket(id)} onInspect={() => setInspectedId(id)} />; })}</div>{match.phase === "player-ascend" && <div className="ascend-actions"><button className="button primary" disabled={!canPromote} onClick={promote}>{canPromote ? `Promote to ${nextBelt?.name}` : nextBelt ? `${nextBelt.name}: ${nextBelt.xp} XP + task` : "Black Belt certified"}</button><button className="button ghost" onClick={completeTurn}>Hide · End turn →</button></div>}</section>
        <section className="belt-panel paper-stack"><span className="eyebrow">Certification ledger</span><h2>{belts[player.belt].name} Belt · {player.xp} XP</h2><p>{nextBelt ? <><b>Next: {nextBelt.name} · {nextBelt.xp} XP.</b> {nextBelt.task}</> : "Every available Belt has been certified."}</p><div className="belt-track">{belts.map((belt, index) => <span className={index <= player.belt ? "earned" : ""} key={belt.name}>{belt.name.slice(0, 1)}</span>)}</div></section>
        <section className="event-log paper-stack"><span className="eyebrow">Fight log</span><ol>{match.log.slice(0, 8).map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}</ol></section>
      </aside>
    </section>
    {inspected && <div className="playtest-inspector-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setInspectedId(null)}><article className="playtest-inspector paper-stack" role="dialog" aria-modal="true" aria-labelledby="playtest-inspector-title"><button className="modal-close" onClick={() => setInspectedId(null)} aria-label="Close Card Inspector">×</button><div className="inspector-heading"><img src={artistUrl(inspected) ?? cardPlaceholderUrl} alt={artistUrl(inspected) ? inspected.name : "Card data panel"} /><div><span className="eyebrow">{inspected.catalogId} · {inspected.cardType} · {inspected.subtype}</span><h2 id="playtest-inspector-title">{inspected.name}</h2><p>{inspected.flavorText}</p></div></div><dl><div><dt>Focus Cost</dt><dd>{inspected.fpCost ?? "—"}</dd></div><div><dt>Focus Value</dt><dd>{inspected.focusValue ?? "—"}</dd></div><div><dt>Zone</dt><dd>{inspected.zone ?? "—"}</dd></div><div><dt>Timing</dt><dd>{inspected.timing ?? "—"}</dd></div></dl><section><span>Printed rules text</span><p>{inspected.rulesText ?? "No printed rules text."}</p></section><footer>{cardEffectNote(inspected)} The Card Library remains the source of truth for the complete catalog record.</footer></article></div>}
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
  const zone = card.zone?.includes("Any") ? ["High", "Mid", "Low"][Math.floor(Math.random() * 3)] : card.zone?.split(",")[0] ?? "High";
  const tempoBonus = useTempo && current.ai.tempo && fighterStat(current.ai, "Speed") > fighterStat(current.player, "Speed") ? 1 : 0;
  const attackPower = cardPower(card) + fighterStat(current.ai, "ATK") + current.ai.nextAttackBonus + tempoBonus;
  let nextAi = applyCardEffects({ ...current.ai, hand: removeOne(current.ai.hand, card.id), playArea: [...current.ai.playArea, card.id], xp: current.ai.xp + 1, attacksThisTurn: current.ai.attacksThisTurn + 1, cardsThisTurn: [...current.ai.cardsThisTurn, card.id], nextAttackBonus: 0, tempo: tempoBonus ? false : current.ai.tempo }, card, "ai");
  return { ...current, ai: nextAi, phase: "defense-window" as const, pendingStrike: { cardId, zone, attackPower, remainingAiAttacks }, log: [`Computer declares ${card.name} to ${zone}. ${tempoBonus ? "Tempo adds +1. " : ""}Choose one matching Defense or pass.`, ...current.log].slice(0, 32) };
}

function finishAiTurn(current: Match, line: string, sceneChanges: boolean) {
  const aiPurchase = current.market.filter((id) => numberValue(cardFor(id)?.fpCost) <= current.ai.focus).sort((left, right) => numberValue(cardFor(right)?.fpCost) - numberValue(cardFor(left)?.fpCost))[0];
  const purchasedCard = aiPurchase ? cardFor(aiPurchase) : null;
  const replacement = current.marketDeck[0];
  const aiAfterPurchase = purchasedCard ? { ...current.ai, focus: current.ai.focus - numberValue(purchasedCard.fpCost), discard: [...current.ai.discard, purchasedCard.id], purchasedTypes: [...current.ai.purchasedTypes, purchasedCard.cardType] } : current.ai;
  const market = purchasedCard ? (replacement ? current.market.map((id) => id === purchasedCard.id ? replacement : id) : current.market.filter((id) => id !== purchasedCard.id)) : current.market;
  const marketDeck = purchasedCard ? current.marketDeck.slice(1) : current.marketDeck;
  const nextAi = playAreaCleanup(aiAfterPurchase);
  const nextRound = current.round + 1;
  const freshLocations = current.locations.length ? current.locations : shuffle(locationPool.map((card) => card.id));
  const locationId = sceneChanges ? freshLocations[0] ?? current.locationId : current.locationId;
  const player = { ...current.player, xp: current.player.xp + 1, tempo: true, tempSpeed: 0, attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, hitThisTurn: false, cardsThisTurn: [] };
  const ai = { ...nextAi, xp: nextAi.xp + 1, tempo: true, tempSpeed: 0, attackedThisRound: false, defendedThisRound: false, attacksThisTurn: 0, hitThisTurn: false, cardsThisTurn: [] };
  const playerFirst = fighterStat(player, "Speed") >= fighterStat(ai, "Speed");
  const purchaseLog = purchasedCard ? `Computer buys ${purchasedCard.name}.` : "Computer buys nothing.";
  return { ...current, player, ai, market, marketDeck, locationId, locations: sceneChanges ? freshLocations.slice(1) : current.locations, round: nextRound, phase: playerFirst ? "player-yell" as const : "ai-ready" as const, selectedAttackId: null, log: [`Honor ${nextRound}: ${cardFor(locationId)?.name ?? "Tournament Mat"} is active. Both fighters gain 1 XP and refresh Tempo. ${playerFirst ? "You" : "Computer"} take initiative.`, purchaseLog, line, ...current.log].slice(0, 32) };
}
