import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../app/playtest.tsx", import.meta.url);
let source = await readFile(path, "utf8");

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source fragment not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: source fragment matched more than once`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  "lifecycle host import",
  'import { applyQuickDuelPlaytestTransition } from "./quick-duel-playtest-host";',
  'import { applyQuickDuelPlaytestTransition, publishQuickDuelPlaytestLifecycleEvent } from "./quick-duel-playtest-host";',
);

replaceOnce(
  "generic host operations",
  `function drawCards(board: Board, count: number) {
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

function isCoreDefenseCard`,
  `function drawCards(board: Board, count: number) {
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

const quickDuelHostOperations = {
  draw: (board: Board, amount: number) => drawCards(board, amount),
  discardForAi: (board: Board, amount: number) => {
    const count = Math.min(Math.max(0, amount), board.hand.length);
    const ranked = [...board.hand].sort((left, right) => cardFocus(cardFor(left)) - cardFocus(cardFor(right)));
    const discarded = ranked.slice(0, count);
    let hand = [...board.hand];
    for (const id of discarded) hand = removeOne(hand, id);
    return { ...board, hand, discard: [...board.discard, ...discarded] };
  },
};

function isCoreDefenseCard`,
);

replaceOnce(
  "player Initiate after AI",
  `  if (current.turnIndex === 0) {
    const player = applyInitiateCarryover(finished.player);
    const carryover = player.focus - finished.player.focus;
    return { ...finished, player, phase: "player-initiate" as const, turnIndex: 1 as const, log: [\`You are second in this round's initiative order. Initiate begins now.\${carryover ? \` Delayed effects generate \${carryover} Focus.\` : ""}\`, ...finished.log].slice(0, 32) };
  }`,
  `  if (current.turnIndex === 0) {
    const hostedFinished = publishQuickDuelPlaytestLifecycleEvent(finished, "player", "onInitiate", quickDuelHostOperations).match;
    const player = applyInitiateCarryover(hostedFinished.player);
    const carryover = player.focus - finished.player.focus;
    return { ...hostedFinished, player, phase: "player-initiate" as const, turnIndex: 1 as const, log: [\`You are second in this round's initiative order. Initiate begins now.\${carryover ? \` Delayed effects generate \${carryover} Focus.\` : ""}\`, ...hostedFinished.log].slice(0, 32) };
  }`,
);

replaceOnce(
  "round-start Initiate host",
  `  const playerFirst = fighterStat(player, "Speed") >= fighterStat(ai, "Speed");
  const initiatedPlayer = playerFirst ? applyInitiateCarryover(player) : player;
  const turnOrder: Match["turnOrder"] = playerFirst ? ["player", "ai"] : ["ai", "player"];`,
  `  const playerFirst = fighterStat(player, "Speed") >= fighterStat(ai, "Speed");
  const stagedForInitiate: Match = { ...current, player, ai };
  const hostedInitiate = playerFirst ? publishQuickDuelPlaytestLifecycleEvent(stagedForInitiate, "player", "onInitiate", quickDuelHostOperations).match : stagedForInitiate;
  const initiatedPlayer = playerFirst ? applyInitiateCarryover(hostedInitiate.player) : player;
  const initiatedAi = hostedInitiate.ai;
  const turnOrder: Match["turnOrder"] = playerFirst ? ["player", "ai"] : ["ai", "player"];`,
);

replaceOnce(
  "round-start hosted AI projection",
  `  const advanced: Match = { ...current, ...marketState, player: initiatedPlayer, ai, marketPurchasedThisRound: false,`,
  `  const advanced: Match = { ...current, ...marketState, player: initiatedPlayer, ai: initiatedAi, marketPurchasedThisRound: false,`,
);

replaceOnce(
  "AI Initiate lifecycle",
  `function prepareAiTurn(current: Match) {
  const fighter = cardFor(current.ai.fighterId);`,
  `function prepareAiTurn(current: Match) {
  current = publishQuickDuelPlaytestLifecycleEvent(current, "ai", "onInitiate", quickDuelHostOperations).match;
  const fighter = cardFor(current.ai.fighterId);`,
);

for (const required of [
  'publishQuickDuelPlaytestLifecycleEvent(finished, "player", "onInitiate"',
  'publishQuickDuelPlaytestLifecycleEvent(stagedForInitiate, "player", "onInitiate"',
  'publishQuickDuelPlaytestLifecycleEvent(current, "ai", "onInitiate"',
]) {
  if (!source.includes(required)) throw new Error(`lifecycle reconciliation missing: ${required}`);
}

await writeFile(path, source);
console.log("Reconciled canonical Quick Duel Initiate lifecycle against current Playtest.");
