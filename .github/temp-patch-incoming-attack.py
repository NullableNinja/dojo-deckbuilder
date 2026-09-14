from pathlib import Path

host = Path('app/quick-duel-playtest-host.ts')
text = host.read_text()

old = '''type QuickDuelPlaytestStateMatch<Board extends QuickDuelComboMatchBoard> = QuickDuelPlaytestHostMatch<Board> & {
  pendingChoice?: unknown | null;
  winner?: QuickDuelPlaytestActor | null;
};'''
new = '''type QuickDuelPendingStrikeCharacterFacts = {
  cardId?: string;
  attackPower: number;
  modifierBonus?: number;
};

type QuickDuelPlaytestStateMatch<Board extends QuickDuelComboMatchBoard> = QuickDuelPlaytestHostMatch<Board> & {
  pendingChoice?: unknown | null;
  pendingStrike?: QuickDuelPendingStrikeCharacterFacts | null;
  winner?: QuickDuelPlaytestActor | null;
};'''
assert old in text
text = text.replace(old, new, 1)

anchor = '''function quickDuelCharacterHitEvent<Board extends QuickDuelCharacterCombatBoard>(
'''
insert = '''function projectIncomingAttackCharacterEvent<
  Board extends QuickDuelComboMatchBoard & QuickDuelCharacterCombatBoard,
  Match extends QuickDuelPlaytestStateMatch<Board>,
>(match: Match, event: CharacterRuntimeEvent | null): Match {
  if (event?.type !== "incomingAttackDeclared" || !match.pendingStrike || !Number.isFinite(event.attackPower)) return match;
  return {
    ...match,
    pendingStrike: {
      ...match.pendingStrike,
      attackPower: Math.max(0, Number(event.attackPower)),
      modifierBonus: Math.max(0, Number(event.modifierBonus ?? match.pendingStrike.modifierBonus ?? 0)),
    },
  } as Match;
}

function publishCharacterIncomingAttackTransition<
  Board extends QuickDuelComboMatchBoard & QuickDuelCharacterCombatBoard,
  Match extends QuickDuelPlaytestStateMatch<Board>,
>(previous: Match, next: Match): Match {
  if (previous.pendingStrike || !next.pendingStrike) return next;

  const event: CharacterRuntimeEvent = {
    type: "incomingAttackDeclared",
    attackPower: next.pendingStrike.attackPower,
    modifierBonus: Math.max(0, Number(next.pendingStrike.modifierBonus ?? 0)),
  };
  const character = publishQuickDuelPlaytestCharacterEvent(next, "player", event);
  let result = projectIncomingAttackCharacterEvent(character.match as Match, character.event);

  if (character.event && character.choices.length > 0) {
    const pending: QuickDuelCharacterChoiceState = {
      kind: "character-runtime",
      event: character.event,
      choice: character.choices[0],
    };
    result = result.pendingChoice
      ? withDeferredCharacterChoice(result, pending)
      : ({ ...result, pendingChoice: pending } as Match);
  }

  return surfaceDeferredCharacterChoice(result);
}

'''
assert anchor in text
text = text.replace(anchor, insert + anchor, 1)

old = '''  const structured = { ...next, ...applyQuickDuelStructuredTransition(previous, next, lookup) } as Match;
  return publishCharacterCombatTransition(previous, structured, lookup);'''
new = '''  const structured = { ...next, ...applyQuickDuelStructuredTransition(previous, next, lookup) } as Match;
  const incomingAttack = publishCharacterIncomingAttackTransition(previous, structured);
  return publishCharacterCombatTransition(previous, incomingAttack, lookup);'''
assert old in text
text = text.replace(old, new, 1)

old = '''  const value = choice.selectionField === "optionalAccepted"
    ? selection === "accept"
    : selection;
  return publishQuickDuelPlaytestCharacterEvent(match, actor, {
    ...event,
    [choice.selectionField]: value,
  });'''
new = '''  const value = choice.selectionField === "optionalAccepted"
    ? selection === "accept"
    : selection;
  const resolved = publishQuickDuelPlaytestCharacterEvent(match, actor, {
    ...event,
    [choice.selectionField]: value,
  });
  if (event.type !== "incomingAttackDeclared" || !resolved.event) return resolved;
  return {
    ...resolved,
    match: projectIncomingAttackCharacterEvent(resolved.match as Match & QuickDuelPlaytestStateMatch<Board>, resolved.event),
  };'''
assert old in text
text = text.replace(old, new, 1)
host.write_text(text)

playtest = Path('app/playtest.tsx')
text = playtest.read_text()
old = '''type PendingStrike = {
  cardId: string;
  zone: string;
  attackPower: number;
  damageModifier: number;'''
new = '''type PendingStrike = {
  cardId: string;
  zone: string;
  attackPower: number;
  modifierBonus?: number;
  damageModifier: number;'''
assert old in text
text = text.replace(old, new, 1)

old = '''  const attackPower = Math.max(0, cardPower(card) + fighterStat(activeEquipment.board, "ATK") + activeEquipment.board.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + activeEquipment.power);
  const consumedAttackBoard = stage3cConsumeAttackStatuses(activeEquipment.board, card, zone);'''
new = '''  const attackPower = Math.max(0, cardPower(card) + fighterStat(activeEquipment.board, "ATK") + activeEquipment.board.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + activeEquipment.power);
  const modifierBonus = Math.max(0, attackPower - Math.max(0, cardPower(card) + fighterStat(activeEquipment.board, "ATK")));
  const consumedAttackBoard = stage3cConsumeAttackStatuses(activeEquipment.board, card, zone);'''
assert old in text
text = text.replace(old, new, 1)

