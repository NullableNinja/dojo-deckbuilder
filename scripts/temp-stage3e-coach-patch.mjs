import fs from "node:fs";

const assertReplace = (path, before, after, label) => {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(before)) throw new Error(`${label}: expected source block not found in ${path}`);
  fs.writeFileSync(path, source.replace(before, after));
};

const helper = `export type CharacterModifiedCardType = "Attack" | "Defense";

export const CHARACTER_OPPONENT_CARD_MODIFICATION_QUEUE_MARK = "structuredHost.opponentCardModificationQueue";

type CharacterMarkedBoard = {
  characterMarks?: Record<string, unknown>;
};

type RuntimeCommandLike = {
  effect?: string;
  target?: string;
  duration?: string;
};

function normalizedCardKind(card: { cardType?: string; subtype?: string } | null | undefined) {
  const subtype = String(card?.subtype ?? "").trim().toLocaleLowerCase();
  const cardType = String(card?.cardType ?? "").trim().toLocaleLowerCase();
  if (subtype === "attack" || cardType === "attack") return "Attack" as const;
  if (subtype === "defense" || cardType === "defense") return "Defense" as const;
  return null;
}

export function characterSemanticCardType(card: { cardType?: string; subtype?: string } | null | undefined): CharacterModifiedCardType | null {
  return normalizedCardKind(card);
}

export function queueOpponentCardModification<Board extends CharacterMarkedBoard>(board: Board, type: CharacterModifiedCardType): Board {
  const marks = { ...(board.characterMarks ?? {}) };
  const current = Array.isArray(marks[CHARACTER_OPPONENT_CARD_MODIFICATION_QUEUE_MARK])
    ? (marks[CHARACTER_OPPONENT_CARD_MODIFICATION_QUEUE_MARK] as unknown[]).filter((value): value is CharacterModifiedCardType => value === "Attack" || value === "Defense")
    : [];
  marks[CHARACTER_OPPONENT_CARD_MODIFICATION_QUEUE_MARK] = current.includes(type) ? current : [...current, type];
  return { ...board, characterMarks: marks };
}

export function opponentCardModificationQueue(board: CharacterMarkedBoard): CharacterModifiedCardType[] {
  const value = board.characterMarks?.[CHARACTER_OPPONENT_CARD_MODIFICATION_QUEUE_MARK];
  return Array.isArray(value)
    ? value.filter((entry): entry is CharacterModifiedCardType => entry === "Attack" || entry === "Defense")
    : [];
}

export function clearOpponentCardModificationQueue<Board extends CharacterMarkedBoard>(board: Board): Board {
  if (!board.characterMarks?.[CHARACTER_OPPONENT_CARD_MODIFICATION_QUEUE_MARK]) return board;
  const marks = { ...(board.characterMarks ?? {}) };
  delete marks[CHARACTER_OPPONENT_CARD_MODIFICATION_QUEUE_MARK];
  return { ...board, characterMarks: marks };
}

export function runtimeCommandCardModificationTypes(commands: readonly RuntimeCommandLike[]): CharacterModifiedCardType[] {
  const result = new Set<CharacterModifiedCardType>();
  for (const command of commands) {
    if (command.target !== "opponent") continue;
    if (command.effect === "combat.modifyAttackPower" && command.duration === "nextAttack") result.add("Attack");
    if (command.effect === "combat.modifyGuard" && command.duration === "nextDefense") result.add("Defense");
  }
  return [...result];
}
`;
fs.writeFileSync("app/character-card-modification-facts.ts", helper);

