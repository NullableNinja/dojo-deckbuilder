import { createInterface } from "node:readline";
import { loadGameData } from "./rules-loader.mjs";
import { createGame } from "./games.mjs";

let data = null;
let game = null;

const cardView = (card) => card ? {
  id: card.instanceId ?? card.catalogId,
  catalogId: card.catalogId,
  name: card.name,
  cardType: card.cardType,
  subtype: card.subtype,
  zone: card.zone,
  rulesText: card.rulesText,
  flavorText: card.flavorText,
  image: card.image,
  fpCost: card.fpCost,
  focusValue: card.focusValue,
  stats: card.stats ?? {},
} : null;
const cards = (list) => (list ?? []).map(cardView).filter(Boolean);

function playerView(player) {
  const currentBelt = data.definition.progression.belts[player.beltIndex] ?? null;
  const nextBelt = data.definition.progression.belts[player.beltIndex + 1] ?? null;
  return {
    id: player.id, name: player.name, hp: player.hp, maxHp: player.maxHp,
    atk: player.atk, def: player.def, speed: player.speed, focus: player.focus,
    xp: player.xp, beltIndex: player.beltIndex,
    beltName: currentBelt?.name ?? `Belt ${player.beltIndex}`, beltColor: currentBelt?.color ?? "#f5f0df",
    belt: { current: currentBelt, next: nextBelt, examComplete: game.beltExamComplete(player), canPromote: game.canPromote(player), completedTasks: [...player.completedTasks], examProgress: structuredClone(player.examProgress), stripes: structuredClone(player.trainingStripes) },
    character: cardView(player.character), hand: cards(player.hand), equipment: cards(player.equipment), played: cards(player.played),
    deckCount: player.deck?.length ?? 0, discardCount: player.discard?.length ?? 0, learnedCombos: cards(player.learnedCombos), comboOffered: cardView(player.comboOffered),
    roster: player.roster?.map((fighter) => ({ character: cardView(fighter.character), hp: fighter.hp, maxHp: fighter.maxHp })) ?? [],
  };
}

function combatView() {
  const events = game.events ?? [];
  const lastAttack = [...events].reverse().find((event) => event.type === "attack" || event.type === "boss-attack") ?? null;
  const pending = game.getPendingChoice();
  const pendingAttack = pending?.cardId && pending?.attackerId !== undefined
    ? game.cardByInstance(pending.attackerId, pending.cardId)
    : null;
  return {
    last: lastAttack ? {
      attacker: lastAttack.attacker ?? 1,
      defender: lastAttack.defender ?? 0,
      card: cardView(data.byId.get(lastAttack.card)),
      defense: cardView(lastAttack.defense ? data.byId.get(lastAttack.defense) : null),
      attack: lastAttack.attack ?? null,
      block: lastAttack.block ?? null,
      damage: lastAttack.damage ?? 0,
      zone: lastAttack.zone ?? null,
      blocked: lastAttack.blocked ?? (lastAttack.damage === 0 && Boolean(lastAttack.defense)),
    } : null,
    pending: pendingAttack ? {
      attacker: pending.attackerId,
      defender: pending.playerId,
      card: cardView(pendingAttack),
      defense: null,
      zone: pending.zone ?? pendingAttack.zone ?? null,
      kind: pending.kind,
      attackPreview: (game.players[pending.attackerId]?.atk ?? 0) + (pendingAttack.stats?.Damage ?? 0) + (game.players[pending.attackerId]?.nextAttackPower ?? 0),
    } : null,
  };
}

function eventView(event) {
  return {
    ...event,
    cardName: event.card ? data.byId.get(event.card)?.name ?? event.card : null,
    defenseName: event.defense ? data.byId.get(event.defense)?.name ?? event.defense : null,
    comboName: event.combo ? data.byId.get(event.combo)?.name ?? event.combo : null,
    locationName: event.location ? data.byId.get(event.location)?.name ?? event.location : null,
  };
}

