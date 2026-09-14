from pathlib import Path

# Canonical structured effect: the printed Rebooter action gains +2 Focus.
path = Path('content/card-effects/characters.json')
text = path.read_text()
old = '"id":"character-rebooter-choice","effect":"core.choice","trigger":"passive","target":"chosen-equipment","resolver":"character.exhaustReadyEquipmentLock"'
new = '"id":"character-rebooter-choice","effect":"core.choice","trigger":"passive","target":"chosen-equipment","amount":2,"resolver":"character.exhaustReadyEquipmentLock"'
assert old in text
path.write_text(text.replace(old, new, 1))

# Runtime: availability/readiness helpers plus the complete canonical effect.
path = Path('app/character-runtime.ts')
text = path.read_text()
anchor = '''export function characterCanEquip(board: CharacterRuntimeBoard, card: CharacterRuntimeCard) {'''
insert = '''export function characterRuntimeEventAvailable(board: CharacterRuntimeBoard, event: CharacterRuntimeEventType) {
  return effectsFor(board.fighterId).some((effect) => isAvailable(board, effect, event));
}

export function characterCanReadyEquipment(board: CharacterRuntimeBoard, equipmentId: string) {
  return !hasMark(board, `turn:rebootLocked:${equipmentId}`);
}

'''
assert anchor in text
text = text.replace(anchor, insert + anchor, 1)
old = '''      case "character.exhaustReadyEquipmentLock": {
        const options = event.candidateIds ?? self.equipment; const selected = event.selectedId ?? (actor === "ai" ? options[0] : null);
        if (options.length && !selected) choices.push(makeChoice(effect, "Choose Equipment to exhaust then immediately ready.", options, false));
        else if (selected && self.equipment.includes(selected)) { self = mark(self, `turn:rebootLocked:${selected}`); activated = true; }
        break;
      }'''
new = '''      case "character.exhaustReadyEquipmentLock": {
        const exhausted = new Set(self.exhaustedEquipment ?? []);
        const options = (event.candidateIds ?? self.equipment).filter((id) => self.equipment.includes(id) && !exhausted.has(id));
        const selected = event.selectedId ?? (actor === "ai" ? options[0] : null);
        if (options.length && !selected) {
          choices.push(makeChoice(effect, "Choose a ready Equipment to exhaust for this Character ability.", options, false));
        } else if (selected && options.includes(selected)) {
          self = mark({
            ...self,
            focus: self.focus + Math.max(0, amount),
            exhaustedEquipment: [...new Set([...(self.exhaustedEquipment ?? []), selected])],
          }, `turn:rebootLocked:${selected}`);
          activated = true;
        }
        break;
      }'''
assert old in text
path.write_text(text.replace(old, new, 1))

# Generic playtest Character action host: humans surface choices; AI resolves them.
path = Path('app/quick-duel-playtest-host.ts')
text = path.read_text()
anchor = '''export function publishQuickDuelPlaytestLifecycleEvent<'''
insert = '''export function publishQuickDuelPlaytestCharacterAction<
  Board extends QuickDuelComboMatchBoard & CharacterRuntimeBoard,
  Match extends QuickDuelPlaytestHostMatch<Board>,
>(
  match: Match,
  actor: QuickDuelPlaytestActor,
  event: CharacterRuntimeEvent,
): QuickDuelPlaytestCharacterEventResult<Match> {
  let character = publishQuickDuelPlaytestCharacterEvent(match, actor, event);
  if (actor === "ai") {
    for (let guard = 0; guard < 8 && character.event && character.choices.length > 0; guard += 1) {
      const choice = character.choices[0];
      const selection = chooseAiCharacterOption(choice);
      if (selection === null) break;
      character = resolveQuickDuelPlaytestCharacterChoice(
        character.match,
        actor,
        character.event,
        choice,
        selection,
      );
    }
  }
  return character;
}

'''
assert anchor in text
path.write_text(text.replace(anchor, insert + anchor, 1))

