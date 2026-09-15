from pathlib import Path

# Host: add canonical subscription-aware Combo reveal publication and exact deck projection.
path = Path('app/quick-duel-playtest-host.ts')
text = path.read_text()
anchor = 'import { runtimeCardFor } from "./runtime-card-catalog.ts";\n'
insert = 'import { characterHostSubscriptions } from "./character-playtest-bridge.ts";\n'
assert anchor in text and insert not in text
text = text.replace(anchor, anchor + insert, 1)

anchor = '''/**\n * Publishes a lifecycle event through the generic structured-status/Combo host\n'''
insert = '''export type QuickDuelPlaytestComboRevealResult<Match> = QuickDuelPlaytestCharacterEventResult<Match> & {\n  comboOfferId: string | null;\n  comboDeck: string[];\n};\n\nfunction characterSubscribesToEvent(board: CharacterRuntimeBoard, event: CharacterRuntimeEvent["type"]) {\n  return characterHostSubscriptions().some((entry) => entry.cardId === board.fighterId && entry.events.includes(event));\n}\n\nexport function commitQuickDuelPlaytestComboRevealSelection(\n  comboOfferId: string | null,\n  comboDeck: string[],\n  event: CharacterRuntimeEvent | null,\n) {\n  if (!comboOfferId || event?.type !== "comboReveal" || !event.selectedId) return { comboOfferId, comboDeck };\n  const revealIds = event.revealIds ?? [];\n  if (revealIds.length !== 2 || !revealIds.includes(comboOfferId) || !revealIds.includes(event.selectedId)) return { comboOfferId, comboDeck };\n  const extraId = revealIds.find((id) => id !== comboOfferId) ?? null;\n  if (!extraId || comboDeck[0] !== extraId) return { comboOfferId, comboDeck };\n  const unselectedId = event.selectedId === comboOfferId ? extraId : comboOfferId;\n  return {\n    comboOfferId: event.selectedId,\n    comboDeck: [...comboDeck.slice(1), unselectedId],\n  };\n}\n\nexport function publishQuickDuelPlaytestComboReveal<\n  Board extends QuickDuelComboMatchBoard & CharacterRuntimeBoard,\n  Match extends QuickDuelPlaytestHostMatch<Board>,\n>(\n  match: Match,\n  actor: QuickDuelPlaytestActor,\n  comboOfferId: string | null,\n  comboDeck: string[],\n): QuickDuelPlaytestComboRevealResult<Match> {\n  const board = actor === "player" ? match.player : match.ai;\n  const extraId = comboDeck[0] ?? null;\n  if (!comboOfferId || !extraId || !characterSubscribesToEvent(board, "comboReveal")) {\n    return {\n      match, published: false, conflict: false,\n      reason: !comboOfferId ? "No face-up Combo is available." : !extraId ? "No additional Combo is available to reveal." : "Character has no comboReveal subscription.",\n      event: null, choices: [], notes: [], comboOfferId, comboDeck,\n    };\n  }\n\n  let character = publishQuickDuelPlaytestCharacterEvent(match, actor, {\n    type: "comboReveal",\n    revealIds: [comboOfferId, extraId],\n  });\n\n  if (actor === "ai") {\n    for (let guard = 0; guard < 8 && character.event && character.choices.length > 0; guard += 1) {\n      const choice = character.choices[0];\n      const selection = chooseAiCharacterOption(choice);\n      if (selection === null) break;\n      character = resolveQuickDuelPlaytestCharacterChoice(character.match, actor, character.event, choice, selection);\n    }\n  }\n\n  const projected = commitQuickDuelPlaytestComboRevealSelection(comboOfferId, comboDeck, character.event);\n  return { ...character, ...projected };\n}\n\n'''
assert anchor in text and 'publishQuickDuelPlaytestComboReveal<' not in text
text = text.replace(anchor, insert + anchor, 1)
path.write_text(text)

# Playtest: publish the real Ascend reveal and project the selected Combo after the generic Character choice resolves.
path = Path('app/playtest.tsx')
text = path.read_text()
old = 'import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestLifecycleEvent, resolveQuickDuelPlaytestCharacterChoice } from "./quick-duel-playtest-host";'
new = 'import { applyQuickDuelPlaytestTransition, commitQuickDuelPlaytestComboRevealSelection, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestComboReveal, publishQuickDuelPlaytestLifecycleEvent, resolveQuickDuelPlaytestCharacterChoice } from "./quick-duel-playtest-host";'
assert old in text
text = text.replace(old, new, 1)