assertReplace(
  "app/character-runtime.ts",
  `} from "./character-effect-resolvers.ts";\n`,
  `} from "./character-effect-resolvers.ts";\nimport { characterSemanticCardType, queueOpponentCardModification, type CharacterModifiedCardType } from "./character-card-modification-facts.ts";\n`,
  "character fact import",
);
assertReplace(
  "app/character-runtime.ts",
  `  | "roundStart" | "turnStart" | "initiate" | "cardPlayed" | "discarded" | "speedChanged"\n`,
  `  | "roundStart" | "turnStart" | "initiate" | "cardPlayed" | "cardModified" | "discarded" | "speedChanged"\n`,
  "cardModified event type",
);
assertReplace(
  "app/character-runtime.ts",
  `  opponentModifiedCard?: boolean;\n`,
  `  opponentModifiedCard?: boolean;\n  modifiedCardType?: CharacterModifiedCardType;\n`,
  "modifiedCardType fact",
);
assertReplace(
  "app/character-runtime.ts",
  `  "character.opponentModificationCycle": ["cardPlayed"],\n  "character.green.repeatModifiedCardTypeBonus": ["cardPlayed"],\n`,
  `  "character.opponentModificationCycle": ["cardModified"],\n  "character.green.repeatModifiedCardTypeBonus": ["cardModified"],\n`,
  "Coach event ownership",
);
assertReplace(
  "app/character-runtime.ts",
  `      case "character.opponentModificationCycle":\n        if (event.opponentModifiedCard) { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedId); self = cycled.resolved ? mark(cycled.board, "round:modifiedCardType", event.card?.cardType ?? "") : cycled.board; activated = cycled.resolved; }\n        break;\n      case "character.green.repeatModifiedCardTypeBonus":\n        if (markMap(self)["round:modifiedCardType"] === event.card?.cardType) {\n          if (event.card?.cardType === "Attack") self = { ...self, nextAttackBonus: self.nextAttackBonus + amount };\n          else if (event.card?.cardType === "Defense") self = { ...self, nextDefenseCardBonus: (self.nextDefenseCardBonus ?? 0) + amount };\n          activated = true;\n        }\n        break;\n`,
  `      case "character.opponentModificationCycle":\n        if (event.modifiedCardType) { const cycled = cycleWithPlayerChoice(self, effect, resolver, actor, choices, event.selectedId); self = cycled.resolved ? mark(cycled.board, "round:modifiedCardType", event.modifiedCardType) : cycled.board; activated = cycled.resolved; }\n        break;\n      case "character.green.repeatModifiedCardTypeBonus": {\n        const modifiedType = markMap(self)["round:modifiedCardType"];\n        if (modifiedType === event.modifiedCardType) {\n          if (modifiedType === "Attack") self = { ...self, nextAttackBonus: self.nextAttackBonus + amount };\n          else if (modifiedType === "Defense") self = { ...self, nextDefenseCardBonus: (self.nextDefenseCardBonus ?? 0) + amount };\n          self = clearMark(self, "round:modifiedCardType");\n          activated = true;\n        }\n        break;\n      }\n`,
  "Coach runtime semantics",
);
assertReplace(
  "app/character-runtime.ts",
  `      case "character.green.linkedAttackHitPenalty":\n        if (hasMark(self, "turn:consumableAttack")) { opponent = { ...opponent, nextAttackBonus: opponent.nextAttackBonus + amount }; activated = true; }\n        break;\n`,
  `      case "character.green.linkedAttackHitPenalty":\n        if (hasMark(self, "turn:consumableAttack")) { opponent = queueOpponentCardModification({ ...opponent, nextAttackBonus: opponent.nextAttackBonus + amount }, "Attack"); activated = true; }\n        break;\n`,
  "Character opponent Attack modification provenance",
);

const charactersPath = "content/card-effects/characters.json";
const characters = JSON.parse(fs.readFileSync(charactersPath, "utf8"));
const coach = characters.cards?.["DDB-CHR-CORE-005"];
if (!coach) throw new Error("Coach Karen canonical entry missing");
const green = coach.effects?.find((effect) => effect.resolver === "character.green.repeatModifiedCardTypeBonus");
if (!green) throw new Error("Coach Karen Green resolver missing");
green.amount = 1;
fs.writeFileSync(charactersPath, JSON.stringify(characters));

assertReplace(
  "app/quick-duel-character-event-routes.ts",
  `  { event: "cardPlayed", timing: "transition", hostFact: "cardsThisTurn gains a card", reason: "Completed card play can publish family/type facts after the card enters play history." },\n`,
  `  { event: "cardPlayed", timing: "transition", hostFact: "cardsThisTurn gains a card", reason: "Completed card play can publish family/type facts after the card enters play history." },\n  { event: "cardModified", timing: "transition", hostFact: "an opponent-targeted Attack/Defense card modifier is committed", reason: "Coach-style reactions observe proven opponent modification provenance without inferring from raw board deltas." },\n`,
  "cardModified route",
);