# Quick Duel: generic active Character action for player and AI, and lock-aware readying.
path = Path('app/playtest.tsx')
text = path.read_text()
old = 'import { characterAllowedAttackZones, characterAttackModifier, characterCanEquip, characterDamageReduction, type CharacterRuntimeChoice, type CharacterRuntimeEvent } from "./character-runtime";'
new = 'import { characterAllowedAttackZones, characterAttackModifier, characterCanEquip, characterCanReadyEquipment, characterDamageReduction, characterRuntimeEventAvailable, type CharacterRuntimeChoice, type CharacterRuntimeEvent } from "./character-runtime";'
assert old in text
text = text.replace(old, new, 1)
old = 'import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestLifecycleEvent, resolveQuickDuelPlaytestCharacterChoice } from "./quick-duel-playtest-host";'
new = 'import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestCharacterAction, publishQuickDuelPlaytestLifecycleEvent, resolveQuickDuelPlaytestCharacterChoice } from "./quick-duel-playtest-host";'
assert old in text
text = text.replace(old, new, 1)
old = '''function readyEquipment(board: Board, id: string) {
  return { ...board, exhaustedEquipment: (board.exhaustedEquipment ?? []).filter((candidate) => candidate !== id) };
}'''
new = '''function readyEquipment(board: Board, id: string) {
  if (!characterCanReadyEquipment(board, id)) return board;
  return { ...board, exhaustedEquipment: (board.exhaustedEquipment ?? []).filter((candidate) => candidate !== id) };
}'''
assert old in text
text = text.replace(old, new, 1)
old = '''  const turnEquipment = autoActivateAiTurnEquipment(initiatedAi);
  const aiStart = turnEquipment.board;
  const practiceId = aiStart.defensePracticeUsed ? undefined : aiStart.hand'''
new = '''  const turnEquipment = autoActivateAiTurnEquipment(initiatedAi);
  let aiStart = turnEquipment.board;
  const rebootCandidates = aiStart.equipment.filter((id) => !(aiStart.exhaustedEquipment ?? []).includes(id));
  if (rebootCandidates.length && characterRuntimeEventAvailable(aiStart, "reboot")) {
    const rebooted = publishQuickDuelPlaytestCharacterAction(
      { ...current, ai: aiStart },
      "ai",
      { type: "reboot", candidateIds: rebootCandidates },
    );
    current = rebooted.match;
    aiStart = current.ai;
  }
  const practiceId = aiStart.defensePracticeUsed ? undefined : aiStart.hand'''
assert old in text
text = text.replace(old, new, 1)
old = '''  const beginYell = () => setMatch((current) => current?.phase === "player-initiate" && !current.pendingChoice ? write(current, "Initiate complete. Yell begins; subtlety has left the building.", { phase: "player-yell", player: { ...current.player, usedEffectIdsThisTurn: [] } }) : current);


  const activateEquipment = (id: string) => {'''
new = '''  const beginYell = () => setMatch((current) => current?.phase === "player-initiate" && !current.pendingChoice ? write(current, "Initiate complete. Yell begins; subtlety has left the building.", { phase: "player-yell", player: { ...current.player, usedEffectIdsThisTurn: [] } }) : current);

  const activateCharacterAbility = () => setMatch((current) => {
    if (!current || current.winner || current.pendingChoice || !["player-initiate", "player-yell", "player-ascend"].includes(current.phase)) return current;
    const candidateIds = current.player.equipment.filter((id) => !(current.player.exhaustedEquipment ?? []).includes(id));
    if (!candidateIds.length || !characterRuntimeEventAvailable(current.player, "reboot")) return current;
    const character = publishQuickDuelPlaytestCharacterAction(current, "player", { type: "reboot", candidateIds });
    const choice = character.choices[0];
    const pendingChoice: PendingChoice | null = character.event && choice
      ? { kind: "character-runtime", event: character.event, choice }
      : null;
    return write(character.match, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} activates a Character ability.`, { pendingChoice });
  });


  const activateEquipment = (id: string) => {'''
assert old in text
text = text.replace(old, new, 1)
old = '''  const phaseActionDock = !match.winner && <nav className={`playtest-action-dock dock-${match.phase}`} aria-label="Next legal action">'''
new = '''  const characterActionReadyEquipment = player.equipment.filter((id) => !(player.exhaustedEquipment ?? []).includes(id));
  const canActivateCharacterAbility = !match.pendingChoice
    && ["player-initiate", "player-yell", "player-ascend"].includes(match.phase)
    && characterActionReadyEquipment.length > 0
    && characterRuntimeEventAvailable(player, "reboot");
  const phaseActionDock = !match.winner && <nav className={`playtest-action-dock dock-${match.phase}`} aria-label="Next legal action">'''
assert old in text
text = text.replace(old, new, 1)
old = '''    </div>
    {match.phase === "player-initiate" && <button onClick={beginYell}>Proceed to Yell →</button>}'''
new = '''    </div>
    {canActivateCharacterAbility && <button className="dock-secondary" onClick={activateCharacterAbility}>Use Character Ability</button>}
    {match.phase === "player-initiate" && <button onClick={beginYell}>Proceed to Yell →</button>}'''
assert old in text
text = text.replace(old, new, 1)
path.write_text(text)