old = '''  const enterAscend = () => {\n    setDeskView("market");\n    setMatch((current) => current?.phase === "player-yell" && !current.pendingDiscard && !current.pendingChoice ? write(current, "Ascend: the acquisition desk opens. Spend this turn's Focus before it leaves your mat.", { phase: "player-ascend", selectedAttackId: null, player: { ...current.player, boughtCardThisAscend: false } }) : current);\n  };'''
new = '''  const enterAscend = () => {\n    setDeskView("market");\n    setMatch((current) => {\n      if (!current || current.phase !== "player-yell" || current.pendingDiscard || current.pendingChoice) return current;\n      const ascended = write(current, "Ascend: the acquisition desk opens. Spend this turn's Focus before it leaves your mat.", { phase: "player-ascend", selectedAttackId: null, player: { ...current.player, boughtCardThisAscend: false } });\n      const reveal = publishQuickDuelPlaytestComboReveal(ascended, "player", ascended.comboOfferId, ascended.comboDeck);\n      const choice = reveal.choices[0];\n      return {\n        ...reveal.match,\n        comboOfferId: reveal.comboOfferId,\n        comboDeck: reveal.comboDeck,\n        pendingChoice: reveal.event && choice ? { kind: "character-runtime", event: reveal.event, choice } : reveal.match.pendingChoice,\n      };\n    });\n  };'''
assert old in text
text = text.replace(old, new, 1)

old = '''    const resolved = resolveQuickDuelPlaytestCharacterChoice(base, "player", pending.event, pending.choice, selection);\n    const nextChoice = resolved.choices[0];\n    const pendingChoice: PendingChoice | null = resolved.event && nextChoice\n      ? { kind: "character-runtime", event: resolved.event, choice: nextChoice }\n      : null;\n    const selectedCard = cardFor(selection);\n    const label = selectedCard?.name ?? (["skip", "decline", "cancel"].includes(selection) ? "declined" : selection);\n    return write(resolved.match, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} resolves ${pending.choice.prompt}: ${label}.`, { pendingChoice });'''
new = '''    const resolved = resolveQuickDuelPlaytestCharacterChoice(base, "player", pending.event, pending.choice, selection);\n    let resolvedMatch = resolved.match;\n    if (pending.event.type === "comboReveal" && resolved.event) {\n      const projected = commitQuickDuelPlaytestComboRevealSelection(resolvedMatch.comboOfferId, resolvedMatch.comboDeck, resolved.event);\n      resolvedMatch = { ...resolvedMatch, ...projected };\n    }\n    const nextChoice = resolved.choices[0];\n    const pendingChoice: PendingChoice | null = resolved.event && nextChoice\n      ? { kind: "character-runtime", event: resolved.event, choice: nextChoice }\n      : null;\n    const selectedCard = cardFor(selection);\n    const label = selectedCard?.name ?? (["skip", "decline", "cancel"].includes(selection) ? "declined" : selection);\n    return write(resolvedMatch, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} resolves ${pending.choice.prompt}: ${label}.`, { pendingChoice });'''
assert old in text
text = text.replace(old, new, 1)
path.write_text(text)

