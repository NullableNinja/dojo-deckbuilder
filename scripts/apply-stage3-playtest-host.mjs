import { readFile, writeFile } from "node:fs/promises";

// One-time guarded authoring migration for the isolated Stage 3 feature branch.
const path = new URL("../app/playtest.tsx", import.meta.url);
let source = await readFile(path, "utf8");

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source fragment was not found; refusing to edit playtest.tsx`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: source fragment matched more than once; refusing an ambiguous edit`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  "Quick Duel lifecycle import",
  'import { applyQuickDuelPlaytestTransition } from "./quick-duel-playtest-host";',
  'import { applyQuickDuelPlaytestTransition, publishQuickDuelPlaytestLifecycleEvent } from "./quick-duel-playtest-host";',
);

const drawCardsSource = `function drawCards(board: Board, count: number) {
  let deck = [...board.deck];
  let discard = [...board.discard];
  let hand = [...board.hand];
  for (let index = 0; index < count; index += 1) {
    if (!deck.length && discard.length) { deck = shuffle(discard); discard = []; }
    const next = deck.pop();
    if (next) hand.push(next);
  }
  return { ...board, deck, discard, hand };
}`;

const drawCardsWithHostOperations = `${drawCardsSource}

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
};`;
replaceOnce("Quick Duel host board operations", drawCardsSource, drawCardsWithHostOperations);

replaceOnce(
  "player-second Initiate lifecycle",
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
  "round-start player Initiate lifecycle",
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
  "round-start hosted opponent preservation",
  "const advanced: Match = { ...current, ...marketState, player: initiatedPlayer, ai, marketPurchasedThisRound:",
  "const advanced: Match = { ...current, ...marketState, player: initiatedPlayer, ai: initiatedAi, marketPurchasedThisRound:",
);

replaceOnce(
  "AI Initiate lifecycle",
  `function prepareAiTurn(current: Match) {
  const fighter = cardFor(current.ai.fighterId);`,
  `function prepareAiTurn(current: Match) {
  current = publishQuickDuelPlaytestLifecycleEvent(current, "ai", "onInitiate", quickDuelHostOperations).match;
  const fighter = cardFor(current.ai.fighterId);`,
);

if (!source.includes('publishQuickDuelPlaytestLifecycleEvent(finished, "player", "onInitiate"')) throw new Error("player-second Initiate host was not installed");
if (!source.includes('publishQuickDuelPlaytestLifecycleEvent(stagedForInitiate, "player", "onInitiate"')) throw new Error("round-start player Initiate host was not installed");
if (!source.includes('publishQuickDuelPlaytestLifecycleEvent(current, "ai", "onInitiate"')) throw new Error("AI Initiate host was not installed");

await writeFile(path, source);
console.log("Applied guarded Stage 3 Playtest Initiate-lifecycle migration.");