old = '''pendingStrike: { cardId, zone, attackPower, damageModifier: locationModifier.damage + fighterModifier.damage, piercing: piercingModifier.value,'''
new = '''pendingStrike: { cardId, zone, attackPower, modifierBonus, damageModifier: locationModifier.damage + fighterModifier.damage, piercing: piercingModifier.value,'''
assert old in text
text = text.replace(old, new, 1)
playtest.write_text(text)

Path('tests/quick-duel-character-incoming-attack-host.test.mjs').write_text(r'''import assert from "node:assert/strict";
import test from "node:test";

import {
  applyQuickDuelPlaytestTransition,
  resolveQuickDuelPlaytestCharacterChoice,
} from "../app/quick-duel-playtest-host.ts";

function board(overrides = {}) {
  return {
    fighterId: "DDB-CHR-CORE-001",
    belt: 3,
    hp: 10,
    maxHp: 10,
    xp: 0,
    focus: 0,
    tempSpeed: 0,
    nextAttackBonus: 0,
    nextDefenseCardBonus: 0,
    nextAttackHasFlow: false,
    nextAttackAnyZone: false,
    attacksThisTurn: 0,
    zonesPlayed: [],
    cardsThisTurn: [],
    equipment: [],
    exhaustedEquipment: [],
    hand: ["h1"],
    deck: ["d1"],
    discard: [],
    destroyed: [],
    learnedCombos: [],
    triggeredCombos: [],
    cardsBought: 0,
    usedConsumableThisRound: false,
    wasHitSinceLastTurn: false,
    damageReductionUsed: false,
    reversalAttackBonus: 0,
    borrowedEquipmentId: null,
    abilityUsedRound: false,
    usedCharacterEffectIdsThisTurn: [],
    usedCharacterEffectIdsThisRound: [],
    usedCharacterEffectIdsThisGame: [],
    characterMarks: {},
    stage3cStatuses: [],
    stage3cChoices: [],
    stage3cRestrictions: [],
    damageDealt: 0,
    damageTaken: 0,
    completedBeltExamThisRound: false,
    ...overrides,
  };
}

function match(player = board(), ai = board(), overrides = {}) {
  return {
    schema: 8,
    player,
    ai,
    market: [],
    round: 1,
    phase: "ai-ready",
    turnOrder: ["player", "ai"],
    turnIndex: 1,
    lastExchange: null,
    pendingStrike: null,
    pendingChoice: null,
    winner: null,
    log: [],
    ...overrides,
  };
}

const noCards = () => null;

function declaredStrike(previous, attackPower = 7, modifierBonus = 3) {
  return {
    ...previous,
    phase: "defense-window",
    pendingStrike: {
      cardId: "attack-1",
      zone: "High",
      attackPower,
      modifierBonus,
      damageModifier: 0,
      modifierNotes: [],
      remainingAiAttacks: [],
    },
  };
}

test("Blurred Monk receives the live incomingAttackDeclared choice and projects the accepted reduction into pendingStrike", () => {
  const previous = match(board({ fighterId: "DDB-CHR-CORE-003", tempSpeed: 0 }));
  const hosted = applyQuickDuelPlaytestTransition(previous, declaredStrike(previous), noCards);

  assert.equal(hosted.pendingChoice?.kind, "character-runtime");
  assert.equal(hosted.pendingChoice?.event?.type, "incomingAttackDeclared");
  assert.equal(hosted.pendingChoice?.choice?.resolver, "character.incomingAttackSlowChoice");
  assert.equal(hosted.pendingStrike.attackPower, 7);

  const resolved = resolveQuickDuelPlaytestCharacterChoice(
    { ...hosted, pendingChoice: null },
    "player",
    hosted.pendingChoice.event,
    hosted.pendingChoice.choice,
    "accept",
  );

  assert.equal(resolved.match.pendingStrike.attackPower, 6);
  assert.equal(resolved.match.player.tempSpeed, -1);
  assert.equal(resolved.match.player.characterMarks["round:reducedIncomingAttack"], true);
});

test("Gramma Uppercut ignores the actual positive modifier bonus rather than the whole strike", () => {
  const previous = match(board({ fighterId: "DDB-CHR-CORE-014" }));
  const hosted = applyQuickDuelPlaytestTransition(previous, declaredStrike(previous, 8, 3), noCards);
  assert.equal(hosted.pendingChoice?.choice?.resolver, "character.ignoreTemporaryAttackBonusesOnceGame");

  const resolved = resolveQuickDuelPlaytestCharacterChoice(
    { ...hosted, pendingChoice: null },
    "player",
    hosted.pendingChoice.event,
    hosted.pendingChoice.choice,
    "accept",
  );
  assert.equal(resolved.match.pendingStrike.attackPower, 5);
  assert.equal(resolved.match.pendingStrike.modifierBonus, 3);
});

test("The Nerfhammer auto-reduces a strike with at least +2 modifier bonus", () => {
  const previous = match(board({ fighterId: "DDB-CHR-CORE-035" }));
  const hosted = applyQuickDuelPlaytestTransition(previous, declaredStrike(previous, 7, 2), noCards);
  assert.equal(hosted.pendingChoice, null);
  assert.equal(hosted.pendingStrike.attackPower, 6);
  assert.equal(hosted.player.characterMarks["round:nerfhammerReduced"], true);
});

test("an already-open pending strike does not republish incomingAttackDeclared on unrelated transitions", () => {
  const previous = declaredStrike(match(board({ fighterId: "DDB-CHR-CORE-035" })), 7, 2);
  const next = { ...previous, log: ["unrelated update"] };
  const hosted = applyQuickDuelPlaytestTransition(previous, next, noCards);
  assert.equal(hosted.pendingStrike.attackPower, 7);
  assert.equal(hosted.player.characterMarks["round:nerfhammerReduced"], undefined);
});
''')