# Deterministic host + live-wiring certification.
Path('tests/quick-duel-character-combo-reveal-host.test.mjs').write_text(r'''import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  commitQuickDuelPlaytestComboRevealSelection,
  publishQuickDuelPlaytestComboReveal,
  resolveQuickDuelPlaytestCharacterChoice,
} from "../app/quick-duel-playtest-host.ts";

function board(overrides = {}) {
  return { fighterId:"DDB-CHR-CORE-001", belt:3, hp:10, maxHp:10, xp:0, focus:0, tempSpeed:0,
    nextAttackBonus:0, nextDefenseCardBonus:0, nextAttackHasFlow:false, nextAttackAnyZone:false,
    attacksThisTurn:0, zonesPlayed:[], cardsThisTurn:[], equipment:[], exhaustedEquipment:[],
    hand:[], deck:[], discard:[], destroyed:[], learnedCombos:[], triggeredCombos:[],
    cardsBought:0, usedConsumableThisRound:false, wasHitSinceLastTurn:false, damageReductionUsed:false,
    reversalAttackBonus:0, borrowedEquipmentId:null, abilityUsedRound:false,
    usedCharacterEffectIdsThisTurn:[], usedCharacterEffectIdsThisRound:[], usedCharacterEffectIdsThisGame:[],
    characterMarks:{}, stage3cStatuses:[], stage3cChoices:[], stage3cRestrictions:[], damageDealt:0,
    damageTaken:0, completedBeltExamThisRound:false, ...overrides };
}
function match(player=board(), ai=board(), overrides={}) {
  return { schema:8, player, ai, market:[], round:1, phase:"player-ascend", turnOrder:["player","ai"],
    turnIndex:0, lastExchange:null, locationId:"loc-a", pendingChoice:null, winner:null, log:[], ...overrides };
}

test("Librarian Lin reveals exactly the face-up Combo plus the next deck Combo and waits for the human choice", () => {
  const current = match(board({ fighterId:"DDB-CHR-CORE-021" }));
  const hosted = publishQuickDuelPlaytestComboReveal(current, "player", "combo-a", ["combo-b","combo-c"]);
  assert.equal(hosted.published, true);
  assert.equal(hosted.event?.type, "comboReveal");
  assert.deepEqual(hosted.event?.revealIds, ["combo-a","combo-b"]);
  assert.deepEqual(hosted.choices[0]?.options, ["combo-a","combo-b"]);
  assert.equal(hosted.comboOfferId, "combo-a");
  assert.deepEqual(hosted.comboDeck, ["combo-b","combo-c"]);
});

test("the selected revealed Combo becomes the offer and the other goes face down to the bottom", () => {
  const current = match(board({ fighterId:"DDB-CHR-CORE-021" }));
  const hosted = publishQuickDuelPlaytestComboReveal(current, "player", "combo-a", ["combo-b","combo-c"]);
  const choice = hosted.choices[0];
  assert.ok(hosted.event && choice);
  const resolved = resolveQuickDuelPlaytestCharacterChoice(hosted.match, "player", hosted.event, choice, "combo-b");
  assert.equal(resolved.event?.selectedId, "combo-b");
  const projected = commitQuickDuelPlaytestComboRevealSelection("combo-a", ["combo-b","combo-c"], resolved.event);
  assert.equal(projected.comboOfferId, "combo-b");
  assert.deepEqual(projected.comboDeck, ["combo-c","combo-a"]);
  assert.ok(resolved.match.player.usedCharacterEffectIdsThisRound?.includes("character-librarian-combo-choice"));
});

test("AI resolves the same canonical reveal contract deterministically without exposing a hidden extra choice", () => {
  const current = match(board(), board({ fighterId:"DDB-CHR-CORE-021" }));
  const hosted = publishQuickDuelPlaytestComboReveal(current, "ai", "combo-a", ["combo-b","combo-c"]);
  assert.equal(hosted.choices.length, 0);
  assert.equal(hosted.comboOfferId, "combo-a");
  assert.deepEqual(hosted.comboDeck, ["combo-c","combo-b"]);
  assert.ok(hosted.match.ai.usedCharacterEffectIdsThisRound?.includes("character-librarian-combo-choice"));
});

test("fighters without comboReveal subscription do not inspect or mutate the hidden Combo deck", () => {
  const current = match(board({ fighterId:"DDB-CHR-CORE-001" }));
  const hosted = publishQuickDuelPlaytestComboReveal(current, "player", "combo-a", ["combo-b","combo-c"]);
  assert.equal(hosted.published, false);
  assert.equal(hosted.event, null);
  assert.deepEqual(hosted.comboDeck, ["combo-b","combo-c"]);
});

test("projection refuses stale or fabricated reveal facts", () => {
  assert.deepEqual(
    commitQuickDuelPlaytestComboRevealSelection("combo-a", ["combo-b","combo-c"], { type:"comboReveal", revealIds:["combo-a","combo-x"], selectedId:"combo-x" }),
    { comboOfferId:"combo-a", comboDeck:["combo-b","combo-c"] },
  );
});

test("Quick Duel publishes comboReveal only on the real Ascend reveal seam and resolves through generic Character choice", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /publishQuickDuelPlaytestComboReveal\(ascended, "player", ascended\.comboOfferId, ascended\.comboDeck\)/);
  assert.match(source, /pending\.event\.type === "comboReveal"/);
  assert.match(source, /commitQuickDuelPlaytestComboRevealSelection\(resolvedMatch\.comboOfferId, resolvedMatch\.comboDeck, resolved\.event\)/);
  assert.doesNotMatch(source, /fighterId\s*===\s*["']DDB-CHR-CORE-021["']/);
  assert.doesNotMatch(source, /Librarian Lin/);
});
''')
