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
  return {
    id: player.id, name: player.name, hp: player.hp, maxHp: player.maxHp,
    atk: player.atk, def: player.def, speed: player.speed, focus: player.focus,
    xp: player.xp, beltIndex: player.beltIndex,
    beltName: data.definition.progression.belts[player.beltIndex]?.name ?? `Belt ${player.beltIndex}`,
    character: cardView(player.character), hand: cards(player.hand), equipment: cards(player.equipment), played: cards(player.played),
    deckCount: player.deck?.length ?? 0, discardCount: player.discard?.length ?? 0, learnedCombos: cards(player.learnedCombos),
    roster: player.roster?.map((fighter) => ({ character: cardView(fighter.character), hp: fighter.hp, maxHp: fighter.maxHp })) ?? [],
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
  if (!game) return { screen: "menu", modes: ["quick-duel", "boss-blitz"] };
  const opponent = game.players[1];
  const pending = game.getPendingChoice();
  return {
    screen: "game", mode: game.modeId ?? game.definition.mode.id, phase: game.phase, round: game.round, turns: game.turns,
    activePlayer: game.activePlayer, winner: game.winner, reason: game.reason, player: playerView(game.players[0]), opponent: playerView(opponent),
    boss: game.modeId === "boss-blitz" ? {
      stageIndex: game.bossStageIndex, stageName: game.currentBossStageName, profile: cardView(opponent.bossProfile), stage: cardView(opponent.bossStage),
      guard: game.bossGuard ? { card: cardView(game.bossGuard.card), zone: game.bossGuard.zone, guard: game.bossGuard.guard } : null, stats: game.bossStats,
    } : null,
    market: cards(game.market), legalActions: game.winner === null && !pending ? game.getLegalActions(0) : [], pendingChoice: pending, events: game.events.slice(-30),
  };
}

async function command(message) {
  if (message.type === "start") {
    const mode = message.mode === "boss-blitz" ? "boss-blitz" : "quick-duel";
    data = await loadGameData({ modeId: mode });
    game = createGame(data, { seed: Number(message.seed) || 1, strategies: ["human", "balanced"], interactive: mode === "boss-blitz" });
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