assertReplace(
  "app/quick-duel-playtest-host.ts",
  `import type { RuntimeCommand, RuntimeTrigger } from "./family-effect-runtime.ts";\n`,
  `import type { RuntimeCommand, RuntimeTrigger } from "./family-effect-runtime.ts";\nimport { clearOpponentCardModificationQueue, opponentCardModificationQueue, queueOpponentCardModification, runtimeCommandCardModificationTypes } from "./character-card-modification-facts.ts";\n`,
  "playtest host modification facts import",
);
assertReplace(
  "app/quick-duel-playtest-host.ts",
  `  const structured = { ...next, ...applyQuickDuelStructuredTransition(previous, next, lookup) } as Match;\n  return publishCharacterCombatTransition(previous, structured, lookup);\n`,
  `  const structured = { ...next, ...applyQuickDuelStructuredTransition(previous, next, lookup) } as Match;\n  const combat = publishCharacterCombatTransition(previous, structured, lookup);\n  return publishQueuedCharacterCardModifications(combat);\n`,
  "consume queued card modifications",
);
assertReplace(
  "app/quick-duel-playtest-host.ts",
  `export function applyQuickDuelPlaytestTransition<\n`,
  `function publishQueuedCharacterCardModifications<\n  Board extends QuickDuelComboMatchBoard & QuickDuelCharacterCombatBoard,\n  Match extends QuickDuelPlaytestStateMatch<Board>,\n>(match: Match): Match {\n  let result = match;\n  for (const actor of ["player", "ai"] as const) {\n    const queued = opponentCardModificationQueue(result[actor]);\n    if (!queued.length) continue;\n    result = { ...result, [actor]: clearOpponentCardModificationQueue(result[actor]) } as Match;\n    for (const modifiedCardType of queued) {\n      let character = publishQuickDuelPlaytestCharacterEvent(result, actor, {\n        type: "cardModified",\n        opponentModifiedCard: true,\n        modifiedCardType,\n      });\n      if (actor === "ai") {\n        for (let guard = 0; guard < 8 && character.event && character.choices.length > 0; guard += 1) {\n          const choice = character.choices[0];\n          const selection = chooseAiCharacterOption(choice);\n          if (selection === null) break;\n          character = resolveQuickDuelPlaytestCharacterChoice(character.match, actor, character.event, choice, selection);\n        }\n      }\n      result = character.match as Match;\n      if (actor === "player" && character.event && character.choices.length > 0) {\n        const pending: QuickDuelCharacterChoiceState = { kind: "character-runtime", event: character.event, choice: character.choices[0] };\n        result = result.pendingChoice\n          ? withDeferredCharacterChoice(result, pending)\n          : ({ ...result, pendingChoice: pending } as Match);\n        break;\n      }\n    }\n  }\n  return surfaceDeferredCharacterChoice(result);\n}\n\nexport function applyQuickDuelPlaytestTransition<\n`,
  "queued card modification publisher",
);
assertReplace(
  "app/quick-duel-playtest-host.ts",
  `  return {\n    match: withActorBoards(match, actor, hosted.boards),\n    commands: hosted.commands,\n`,
  `  let hostedBoards = hosted.boards;\n  for (const modifiedCardType of runtimeCommandCardModificationTypes(hosted.commands)) {\n    hostedBoards = { ...hostedBoards, opponent: queueOpponentCardModification(hostedBoards.opponent, modifiedCardType) };\n  }\n  return {\n    match: withActorBoards(match, actor, hostedBoards),\n    commands: hosted.commands,\n`,
  "canonical runtime command modification provenance",
);

