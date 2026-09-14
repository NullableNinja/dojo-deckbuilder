import assert from "node:assert/strict";
import test from "node:test";
import { applyQuickDuelPlaytestTransition, resolveQuickDuelPlaytestCharacterChoice } from "../app/quick-duel-playtest-host.ts";

function board(overrides = {}) {
  return { fighterId:"DDB-CHR-CORE-001", belt:3, hp:10, maxHp:10, xp:0, focus:0, tempSpeed:0,
    nextAttackBonus:0, nextDefenseCardBonus:0, nextAttackHasFlow:false, nextAttackAnyZone:false,
    attacksThisTurn:0, zonesPlayed:[], cardsThisTurn:[], equipment:[], exhaustedEquipment:[],
    hand:["h1"], deck:["d1","d2"], discard:[], destroyed:[], learnedCombos:[], triggeredCombos:[],
    cardsBought:0, usedConsumableThisRound:false, wasHitSinceLastTurn:false, damageReductionUsed:false,
    reversalAttackBonus:0, borrowedEquipmentId:null, abilityUsedRound:false,
    usedCharacterEffectIdsThisTurn:[], usedCharacterEffectIdsThisRound:[], usedCharacterEffectIdsThisGame:[],
    characterMarks:{}, stage3cStatuses:[], stage3cChoices:[], stage3cRestrictions:[], damageDealt:0,
    damageTaken:0, completedBeltExamThisRound:false, ...overrides };
}
function match(player=board(), ai=board(), overrides={}) {
  return { schema:8, player, ai, market:[], round:1, phase:"player-initiate", turnOrder:["player","ai"],
    turnIndex:0, lastExchange:null, locationId:"loc-a", pendingChoice:null, winner:null, log:[], ...overrides };
}
const noCards = () => null;

test("Venue Val player receives sceneChange and resumes cycle", () => {
  const previous = match(board({fighterId:"DDB-CHR-CORE-039",hand:["h1"],deck:["d1","d2"]}));
  const hosted = applyQuickDuelPlaytestTransition(previous,{...previous,locationId:"loc-b"},noCards);
  assert.equal(hosted.pendingChoice?.kind,"character-runtime");
  assert.equal(hosted.pendingChoice?.event?.type,"sceneChange");
  assert.equal(hosted.pendingChoice?.choice?.resolver,"character.sceneChangeCycle");
  assert.deepEqual(hosted.player.hand,["h1","d2"]);
  const resolved = resolveQuickDuelPlaytestCharacterChoice(hosted,"player",hosted.pendingChoice.event,hosted.pendingChoice.choice,"h1");
  assert.deepEqual(resolved.match.player.hand,["d2"]);
  assert.deepEqual(resolved.match.player.discard,["h1"]);
});

test("Venue Val AI auto-resolves sceneChange", () => {
  const previous = match(board(),board({fighterId:"DDB-CHR-CORE-039",hand:["ai-h1"],deck:["ai-d1","ai-d2"]}));
  const hosted = applyQuickDuelPlaytestTransition(previous,{...previous,locationId:"loc-b"},noCards);
  assert.equal(hosted.pendingChoice,null);
  assert.equal(hosted.ai.hand.length,1);
  assert.equal(hosted.ai.discard.length,1);
  assert.equal(hosted.ai.deck.length,1);
});

test("sceneChange ignores unchanged and initial Location", () => {
  const venue=board({fighterId:"DDB-CHR-CORE-039",hand:["h1"],deck:["d1","d2"]});
  const unchanged=match(venue);
  const unchangedHosted=applyQuickDuelPlaytestTransition(unchanged,{...unchanged,player:{...venue,focus:1}},noCards);
  assert.equal(unchangedHosted.pendingChoice,null);
  assert.deepEqual(unchangedHosted.player.hand,["h1"]);
  const initial=match(venue,board(),{locationId:undefined});
  const initialHosted=applyQuickDuelPlaytestTransition(initial,{...initial,locationId:"loc-a"},noCards);
  assert.equal(initialHosted.pendingChoice,null);
  assert.deepEqual(initialHosted.player.hand,["h1"]);
});

test("global Location transition reaches both Venue Vals", () => {
  const previous=match(board({fighterId:"DDB-CHR-CORE-039",hand:["p-h1"],deck:["p-d1","p-d2"]}),board({fighterId:"DDB-CHR-CORE-039",hand:["a-h1"],deck:["a-d1","a-d2"]}));
  const hosted=applyQuickDuelPlaytestTransition(previous,{...previous,locationId:"loc-b"},noCards);
  assert.equal(hosted.pendingChoice?.event?.type,"sceneChange");
  assert.equal(hosted.player.hand.length,2);
  assert.equal(hosted.ai.hand.length,1);
  assert.equal(hosted.ai.discard.length,1);
});