function pumpAutomaticTurns() {
  let guard = 0;
  while (game && game.winner === null && guard++ < 10000) {
    if (game.pendingChoice) {
      if (game.pendingChoice.playerId === 0) break;
      if (!game.resolveChoice(game.defaultChoice())) throw new Error("The automated opponent selected an illegal choice");
      continue;
    }
    if (game.phase === "Honor") { game.advanceAutomaticEvents(); continue; }
    if (game.activePlayer === 0) break;
    const legal = game.getLegalActions(game.activePlayer);
    if (!legal.length) throw new Error(`Opponent has no legal action in ${game.phase}`);
    const action = game.defaultAction(legal);
    if (!action || !game.applyAction(action)) throw new Error("The automated opponent selected an illegal action");
  }
  if (guard >= 10000) throw new Error("Desktop game session stalled");
  if (game) game.assertInvariants(game.decisions.length + 1);
}

function view() {
  if (!game) return menuView();
  const opponent = game.players[1];
  const pending = game.getPendingChoice();
  return {
    screen: "game", mode: game.modeId ?? game.definition.mode.id, phase: game.phase, round: game.round, turns: game.turns,
    activePlayer: game.activePlayer, winner: game.winner, reason: game.reason, belts: data.definition.progression.belts, player: playerView(game.players[0]), opponent: playerView(opponent),
    boss: game.modeId === "boss-blitz" ? {
      stageIndex: game.bossStageIndex, stageName: game.currentBossStageName, profile: cardView(opponent.bossProfile), stage: cardView(opponent.bossStage),
      guard: game.bossGuard ? { card: cardView(game.bossGuard.card), zone: game.bossGuard.zone, guard: game.bossGuard.guard } : null, stats: game.bossStats,
    } : null,
    combat: combatView(),
    market: cards(game.market), legalActions: game.winner === null && !pending ? game.getLegalActions(0) : [], pendingChoice: pending, events: game.events.slice(-30).map(eventView),
  };
}

function menuView() {
  return {
    screen: "menu",
    modes: ["quick-duel", "boss-blitz"],
    characters: data ? data.cards.filter((card) => card.cardType === "Character").map(cardView) : [],
  };
}

async function command(message) {
  if (message.type === "menu") {
    data = await loadGameData();
    game = null;
    return menuView();
  }
  if (message.type === "info") {
    data ??= await loadGameData();
    if (message.kind === "library") return { ...view(), info: { kind: "library", cards: cards(data.cards) } };
    return { ...view(), info: { kind: "rulings", rules: data.rules } };
  }
  if (message.type === "start") {
    const mode = message.mode === "boss-blitz" ? "boss-blitz" : "quick-duel";
    data = await loadGameData({ modeId: mode });
    const selectedCharacter = data.cards.find((card) => card.cardType === "Character" && card.catalogId === message.characterId);
    const canonicalCharacters = data.cards.filter((card) => card.cardType === "Character");
    const requestedIds = mode === "boss-blitz" && Array.isArray(message.characterIds) && message.characterIds.length
      ? [...new Set(message.characterIds)]
      : canonicalCharacters.slice(0, 3).map((card) => card.catalogId);
    const characters = mode === "boss-blitz"
      ? requestedIds.map((id) => canonicalCharacters.find((card) => card.catalogId === id)).filter(Boolean)
      : (selectedCharacter ? [selectedCharacter] : []);
    if (mode === "boss-blitz" && characters.length !== 3) throw new Error("Boss Blitz requires three different canonical Characters");
    game = createGame(data, { seed: Number(message.seed) || 1, strategies: ["human", "balanced"], characters, interactive: mode === "boss-blitz" });
    pumpAutomaticTurns();
    return view();
  }
  if (message.type === "reset") { game = null; data = null; return view(); }
  if (!game) throw new Error("Start a game first");
  if (message.type === "choice") {
    if (!game.pendingChoice || game.pendingChoice.playerId !== 0) throw new Error("No player choice is pending");
    if (!game.resolveChoice(message.choice)) throw new Error("That choice is not legal");
  } else if (message.type === "action") {
    if (!game.applyAction(message.action)) throw new Error("That action is not legal");
  } else throw new Error(`Unknown desktop command: ${message.type}`);
  pumpAutomaticTurns();
  return view();
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
let commandQueue = Promise.resolve();
input.on("line", (line) => {
  commandQueue = commandQueue.then(async () => {
    let message;
    try {
      message = JSON.parse(line);
      process.stdout.write(`${JSON.stringify({ id: message.id, ok: true, view: await command(message) })}\n`);
    } catch (error) {
      process.stdout.write(`${JSON.stringify({ id: message?.id ?? null, ok: false, error: error instanceof Error ? error.message : String(error), view: view() })}\n`);
    }
  });
});