assertReplace(
  "app/playtest.tsx",
  `import { characterAllowedAttackZones, characterAttackModifier, characterCanEquip, characterDamageReduction, type CharacterRuntimeChoice, type CharacterRuntimeEvent } from "./character-runtime";\n`,
  `import { characterAllowedAttackZones, characterAttackModifier, characterCanEquip, characterDamageReduction, type CharacterRuntimeChoice, type CharacterRuntimeEvent } from "./character-runtime";\nimport { queueOpponentCardModification, runtimeCommandCardModificationTypes } from "./character-card-modification-facts";\n`,
  "playtest modification facts import",
);
assertReplace(
  "app/playtest.tsx",
  `function applyStage3CTiming(board: Board, card: CardEntry, trigger: RuntimeTrigger, controller: "player" | "ai", context: DefenseRuntimeContext | ConsumableRuntimeContext = {}, target: "self" | "opponent" = "self") {\n  const commands = stage3cCommands(card, trigger, context).filter((command) => (command.target ?? "self") === target);\n  return applyStage3CCommands(board, commands.map((command) => ({ ...command, target: "self" })), controller);\n}\n`,
  `function applyStage3CTiming(board: Board, card: CardEntry, trigger: RuntimeTrigger, controller: "player" | "ai", context: DefenseRuntimeContext | ConsumableRuntimeContext = {}, target: "self" | "opponent" = "self") {\n  const commands = stage3cCommands(card, trigger, context).filter((command) => (command.target ?? "self") === target);\n  let next = applyStage3CCommands(board, commands.map((command) => ({ ...command, target: "self" })), controller);\n  if (target === "opponent") {\n    for (const modifiedCardType of runtimeCommandCardModificationTypes(commands)) next = queueOpponentCardModification(next, modifiedCardType);\n  }\n  return next;\n}\n`,
  "Stage 3C opponent card modification provenance",
);
assertReplace(
  "app/playtest.tsx",
  `  if (attackPenalty) {\n    next = { ...next, nextAttackBonus: next.nextAttackBonus - attackPenalty };\n    notes.push(\`target next Attack -\${attackPenalty} Attack Power\`);\n  }\n  if (defensePenalty) {\n    next = { ...next, nextDefenseCardBonus: (next.nextDefenseCardBonus ?? 0) - defensePenalty };\n    notes.push(\`target next Defense card -\${defensePenalty} Guard\`);\n  }\n`,
  `  if (attackPenalty) {\n    next = queueOpponentCardModification({ ...next, nextAttackBonus: next.nextAttackBonus - attackPenalty }, "Attack");\n    notes.push(\`target next Attack -\${attackPenalty} Attack Power\`);\n  }\n  if (defensePenalty) {\n    next = queueOpponentCardModification({ ...next, nextDefenseCardBonus: (next.nextDefenseCardBonus ?? 0) - defensePenalty }, "Defense");\n    notes.push(\`target next Defense card -\${defensePenalty} Guard\`);\n  }\n`,
  "Attack hit card modification provenance",
);
const supportPenalty = `      const defensePenalty = targetNextDefensePenalty(card);\n      if (defensePenalty) nextAi = { ...nextAi, nextDefenseCardBonus: (nextAi.nextDefenseCardBonus ?? 0) - defensePenalty };\n`;
assertReplace(
  "app/playtest.tsx",
  supportPenalty,
  `      const defensePenalty = targetNextDefensePenalty(card);\n      if (defensePenalty) nextAi = queueOpponentCardModification({ ...nextAi, nextDefenseCardBonus: (nextAi.nextDefenseCardBonus ?? 0) - defensePenalty }, "Defense");\n`,
  "player support Defense modification provenance",
);
assertReplace(
  "app/playtest.tsx",
  `      const defensePenalty = targetNextDefensePenalty(card);\n      if (defensePenalty) nextPlayer = { ...nextPlayer, nextDefenseCardBonus: (nextPlayer.nextDefenseCardBonus ?? 0) - defensePenalty };\n`,
  `      const defensePenalty = targetNextDefensePenalty(card);\n      if (defensePenalty) nextPlayer = queueOpponentCardModification({ ...nextPlayer, nextDefenseCardBonus: (nextPlayer.nextDefenseCardBonus ?? 0) - defensePenalty }, "Defense");\n`,
  "AI support Defense modification provenance",
);