Path('tests/quick-duel-character-reboot-host.test.mjs').write_text(r'''import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  applyCharacterRuntimeEvent,
  characterCanReadyEquipment,
  characterRuntimeEventAvailable,
  resetCharacterTurn,
} from "../app/character-runtime.ts";
import { publishQuickDuelPlaytestCharacterAction } from "../app/quick-duel-playtest-host.ts";

function board(overrides = {}) {
  return {
    fighterId: "DDB-CHR-CORE-036", belt: 0, hp: 10, maxHp: 10, xp: 0, focus: 0, tempSpeed: 0,
    nextAttackBonus: 0, nextDefenseCardBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false,
    attacksThisTurn: 0, zonesPlayed: [], cardsThisTurn: [], equipment: ["eq-1", "eq-2"], exhaustedEquipment: [],
    hand: [], deck: ["draw-1"], discard: [], destroyed: [], usedConsumableThisRound: false,
    wasHitSinceLastTurn: false, damageReductionUsed: false, reversalAttackBonus: 0, borrowedEquipmentId: null,
    abilityUsedRound: false, usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [],
    usedCharacterEffectIdsThisGame: [], characterMarks: {}, ...overrides,
  };
}

function match(ai = board()) {
  return { player: board({ fighterId: "DDB-CHR-CORE-001", equipment: [] }), ai, market: [], round: 1, phase: "ai-ready", turnOrder: ["player", "ai"], turnIndex: 1, lastExchange: null };
}

test("Rebooter canonical runtime exhausts the chosen ready Equipment, locks readying, and gains 2 Focus", () => {
  const self = board();
  assert.equal(characterRuntimeEventAvailable(self, "reboot"), true);
  const result = applyCharacterRuntimeEvent(self, board({ fighterId: "DDB-CHR-CORE-001", equipment: [] }), {
    type: "reboot", candidateIds: ["eq-1", "eq-2"], selectedId: "eq-1",
  });
  assert.equal(result.self.focus, 2);
  assert.deepEqual(result.self.exhaustedEquipment, ["eq-1"]);
  assert.equal(result.self.characterMarks["turn:rebootLocked:eq-1"], true);
  assert.equal(characterCanReadyEquipment(result.self, "eq-1"), false);
  assert.equal(characterRuntimeEventAvailable(result.self, "reboot"), false, "once-per-round usage must be consumed");

  const nextTurn = resetCharacterTurn(result.self);
  assert.equal(characterCanReadyEquipment(nextTurn, "eq-1"), true, "ready lock ends with the turn");
  assert.equal(characterRuntimeEventAvailable(nextTurn, "reboot"), false, "round usage survives a turn reset");
});

test("human Rebooter action requests an actual ready Equipment choice before applying", () => {
  const self = board({ exhaustedEquipment: ["eq-2"] });
  const result = applyCharacterRuntimeEvent(self, board({ fighterId: "DDB-CHR-CORE-001", equipment: [] }), {
    type: "reboot", candidateIds: ["eq-1"],
  }, "player");
  assert.equal(result.self.focus, 0);
  assert.equal(result.choices.length, 1);
  assert.deepEqual(result.choices[0].options, ["eq-1"]);
});

test("AI Rebooter resolves the same generic action without React input", () => {
  const result = publishQuickDuelPlaytestCharacterAction(match(), "ai", { type: "reboot", candidateIds: ["eq-1", "eq-2"] });
  assert.equal(result.choices.length, 0);
  assert.equal(result.match.ai.focus, 2);
  assert.deepEqual(result.match.ai.exhaustedEquipment, ["eq-1"]);
  assert.equal(result.match.ai.characterMarks["turn:rebootLocked:eq-1"], true);
});

test("Green-belt Rebooter chains its linked cycle after the Equipment selection", () => {
  const self = board({ belt: 3, hand: ["keep"], deck: ["draw-1"] });
  const result = applyCharacterRuntimeEvent(self, board({ fighterId: "DDB-CHR-CORE-001", equipment: [] }), {
    type: "reboot", candidateIds: ["eq-1"], selectedId: "eq-1",
  }, "player");
  assert.equal(result.self.focus, 2);
  assert.equal(result.choices.length, 1);
  assert.equal(result.self.hand.includes("draw-1"), true);
});

test("Quick Duel exposes reboot as a generic player action and AI turn action without Character identity dispatch", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /publishQuickDuelPlaytestCharacterAction\(current, "player", \{ type: "reboot", candidateIds \}\)/);
  assert.match(source, /publishQuickDuelPlaytestCharacterAction\([\s\S]*?"ai",[\s\S]*?\{ type: "reboot", candidateIds: rebootCandidates \}/);
  assert.doesNotMatch(source, /DDB-CHR-CORE-036|The Rebooter/);
});
''')
