import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  characterDecision,
  characterUsageScope,
  consumeCharacterCommand,
  createCharacterRuntimeState,
  greenCharacterAbilityUnlocked,
  isSupportedCharacterResolver,
  resetCharacterRuntimeState,
  resolveCharacterEffect,
} from "../app/character-effect-resolvers.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const sourceText = await readFile(new URL("../content/card-effects/characters.json", import.meta.url), "utf8");
const family = JSON.parse(sourceText);
const registry = family.cards ?? {};
const vocabulary = JSON.parse(await readFile(new URL("../content/effects.json", import.meta.url), "utf8"));
const coreCharacters = cards.filter((card) => String(card.catalogId ?? "").startsWith("DDB-CHR-CORE-"));
const familyIds = Object.keys(registry);

function contextFor(effect, actor = "player") {
  return {
    trigger: effect.trigger === "passive" ? "passive" : effect.trigger,
    activeResolvers: effect.trigger === "passive" ? [effect.resolver] : [],
    actor,
    belt: "Green",
    values: Object.fromEntries((effect.conditions ?? []).map((condition) => [condition.kind, condition.value])),
  };
}

test("Character family registry has canonical Stage 3B metadata", () => {
  assert.equal(family.$schema, "../card-effect-family.schema.json");
  assert.equal(family.schemaVersion, 1);
  assert.equal(family.rulesVersion, "v2.3");
  assert.equal(family.rulesRevision, "v2.3-r5");
  assert.equal(family.family, "Character");
});

test("all 41 Core Characters have exactly one structured-effect entry", () => {
  assert.equal(coreCharacters.length, 41, "canonical Core Character inventory changed; review Stage 3B coverage");
  assert.equal(familyIds.length, 41, "Character family registry must contain exactly 41 Core Characters");
  assert.deepEqual(familyIds.filter((id) => !id.startsWith("DDB-CHR-CORE-")), []);
  const expectedIds = Array.from({ length: 41 }, (_, index) => `DDB-CHR-CORE-${String(index + 1).padStart(3, "0")}`);
  assert.deepEqual(familyIds, expectedIds, "Character Catalog IDs must remain contiguous 001-041");
  const declared = [...sourceText.matchAll(/"(DDB-CHR-CORE-\d{3})"\s*:/g)].map((match) => match[1]);
  assert.equal(declared.length, 41);
  assert.equal(new Set(declared).size, 41, "Character family source contains a duplicate Catalog ID");
  assert.deepEqual(coreCharacters.filter((card) => !registry[card.catalogId]).map((card) => card.catalogId), []);
});

test("Character names and non-empty executable effect arrays match the canonical catalog", () => {
  const mismatches = coreCharacters
    .filter((card) => registry[card.catalogId]?.name !== card.name)
    .map((card) => `${card.catalogId}: ${registry[card.catalogId]?.name} != ${card.name}`);
  assert.deepEqual(mismatches, []);
  assert.deepEqual(coreCharacters.filter((card) => !registry[card.catalogId]?.effects?.length).map((card) => card.catalogId), []);
});

test("Character family uses only canonical effect and condition vocabulary", () => {
  const unknownEffects = [];
  const unknownConditions = [];
  for (const [catalogId, entry] of Object.entries(registry)) {
    for (const effect of entry.effects) {
      if (!vocabulary.effects?.[effect.effect]) unknownEffects.push(`${catalogId}:${effect.id}:${effect.effect}`);
      for (const condition of effect.conditions ?? []) {
        if (!vocabulary.conditions?.[condition.kind]) unknownConditions.push(`${catalogId}:${effect.id}:${condition.kind}`);
      }
    }
  }
  assert.deepEqual(unknownEffects, []);
  assert.deepEqual(unknownConditions, []);
});

test("every Character dedicated resolver is executable for player and AI paths", () => {
  const failures = [];
  for (const [catalogId, entry] of Object.entries(registry)) {
    for (const effect of entry.effects) {
      if (!isSupportedCharacterResolver(effect.resolver)) {
        failures.push(`${catalogId}:${effect.id}:unsupported:${effect.resolver}`);
        continue;
      }
      for (const actor of ["player", "ai"]) {
        const commands = resolveCharacterEffect(effect, contextFor(effect, actor));
        if (commands.length !== 1) failures.push(`${catalogId}:${effect.id}:${actor}:commands=${commands.length}`);
        if (commands[0]?.requiresDecision) {
          const decision = characterDecision(commands[0], { ...contextFor(effect, actor), values: { ...contextFor(effect, actor).values, legalZones: ["High", "Mid", "Low"], opponentZoneDefense: { High: 3, Mid: 1, Low: 2 }, candidates: [{ id: "b", score: 1 }, { id: "a", score: 2 }] } });
          if (actor === "player" && decision.mode !== "player") failures.push(`${catalogId}:${effect.id}:player-choice`);
          if (actor === "ai" && decision.mode !== "ai") failures.push(`${catalogId}:${effect.id}:ai-choice`);
        }
      }
    }
  }
  assert.deepEqual(failures, []);
});