const testSource = `import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n\nimport { applyCharacterRuntimeEvent } from "../app/character-runtime.ts";\nimport { queueOpponentCardModification, runtimeCommandCardModificationTypes } from "../app/character-card-modification-facts.ts";\nimport { applyQuickDuelPlaytestTransition, resolveQuickDuelPlaytestCharacterChoice } from "../app/quick-duel-playtest-host.ts";\n\nfunction board(overrides = {}) {\n  return {\n    fighterId: "DDB-CHR-CORE-001", belt: 3, hp: 25, maxHp: 25, xp: 0, focus: 0, tempSpeed: 0, nextAttackBonus: 0, nextDefenseCardBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false, attacksThisTurn: 0, zonesPlayed: [], cardsThisTurn: [], equipment: [], exhaustedEquipment: [], hand: ["h1", "h2"], deck: ["d1", "d2"], discard: [], destroyed: [], learnedCombos: [], triggeredCombos: [], cardsBought: 0, usedConsumableThisRound: false, wasHitSinceLastTurn: false, damageReductionUsed: false, reversalAttackBonus: 0, borrowedEquipmentId: null, abilityUsedRound: false, usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [], usedCharacterEffectIdsThisGame: [], characterMarks: {}, stage3cStatuses: [], stage3cChoices: [], stage3cRestrictions: [], damageDealt: 0, damageTaken: 0, completedBeltExamThisRound: false, ...overrides,\n  };\n}\n\nfunction match(player = board(), ai = board()) {\n  return { schema: 8, player, ai, market: [], round: 1, phase: "player-yell", turnOrder: ["player", "ai"], turnIndex: 0, lastExchange: null, pendingChoice: null, winner: null, log: [] };\n}\n\nconst lookup = () => null;\n\ntest("Coach Karen White resolves from a semantic Attack modification and Green immediately arms +1 Attack Power", () => {\n  const coach = board({ fighterId: "DDB-CHR-CORE-005", belt: 3 });\n  const first = applyCharacterRuntimeEvent(coach, board(), { type: "cardModified", opponentModifiedCard: true, modifiedCardType: "Attack" }, "player");\n  assert.equal(first.choices.length, 1);\n  assert.ok(first.self.hand.includes("d2"), "White draws before asking what to discard");\n  const resolved = applyCharacterRuntimeEvent(first.self, first.opponent, { ...first.event, selectedId: "h1" }, "player");\n  assert.equal(resolved.choices.length, 0);\n  assert.equal(resolved.self.nextAttackBonus, 1);\n  assert.equal(resolved.self.discard.at(-1), "h1");\n  assert.equal(resolved.self.characterMarks["round:modifiedCardType"], undefined);\n});\n\ntest("Coach Karen Green arms +1 Guard for a Defense modification and AI uses the same runtime contract", () => {\n  const coach = board({ fighterId: "DDB-CHR-CORE-005", belt: 3 });\n  const resolved = applyCharacterRuntimeEvent(coach, board(), { type: "cardModified", opponentModifiedCard: true, modifiedCardType: "Defense" }, "ai");\n  assert.equal(resolved.choices.length, 0);\n  assert.equal(resolved.self.nextDefenseCardBonus, 1);\n  assert.equal(resolved.self.hand.length, 2, "AI draws one and discards one through White");\n});\n\ntest("Coach Karen White/Green remain once per round", () => {\n  const coach = board({ fighterId: "DDB-CHR-CORE-005", belt: 3 });\n  const first = applyCharacterRuntimeEvent(coach, board(), { type: "cardModified", modifiedCardType: "Attack" }, "ai");\n  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "cardModified", modifiedCardType: "Defense" }, "ai");\n  assert.equal(second.self.nextAttackBonus, 1);\n  assert.equal(second.self.nextDefenseCardBonus, 0);\n  assert.deepEqual(second.self.hand, first.self.hand);\n});\n\ntest("queued opponent modification facts publish through Quick Duel and surface the human White choice", () => {\n  const previous = match(board({ fighterId: "DDB-CHR-CORE-005", belt: 3 }));\n  const next = { ...previous, player: queueOpponentCardModification(previous.player, "Attack") };\n  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookup);\n  assert.equal(hosted.pendingChoice?.kind, "character-runtime");\n  assert.equal(hosted.pendingChoice?.event?.type, "cardModified");\n  assert.equal(hosted.pendingChoice?.event?.modifiedCardType, "Attack");\n  const resumed = resolveQuickDuelPlaytestCharacterChoice(hosted, "player", hosted.pendingChoice.event, hosted.pendingChoice.choice, "h1");\n  assert.equal(resumed.match.player.nextAttackBonus, 1);\n});\n\ntest("runtime-command provenance recognizes only opponent-targeted next Attack/Defense card modifiers", () => {\n  assert.deepEqual(runtimeCommandCardModificationTypes([\n    { effect: "combat.modifyAttackPower", target: "opponent", duration: "nextAttack" },\n    { effect: "combat.modifyGuard", target: "opponent", duration: "nextDefense" },\n    { effect: "combat.modifySpeed", target: "opponent", duration: "endOfRound" },\n    { effect: "combat.modifyAttackPower", target: "self", duration: "nextAttack" },\n  ]), ["Attack", "Defense"]);\n});\n\ntest("Coach integration stays generic and canonical", async () => {\n  const [runtime, playtest, routes, canonical] = await Promise.all([\n    readFile(new URL("../app/character-runtime.ts", import.meta.url), "utf8"),\n    readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),\n    readFile(new URL("../app/quick-duel-character-event-routes.ts", import.meta.url), "utf8"),\n    readFile(new URL("../content/card-effects/characters.json", import.meta.url), "utf8"),\n  ]);\n  assert.match(runtime, /character\\.opponentModificationCycle\": \\[\"cardModified\"\\]/);\n  assert.match(runtime, /character\\.green\\.repeatModifiedCardTypeBonus\": \\[\"cardModified\"\\]/);\n  assert.match(routes, /event: \"cardModified\"/);\n  assert.doesNotMatch(playtest, /Coach Karen|DDB-CHR-CORE-005/);\n  const registry = JSON.parse(canonical);\n  const green = registry.cards["DDB-CHR-CORE-005"].effects.find((effect) => effect.resolver === "character.green.repeatModifiedCardTypeBonus");\n  assert.equal(green.amount, 1);\n});\n`;
fs.writeFileSync("tests/quick-duel-character-coach-modification-host.test.mjs", testSource);

console.log("Coach Karen Stage 3E patch applied.");