test("Green abilities are unavailable before Green Belt and unlock immediately at Green", () => {
  assert.equal(greenCharacterAbilityUnlocked("White"), false);
  assert.equal(greenCharacterAbilityUnlocked("Orange"), false);
  assert.equal(greenCharacterAbilityUnlocked("Green"), true);
  assert.equal(greenCharacterAbilityUnlocked(3), true);
  const greenEffects = Object.values(registry).flatMap((entry) => entry.effects).filter((effect) => effect.resolver?.startsWith("character.green."));
  assert.ok(greenEffects.length > 0);
  for (const effect of greenEffects) {
    assert.equal(resolveCharacterEffect(effect, { ...contextFor(effect), belt: "White" }).length, 0, effect.id);
    assert.equal(resolveCharacterEffect(effect, { ...contextFor(effect), belt: "Green" }).length, 1, effect.id);
  }
});

test("turn, round, and once-per-game usage state resets at the correct boundaries", () => {
  const turnEffect = registry["DDB-CHR-CORE-040"].effects[0];
  const roundEffect = registry["DDB-CHR-CORE-001"].effects[0];
  const gameEffect = registry["DDB-CHR-CORE-029"].effects[0];
  assert.equal(characterUsageScope(turnEffect.resolver), "turn");
  assert.equal(characterUsageScope(roundEffect.resolver), "round");
  assert.equal(characterUsageScope(gameEffect.resolver), "game");

  let state = createCharacterRuntimeState();
  const turnCommand = resolveCharacterEffect(turnEffect, contextFor(turnEffect))[0];
  const roundCommand = resolveCharacterEffect(roundEffect, contextFor(roundEffect))[0];
  const gameCommand = resolveCharacterEffect(gameEffect, contextFor(gameEffect))[0];
  state = consumeCharacterCommand(consumeCharacterCommand(consumeCharacterCommand(state, turnCommand), roundCommand), gameCommand);

  assert.equal(resolveCharacterEffect(turnEffect, { ...contextFor(turnEffect), usedEffectIdsThisTurn: state.usedEffectIdsThisTurn }).length, 0);
  assert.equal(resolveCharacterEffect(roundEffect, { ...contextFor(roundEffect), usedEffectIdsThisRound: state.usedEffectIdsThisRound }).length, 0);
  assert.equal(resolveCharacterEffect(gameEffect, { ...contextFor(gameEffect), usedEffectIdsThisGame: state.usedEffectIdsThisGame }).length, 0);

  state = resetCharacterRuntimeState(state, "turn");
  assert.equal(state.usedEffectIdsThisTurn.length, 0);
  assert.equal(state.usedEffectIdsThisRound.length, 1);
  assert.equal(state.usedEffectIdsThisGame.length, 1);
  state = resetCharacterRuntimeState(state, "round");
  assert.equal(state.usedEffectIdsThisRound.length, 0);
  assert.equal(state.usedEffectIdsThisGame.length, 1, "once-per-game effects must survive round reset");
});

test("AI zone choices are deterministic and favor the lowest represented defense", () => {
  const effect = registry["DDB-CHR-CORE-010"].effects[0];
  const command = resolveCharacterEffect(effect, contextFor(effect, "ai"))[0];
  const values = { legalZones: ["High", "Mid", "Low"], opponentZoneDefense: { High: 4, Mid: 1, Low: 3 } };
  assert.deepEqual(characterDecision(command, { ...contextFor(effect, "ai"), values }), { mode: "ai", choice: "Mid" });
  assert.deepEqual(characterDecision(command, { ...contextFor(effect, "ai"), values }), { mode: "ai", choice: "Mid" });
});

test("core.custom is reserved for the three genuinely bespoke Character mechanics", () => {
  const custom = Object.entries(registry).flatMap(([catalogId, entry]) => entry.effects
    .filter((effect) => effect.effect === "core.custom")
    .map((effect) => `${catalogId}:${effect.resolver}`));
  assert.deepEqual(custom, [
    "DDB-CHR-CORE-005:character.green.repeatModifiedCardTypeBonus",
    "DDB-CHR-CORE-014:character.ignoreTemporaryAttackBonusesOnceGame",
    "DDB-CHR-CORE-019:character.cannotEquipWeapons",
    "DDB-CHR-CORE-035:character.reduceLargeAttackModifier",
  ]);
});
